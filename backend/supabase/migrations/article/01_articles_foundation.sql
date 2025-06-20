-- =======================
-- MIGRATION: Articles Foundation
-- Consolidation of: 01_articles_core_tables.sql + 06_articles_storage.sql + core triggers
-- Applied fixes: Basejump integration columns, user-specific saves structure
-- =======================

BEGIN;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================
-- STORAGE SETUP
-- =======================

-- Create storage bucket for articles media (images/videos up to 15MB)
INSERT INTO storage.buckets (id, name, public)
VALUES ('articles-media', 'articles-media', true)
ON CONFLICT (id) DO NOTHING;

-- Set file size limit to 15MB (15,728,640 bytes)
UPDATE storage.buckets 
SET file_size_limit = 15728640 
WHERE id = 'articles-media';

-- =======================
-- CORE TABLES
-- =======================

-- Create articles table with all fields including Basejump integration
CREATE TABLE IF NOT EXISTS articles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  subtitle text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  tags text[] DEFAULT '{}',
  author text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'scheduled')),
  
  -- Media and sources as JSONB for flexibility
  media_items jsonb DEFAULT '[]',
  sources jsonb DEFAULT '[]',
  
  -- Article sections for modular content
  sections jsonb DEFAULT '[]',
  
  -- Metadata
  read_time text NOT NULL,
  image_url text,
  views integer DEFAULT 0,
  engagement numeric(5,2) DEFAULT 0,
  bookmarked boolean DEFAULT false, -- Legacy field for backward compatibility
  saved boolean DEFAULT false, -- Legacy field - now handled by saved_articles table
  
  -- Voting system (Reddit-style)
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  vote_score integer DEFAULT 0, -- upvotes - downvotes
  trend_score numeric(10,2) DEFAULT 0, -- calculated trend score for Trends section
  is_trending boolean DEFAULT false, -- flag for articles that qualify for Trends
  
  -- Advanced metrics (calculated from events)
  total_views integer DEFAULT 0,
  unique_views integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  total_saves integer DEFAULT 0,
  total_comments integer DEFAULT 0,
  avg_read_time numeric(8,2) DEFAULT 0,
  bounce_rate numeric(5,2) DEFAULT 0,
  
  -- Publishing
  publish_date timestamptz,
  
  -- Hybrid storage support columns
  content_storage_path text,
  content_size integer,
  sections_storage_path text,
  media_items_storage_path text,
  sources_storage_path text,
  
  -- Basejump multi-tenant integration (required)
  account_id uuid REFERENCES basejump.accounts(id) NOT NULL,
  created_by_user_id uuid REFERENCES auth.users(id) NOT NULL,
  visibility text DEFAULT 'account' CHECK (visibility IN ('private', 'account', 'public')),
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Auto-cleanup constraint (articles older than 1 week will be cleaned up)
  CONSTRAINT valid_article_age CHECK (created_at > now() - interval '1 week' OR status = 'published')
);

-- User-specific saved articles table (replaces global saved field)
CREATE TABLE IF NOT EXISTS saved_articles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    article_id uuid REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Ensure one save per user per article
    UNIQUE(user_id, article_id)
);

-- =======================
-- INDEXES
-- =======================

-- Articles table indexes
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_trend_score ON articles(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_trending ON articles(is_trending);
CREATE INDEX IF NOT EXISTS idx_articles_vote_score ON articles(vote_score DESC);

-- Basejump integration indexes
CREATE INDEX IF NOT EXISTS idx_articles_account_id ON articles(account_id);
CREATE INDEX IF NOT EXISTS idx_articles_created_by_user_id ON articles(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_articles_visibility ON articles(visibility);
CREATE INDEX IF NOT EXISTS idx_articles_account_visibility ON articles(account_id, visibility, status);
CREATE INDEX IF NOT EXISTS idx_articles_account_created_at ON articles(account_id, created_at DESC);

-- Saved articles indexes
CREATE INDEX IF NOT EXISTS idx_saved_articles_user_id ON saved_articles(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_articles_article_id ON saved_articles(article_id);
CREATE INDEX IF NOT EXISTS idx_saved_articles_created_at ON saved_articles(created_at);

-- =======================
-- CORE TRIGGERS
-- =======================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to articles
CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply updated_at trigger to saved_articles
CREATE TRIGGER update_saved_articles_updated_at
    BEFORE UPDATE ON saved_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update total_saves count for an article
CREATE OR REPLACE FUNCTION update_article_total_saves()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Increment total_saves
        UPDATE articles 
        SET total_saves = COALESCE(total_saves, 0) + 1
        WHERE id = NEW.article_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Decrement total_saves
        UPDATE articles 
        SET total_saves = GREATEST(COALESCE(total_saves, 0) - 1, 0)
        WHERE id = OLD.article_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update total_saves
CREATE TRIGGER trigger_update_article_total_saves
    AFTER INSERT OR DELETE ON saved_articles
    FOR EACH ROW
    EXECUTE FUNCTION update_article_total_saves();

-- Function to help cleanup storage when article is deleted
CREATE OR REPLACE FUNCTION cleanup_article_storage()
RETURNS TRIGGER AS $$
BEGIN
    -- Log the deletion for debugging
    RAISE NOTICE 'Article % deleted, storage cleanup may be needed for paths: %, %, %, %', 
        OLD.id, 
        OLD.content_storage_path,
        OLD.sections_storage_path,
        OLD.media_items_storage_path,
        OLD.sources_storage_path;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for storage cleanup
CREATE TRIGGER cleanup_article_storage_trigger
    BEFORE DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION cleanup_article_storage();

-- Protect immutable Basejump fields
CREATE OR REPLACE FUNCTION protect_article_immutable_fields()
    RETURNS TRIGGER AS
$$
BEGIN
    -- Prevent changes to account_id
    IF NEW.account_id != OLD.account_id THEN
        RAISE EXCEPTION 'Cannot change article account_id after creation';
    END IF;
    
    -- Prevent changes to created_by_user_id  
    IF NEW.created_by_user_id != OLD.created_by_user_id THEN
        RAISE EXCEPTION 'Cannot change article created_by_user_id after creation';
    END IF;
    
    RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Apply the trigger to articles table
CREATE TRIGGER articles_protect_immutable_fields
    BEFORE UPDATE ON articles
    FOR EACH ROW
EXECUTE FUNCTION protect_article_immutable_fields();

-- =======================
-- COMMENTS
-- =======================

-- Add comments on storage columns
COMMENT ON COLUMN articles.content_storage_path IS 'Path to content stored in Supabase Storage for large articles';
COMMENT ON COLUMN articles.content_size IS 'Original content size in characters';
COMMENT ON COLUMN articles.sections_storage_path IS 'Path to sections stored in Supabase Storage for large section arrays';
COMMENT ON COLUMN articles.media_items_storage_path IS 'Path to media items stored in Supabase Storage for large media arrays';
COMMENT ON COLUMN articles.sources_storage_path IS 'Path to sources stored in Supabase Storage for large source arrays';
COMMENT ON COLUMN articles.saved IS 'Legacy field - use saved_articles table instead';
COMMENT ON COLUMN articles.account_id IS 'The account (personal or team) that owns this article';
COMMENT ON COLUMN articles.created_by_user_id IS 'The user who created this article (author)';
COMMENT ON COLUMN articles.visibility IS 'Access level: private (author only), account (team members), public (everyone)';

-- =======================
-- VERIFICATION
-- =======================

-- Verify articles table structure
DO $$
DECLARE
  table_exists boolean;
  column_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'articles'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE EXCEPTION 'Articles table was not created';
  END IF;
  
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'articles'
  AND column_name IN ('account_id', 'created_by_user_id', 'visibility');
  
  IF column_count != 3 THEN
    RAISE EXCEPTION 'Basejump columns not properly added to articles table';
  END IF;
  
  -- Verify saved_articles table
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'saved_articles'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE EXCEPTION 'saved_articles table was not created';
  END IF;
  
  RAISE NOTICE 'Articles foundation setup completed successfully';
END $$;

COMMIT; 