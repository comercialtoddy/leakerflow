-- Articles Voting System
-- This migration creates the complete voting system for articles

-- =======================
-- VOTING TABLE
-- =======================

-- Article votes tracking (one vote per user per article)
CREATE TABLE IF NOT EXISTS article_votes (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('upvote', 'downvote')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Unique constraint: one vote per user per article
  UNIQUE(article_id, user_id)
);

-- =======================
-- INDEXES
-- =======================

-- Voting table indexes
CREATE INDEX IF NOT EXISTS idx_article_votes_article_id ON article_votes(article_id);
CREATE INDEX IF NOT EXISTS idx_article_votes_user_id ON article_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_article_votes_vote_type ON article_votes(vote_type);
CREATE INDEX IF NOT EXISTS idx_article_votes_created_at ON article_votes(created_at DESC);

-- =======================
-- TRIGGERS
-- =======================

-- Apply updated_at trigger to votes
CREATE TRIGGER update_article_votes_updated_at 
    BEFORE UPDATE ON article_votes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =======================
-- ROW LEVEL SECURITY
-- =======================

-- Enable RLS on votes table
ALTER TABLE article_votes ENABLE ROW LEVEL SECURITY;

-- Voting policies
CREATE POLICY "Users can view all votes" ON article_votes
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own votes" ON article_votes
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes" ON article_votes
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes" ON article_votes
    FOR DELETE USING (auth.uid() = user_id);

-- =======================
-- VOTING FUNCTIONS
-- =======================

-- Vote on article (upvote or downvote)
CREATE OR REPLACE FUNCTION vote_on_article(
    p_article_id uuid,
    p_vote_type text
)
RETURNS jsonb AS $$
DECLARE
    current_user_id uuid;
    existing_vote text;
    new_upvotes integer;
    new_downvotes integer;
    new_vote_score integer;
    result jsonb;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    -- Only proceed if user is authenticated
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to vote';
    END IF;
    
    -- Validate vote type
    IF p_vote_type NOT IN ('upvote', 'downvote') THEN
        RAISE EXCEPTION 'Invalid vote type. Must be upvote or downvote';
    END IF;
    
    -- Check if user already voted on this article
    SELECT vote_type INTO existing_vote
    FROM article_votes 
    WHERE article_id = p_article_id AND user_id = current_user_id;
    
    -- Handle vote logic
    IF existing_vote IS NULL THEN
        -- New vote
        INSERT INTO article_votes (article_id, user_id, vote_type)
        VALUES (p_article_id, current_user_id, p_vote_type);
        
        -- Track event
        PERFORM track_article_event(p_article_id, p_vote_type);
        
    ELSIF existing_vote = p_vote_type THEN
        -- Remove vote (user clicked same vote again)
        DELETE FROM article_votes 
        WHERE article_id = p_article_id AND user_id = current_user_id;
        
    ELSE
        -- Change vote
        UPDATE article_votes 
        SET vote_type = p_vote_type, updated_at = now()
        WHERE article_id = p_article_id AND user_id = current_user_id;
        
        -- Track event
        PERFORM track_article_event(p_article_id, p_vote_type);
    END IF;
    
    -- Recalculate vote counts
    SELECT 
        COUNT(*) FILTER (WHERE vote_type = 'upvote'),
        COUNT(*) FILTER (WHERE vote_type = 'downvote')
    INTO new_upvotes, new_downvotes
    FROM article_votes 
    WHERE article_id = p_article_id;
    
    new_vote_score := new_upvotes - new_downvotes;
    
    -- Update article vote counts and recalculate trend score
    UPDATE articles SET
        upvotes = new_upvotes,
        downvotes = new_downvotes,
        vote_score = new_vote_score
    WHERE id = p_article_id;
    
    -- Recalculate trend score
    PERFORM calculate_trend_scores();
    
    -- Get updated user vote status
    SELECT vote_type INTO existing_vote
    FROM article_votes 
    WHERE article_id = p_article_id AND user_id = current_user_id;
    
    -- Return result
    result := jsonb_build_object(
        'upvotes', new_upvotes,
        'downvotes', new_downvotes,
        'vote_score', new_vote_score,
        'user_vote', existing_vote
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Calculate trend scores for all articles (Reddit-style algorithm)
CREATE OR REPLACE FUNCTION calculate_trend_scores()
RETURNS void AS $$
DECLARE
    article_record RECORD;
    hours_since_publish numeric;
    trend_score_val numeric;
    log_score numeric;
    time_decay numeric;
BEGIN
    FOR article_record IN 
        SELECT id, upvotes, downvotes, vote_score, created_at, publish_date
        FROM articles 
        WHERE status = 'published'
    LOOP
        -- Calculate hours since publish (use publish_date if available, otherwise created_at)
        hours_since_publish := EXTRACT(EPOCH FROM (now() - COALESCE(article_record.publish_date, article_record.created_at))) / 3600.0;
        
        -- Avoid log of zero or negative numbers
        IF article_record.vote_score <= 0 THEN
            log_score := 0;
        ELSE
            log_score := LOG(article_record.vote_score + 1);
        END IF;
        
        -- Time decay (articles lose trending power over time)
        -- More aggressive decay: articles older than 24 hours start losing significant score
        time_decay := GREATEST(0.1, 1.0 / (1.0 + hours_since_publish / 12.0));
        
        -- Reddit-style trending algorithm
        -- Higher vote score + recency bias
        trend_score_val := (log_score * time_decay) + (article_record.upvotes * 0.1 * time_decay);
        
        -- Update article with new trend score
        UPDATE articles SET
            trend_score = trend_score_val,
            is_trending = (trend_score_val > 1.0 AND article_record.vote_score > 0) -- Threshold for trending
        WHERE id = article_record.id;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Get user's vote status for an article
CREATE OR REPLACE FUNCTION get_user_vote(p_article_id uuid)
RETURNS text AS $$
DECLARE
    user_vote text;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN NULL;
    END IF;
    
    SELECT vote_type INTO user_vote
    FROM article_votes 
    WHERE article_id = p_article_id AND user_id = auth.uid();
    
    RETURN user_vote;
END;
$$ LANGUAGE plpgsql; 