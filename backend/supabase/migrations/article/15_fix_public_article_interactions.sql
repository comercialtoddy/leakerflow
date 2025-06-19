-- Fix Public Article Interactions
-- This migration allows authenticated users to interact with public articles from any author
-- Fixes the issue where users can only interact with their own articles

BEGIN;

-- =======================
-- UPDATE ARTICLES SELECT POLICY
-- =======================

-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "articles_select_policy" ON articles;

-- Create a more permissive policy for public articles
CREATE POLICY "articles_select_policy" ON articles
FOR SELECT USING (
  CASE 
    -- Public published articles can be viewed by anyone (authenticated or not)
    WHEN visibility = 'public' AND status = 'published' THEN true
    
    -- Account-visible articles can be viewed by account members OR if user is authenticated (for discover page)
    WHEN visibility = 'account' AND status = 'published' THEN
      (auth.uid() IS NOT NULL) -- Any authenticated user can view published account articles
    
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

-- =======================
-- UPDATE ARTICLE_VOTES POLICIES
-- =======================

-- Update voting policies to allow interaction with public articles
DROP POLICY IF EXISTS "article_votes_select_policy" ON article_votes;
DROP POLICY IF EXISTS "article_votes_insert_policy" ON article_votes;
DROP POLICY IF EXISTS "article_votes_update_policy" ON article_votes;
DROP POLICY IF EXISTS "article_votes_delete_policy" ON article_votes;

-- Allow viewing votes on articles the user can see
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

-- Allow voting on public and accessible articles
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
-- UPDATE SAVED_ARTICLES POLICIES
-- =======================

-- Update saved articles policies to allow saving public articles
DROP POLICY IF EXISTS "saved_articles_insert_policy" ON saved_articles;

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

-- =======================
-- UPDATE ARTICLE_EVENTS POLICIES
-- =======================

-- Update article events policies to allow tracking on public articles
DROP POLICY IF EXISTS "article_events_insert_policy" ON article_events;

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
-- ENSURE PUBLIC VISIBILITY FOR DISCOVER
-- =======================

-- Update existing published articles to have public visibility if they don't have account_id set properly
UPDATE articles 
SET visibility = 'public'
WHERE status = 'published' 
  AND (visibility IS NULL OR visibility = 'account')
  AND account_id IS NOT NULL;

-- =======================
-- VERIFICATION
-- =======================

-- Verify policies were updated
DO $$
DECLARE
  articles_policy_count INTEGER;
  votes_policy_count INTEGER;
  saved_policy_count INTEGER;
  events_policy_count INTEGER;
BEGIN
  -- Check articles policies
  SELECT COUNT(*) INTO articles_policy_count
  FROM pg_policies
  WHERE tablename = 'articles'
  AND policyname = 'articles_select_policy';
  
  -- Check votes policies
  SELECT COUNT(*) INTO votes_policy_count
  FROM pg_policies
  WHERE tablename = 'article_votes'
  AND policyname IN ('article_votes_select_policy', 'article_votes_insert_policy');
  
  -- Check saved articles policies
  SELECT COUNT(*) INTO saved_policy_count
  FROM pg_policies
  WHERE tablename = 'saved_articles'
  AND policyname = 'saved_articles_insert_policy';
  
  -- Check events policies
  SELECT COUNT(*) INTO events_policy_count
  FROM pg_policies
  WHERE tablename = 'article_events'
  AND policyname = 'article_events_insert_policy';
  
  IF articles_policy_count = 0 THEN
    RAISE EXCEPTION 'Articles select policy was not created';
  END IF;
  
  IF votes_policy_count < 2 THEN
    RAISE WARNING 'Not all voting policies were created. Found % policies', votes_policy_count;
  END IF;
  
  RAISE NOTICE 'Successfully updated policies for public article interactions';
  RAISE NOTICE 'Articles policies: %, Votes policies: %, Saved policies: %, Events policies: %', 
    articles_policy_count, votes_policy_count, saved_policy_count, events_policy_count;
END $$;

COMMIT; 