-- =======================
-- MIGRATION: Articles Security Policies (RLS)
-- Consolidation of: All RLS policies + security fixes
-- Applied fixes: Public access, account-based policies, user-specific interactions
-- =======================

BEGIN;

-- =======================
-- ARTICLES TABLE POLICIES
-- =======================

-- Drop any existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view published articles or own articles" ON articles;
DROP POLICY IF EXISTS "Users can insert own articles" ON articles;
DROP POLICY IF EXISTS "Users can update own articles" ON articles;
DROP POLICY IF EXISTS "Users can delete own articles" ON articles;
DROP POLICY IF EXISTS "articles_select_policy" ON articles;
DROP POLICY IF EXISTS "articles_insert_policy" ON articles;
DROP POLICY IF EXISTS "articles_update_policy" ON articles;
DROP POLICY IF EXISTS "articles_delete_policy" ON articles;

-- Enhanced article select policy (supports public access and multi-tenancy)
CREATE POLICY "articles_select_policy" ON articles
FOR SELECT USING (
  CASE 
    -- Public published articles can be viewed by anyone (authenticated or not)
    WHEN visibility = 'public' AND status = 'published' THEN true
    
    -- Account-visible articles can be viewed by authenticated users
    WHEN visibility = 'account' AND status = 'published' THEN
      (auth.uid() IS NOT NULL)
    
    -- Private articles can only be viewed by the author or account members
    WHEN visibility = 'private' THEN
      (created_by_user_id = auth.uid() OR basejump.has_role_on_account(articles.account_id))
    
    -- Draft articles can only be viewed by author or account members
    WHEN status = 'draft' THEN
      (created_by_user_id = auth.uid() OR basejump.has_role_on_account(articles.account_id))
      
    -- Default allow for authenticated users on published content
    WHEN status = 'published' THEN auth.uid() IS NOT NULL
      
    -- Default deny
    ELSE false
  END
);

-- Create articles in accounts where user is a member
CREATE POLICY "articles_insert_policy" ON articles
FOR INSERT WITH CHECK (
  -- User must be a member of the account
  basejump.has_role_on_account(articles.account_id)
  -- AND the created_by_user_id must be the current user
  AND created_by_user_id = auth.uid()
);

-- Update articles based on role and authorship
CREATE POLICY "articles_update_policy" ON articles
FOR UPDATE USING (
  -- Either the author can edit their own articles
  (articles.created_by_user_id = auth.uid() AND basejump.has_role_on_account(articles.account_id))
  OR
  -- Or account owners can edit any article in their account
  basejump.has_role_on_account(articles.account_id, 'owner')
);

-- Delete articles based on role and authorship
CREATE POLICY "articles_delete_policy" ON articles
FOR DELETE USING (
  -- Either the author can delete if they're still a member
  (articles.created_by_user_id = auth.uid() AND basejump.has_role_on_account(articles.account_id))
  OR
  -- Or account owners can delete any article
  basejump.has_role_on_account(articles.account_id, 'owner')
);

-- =======================
-- SAVED ARTICLES TABLE POLICIES
-- =======================

-- Drop existing policies
DROP POLICY IF EXISTS "saved_articles_select_policy" ON saved_articles;
DROP POLICY IF EXISTS "saved_articles_insert_policy" ON saved_articles;
DROP POLICY IF EXISTS "saved_articles_delete_policy" ON saved_articles;

-- Users can only see their own saves
CREATE POLICY "saved_articles_select_policy" ON saved_articles
FOR SELECT USING (user_id = auth.uid());

-- Users can save accessible articles
CREATE POLICY "saved_articles_insert_policy" ON saved_articles
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = saved_articles.article_id
    AND (
      -- Can save public published articles
      (a.visibility = 'public' AND a.status = 'published')
      OR
      -- Can save published account articles if authenticated
      (a.visibility = 'account' AND a.status = 'published' AND auth.uid() IS NOT NULL)
      OR
      -- Can save articles in their accounts
      basejump.has_role_on_account(a.account_id)
      OR
      -- Can save their own private articles
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
);

-- Users can only delete their own saves
CREATE POLICY "saved_articles_delete_policy" ON saved_articles
FOR DELETE USING (user_id = auth.uid());

-- =======================
-- ARTICLE VOTES TABLE POLICIES
-- =======================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all votes" ON article_votes;
DROP POLICY IF EXISTS "Users can insert their own votes" ON article_votes;
DROP POLICY IF EXISTS "Users can update their own votes" ON article_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON article_votes;
DROP POLICY IF EXISTS "Users can manage their own votes" ON article_votes;
DROP POLICY IF EXISTS "article_votes_select_policy" ON article_votes;
DROP POLICY IF EXISTS "article_votes_insert_policy" ON article_votes;
DROP POLICY IF EXISTS "article_votes_update_policy" ON article_votes;
DROP POLICY IF EXISTS "article_votes_delete_policy" ON article_votes;

-- Allow viewing votes on accessible articles
CREATE POLICY "article_votes_select_policy" ON article_votes
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_votes.article_id
    AND (
      -- Can see votes on public published articles
      (a.visibility = 'public' AND a.status = 'published')
      OR
      -- Can see votes on published account articles if authenticated
      (a.visibility = 'account' AND a.status = 'published' AND auth.uid() IS NOT NULL)
      OR
      -- Can see votes on articles in their accounts
      basejump.has_role_on_account(a.account_id)
      OR
      -- Can see votes on their own private articles
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
);

-- Allow voting on accessible articles
CREATE POLICY "article_votes_insert_policy" ON article_votes
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_votes.article_id
    AND (
      -- Can vote on public published articles
      (a.visibility = 'public' AND a.status = 'published')
      OR
      -- Can vote on published account articles if authenticated
      (a.visibility = 'account' AND a.status = 'published' AND auth.uid() IS NOT NULL)
      OR
      -- Can vote on articles in their accounts
      basejump.has_role_on_account(a.account_id)
      OR
      -- Can vote on their own private articles
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
);

-- Users can update their own votes
CREATE POLICY "article_votes_update_policy" ON article_votes
FOR UPDATE USING (user_id = auth.uid());

-- Users can delete their own votes
CREATE POLICY "article_votes_delete_policy" ON article_votes
FOR DELETE USING (user_id = auth.uid());

-- =======================
-- ARTICLE EVENTS TABLE POLICIES
-- =======================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view events for published articles or own articles" ON article_events;
DROP POLICY IF EXISTS "Anyone can insert events" ON article_events;
DROP POLICY IF EXISTS "Users can view own events" ON article_events;
DROP POLICY IF EXISTS "Service role can insert events" ON article_events;
DROP POLICY IF EXISTS "article_events_select_policy" ON article_events;
DROP POLICY IF EXISTS "article_events_insert_policy" ON article_events;

-- Allow viewing events for accessible articles
CREATE POLICY "article_events_select_policy" ON article_events
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_events.article_id
    AND (
      -- Can see events on public published articles
      (a.visibility = 'public' AND a.status = 'published')
      OR
      -- Can see events on published account articles if authenticated
      (a.visibility = 'account' AND a.status = 'published' AND auth.uid() IS NOT NULL)
      OR
      -- Can see events on articles in their accounts
      basejump.has_role_on_account(a.account_id)
      OR
      -- Can see events on their own private articles
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
);

-- Allow tracking events on accessible articles
CREATE POLICY "article_events_insert_policy" ON article_events
FOR INSERT WITH CHECK (
  -- User must have access to the article
  EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_events.article_id
    AND (
      -- Can track events on public published articles
      (a.visibility = 'public' AND a.status = 'published')
      OR
      -- Can track events on published account articles if authenticated
      (a.visibility = 'account' AND a.status = 'published' AND auth.uid() IS NOT NULL)
      OR
      -- Can track events on articles in their accounts
      basejump.has_role_on_account(a.account_id)
      OR
      -- Can track events on their own private articles
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
  -- And the user_id must match (or be null for anonymous events)
  AND (user_id = auth.uid() OR user_id IS NULL)
);

-- =======================
-- ARTICLE ANALYTICS TABLE POLICIES
-- =======================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view analytics for published articles or own articles" ON article_analytics;
DROP POLICY IF EXISTS "Users can view analytics for own articles" ON article_analytics;
DROP POLICY IF EXISTS "article_analytics_select_policy" ON article_analytics;

-- Allow viewing analytics for accessible articles
CREATE POLICY "article_analytics_select_policy" ON article_analytics
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_analytics.article_id
    AND (
      -- Can see analytics on public published articles (limited)
      (a.visibility = 'public' AND a.status = 'published' AND auth.uid() IS NOT NULL)
      OR
      -- Can see analytics on articles in their accounts
      basejump.has_role_on_account(a.account_id)
      OR
      -- Can see analytics on their own private articles
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
);

-- =======================
-- REALTIME ACTIVITY TABLE POLICIES
-- =======================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can track their own activities" ON article_realtime_activity;
DROP POLICY IF EXISTS "Users can update their own activities" ON article_realtime_activity;
DROP POLICY IF EXISTS "Users can view activities for accessible articles" ON article_realtime_activity;

-- Users can track their own activities
CREATE POLICY "realtime_activity_insert_policy" ON article_realtime_activity
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own activities
CREATE POLICY "realtime_activity_update_policy" ON article_realtime_activity
FOR UPDATE USING (auth.uid() = user_id);

-- Users can view activities for articles they can access
CREATE POLICY "realtime_activity_select_policy" ON article_realtime_activity
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM articles a 
    WHERE a.id = article_realtime_activity.article_id 
    AND (a.status = 'published' OR a.created_by_user_id = auth.uid())
  )
);

-- =======================
-- STORAGE POLICIES (FROM BASEJUMP INTEGRATION)
-- =======================

-- Note: Storage policies are already created in the Basejump integration file
-- This section documents them for completeness

/*
Storage policies created in 04_articles_basejump_integration.sql:

1. "Allow authenticated uploads to articles-media"
2. "Allow authenticated updates to articles-media" 
3. "Allow authenticated users to view files"
4. "Allow authenticated users to delete their files"
5. "Public can view articles-media files"

These policies ensure:
- Users can only upload/manage files in their own folders
- Public read access for published article content
- Account-based access control integration
*/

-- =======================
-- SECURITY VALIDATION
-- =======================

-- Function to test article access (for debugging)
CREATE OR REPLACE FUNCTION test_article_access(p_article_id uuid)
RETURNS jsonb AS $$
DECLARE
    result jsonb;
    article_record articles;
    user_id uuid;
BEGIN
    user_id := auth.uid();
    
    SELECT * INTO article_record FROM articles WHERE id = p_article_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object('error', 'Article not found');
    END IF;
    
    SELECT jsonb_build_object(
        'article_id', p_article_id,
        'user_id', user_id,
        'article_status', article_record.status,
        'article_visibility', article_record.visibility,
        'article_author', article_record.created_by_user_id,
        'is_author', (article_record.created_by_user_id = user_id),
        'has_account_access', basejump.has_role_on_account(article_record.account_id),
        'can_read', (
            -- Check if user can read this article
            (article_record.visibility = 'public' AND article_record.status = 'published') OR
            (article_record.visibility = 'account' AND article_record.status = 'published' AND user_id IS NOT NULL) OR
            (article_record.visibility = 'private' AND article_record.created_by_user_id = user_id) OR
            (article_record.status = 'draft' AND (article_record.created_by_user_id = user_id OR basejump.has_role_on_account(article_record.account_id)))
        ),
        'can_write', (
            article_record.created_by_user_id = user_id OR 
            basejump.has_role_on_account(article_record.account_id, 'owner')
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- VERIFICATION
-- =======================

DO $$
DECLARE
    articles_policies integer;
    votes_policies integer;
    events_policies integer;
    saved_policies integer;
    analytics_policies integer;
    realtime_policies integer;
    total_policies integer;
BEGIN
    -- Count policies for each table
    SELECT COUNT(*) INTO articles_policies
    FROM pg_policies WHERE tablename = 'articles';
    
    SELECT COUNT(*) INTO votes_policies
    FROM pg_policies WHERE tablename = 'article_votes';
    
    SELECT COUNT(*) INTO events_policies
    FROM pg_policies WHERE tablename = 'article_events';
    
    SELECT COUNT(*) INTO saved_policies
    FROM pg_policies WHERE tablename = 'saved_articles';
    
    SELECT COUNT(*) INTO analytics_policies
    FROM pg_policies WHERE tablename = 'article_analytics';
    
    SELECT COUNT(*) INTO realtime_policies
    FROM pg_policies WHERE tablename = 'article_realtime_activity';
    
    total_policies := articles_policies + votes_policies + events_policies + saved_policies + analytics_policies + realtime_policies;
    
    RAISE NOTICE 'Security policies verification:';
    RAISE NOTICE '- Articles policies: %', articles_policies;
    RAISE NOTICE '- Votes policies: %', votes_policies;
    RAISE NOTICE '- Events policies: %', events_policies;
    RAISE NOTICE '- Saved articles policies: %', saved_policies;
    RAISE NOTICE '- Analytics policies: %', analytics_policies;
    RAISE NOTICE '- Realtime activity policies: %', realtime_policies;
    RAISE NOTICE '- Total policies: %', total_policies;
    
    -- Verify minimum expected policies
    IF articles_policies < 4 THEN
        RAISE WARNING 'Expected at least 4 articles policies, found %', articles_policies;
    END IF;
    
    IF votes_policies < 4 THEN
        RAISE WARNING 'Expected at least 4 voting policies, found %', votes_policies;
    END IF;
    
    IF total_policies < 15 THEN
        RAISE WARNING 'Expected at least 15 total policies, found %', total_policies;
    END IF;
    
    RAISE NOTICE 'Articles security policies setup completed successfully';
END $$;

-- Grant execute permission on test function
GRANT EXECUTE ON FUNCTION test_article_access(uuid) TO authenticated;

COMMIT; 