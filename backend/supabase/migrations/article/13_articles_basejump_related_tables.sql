-- Migration: Update Related Tables for Basejump Integration
-- Phase 4: Add account_id to related tables
-- Date: 2024-01-XX
-- Updates: article_events, article_analytics_daily, saved_articles

BEGIN;

-- =======================
-- UPDATE ARTICLE_EVENTS TABLE
-- =======================

-- Add account_id to article_events
ALTER TABLE article_events 
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES basejump.accounts(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_article_events_account_id ON article_events(account_id);

-- Migrate existing data
UPDATE article_events e
SET account_id = a.account_id
FROM articles a
WHERE e.article_id = a.id
AND e.account_id IS NULL;

-- Make column required after migration
ALTER TABLE article_events
  ALTER COLUMN account_id SET NOT NULL;

-- Update RLS policies for article_events
DROP POLICY IF EXISTS "Users can view own events" ON article_events;
DROP POLICY IF EXISTS "Service role can insert events" ON article_events;

CREATE POLICY "article_events_select_policy" ON article_events
FOR SELECT USING (
  -- Can view events for articles they can access
  EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_events.article_id
    AND (
      -- Public published articles
      (a.visibility = 'public' AND a.status = 'published')
      OR
      -- Account member
      basejump.has_role_on_account(a.account_id)
      OR
      -- Author of private article
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
);

CREATE POLICY "article_events_insert_policy" ON article_events
FOR INSERT WITH CHECK (
  -- User must have access to the article
  EXISTS (
    SELECT 1 FROM articles a
    WHERE a.id = article_events.article_id
    AND (
      (a.visibility = 'public' AND a.status = 'published')
      OR
      basejump.has_role_on_account(a.account_id)
      OR
      (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
    )
  )
  -- And the user_id must match
  AND (user_id = auth.uid() OR user_id IS NULL)
);

-- =======================
-- UPDATE ARTICLE_ANALYTICS_DAILY TABLE
-- =======================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'article_analytics_daily') THEN
    -- Add account_id
    ALTER TABLE article_analytics_daily 
      ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES basejump.accounts(id);
    
    -- Create index
    CREATE INDEX IF NOT EXISTS idx_article_analytics_daily_account_id 
      ON article_analytics_daily(account_id);
    
    -- Migrate data
    UPDATE article_analytics_daily ad
    SET account_id = a.account_id
    FROM articles a
    WHERE ad.article_id = a.id
    AND ad.account_id IS NULL;
    
    -- Make required
    ALTER TABLE article_analytics_daily
      ALTER COLUMN account_id SET NOT NULL;
    
    -- Update RLS
    DROP POLICY IF EXISTS "Users can view analytics for own articles" ON article_analytics_daily;
    
    CREATE POLICY "article_analytics_daily_select_policy" ON article_analytics_daily
    FOR SELECT USING (
      basejump.has_role_on_account(article_analytics_daily.account_id)
    );
  END IF;
END $$;

-- =======================
-- UPDATE SAVED_ARTICLES TABLE
-- =======================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_articles') THEN
    -- Saved articles already have user_id, but we should ensure consistency
    -- Update RLS to respect article visibility
    DROP POLICY IF EXISTS "Users can manage their saved articles" ON saved_articles;
    
    CREATE POLICY "saved_articles_select_policy" ON saved_articles
    FOR SELECT USING (user_id = auth.uid());
    
    CREATE POLICY "saved_articles_insert_policy" ON saved_articles
    FOR INSERT WITH CHECK (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM articles a
        WHERE a.id = saved_articles.article_id
        AND (
          -- Can only save articles they can view
          (a.visibility = 'public' AND a.status = 'published')
          OR
          basejump.has_role_on_account(a.account_id)
          OR
          (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
        )
      )
    );
    
    CREATE POLICY "saved_articles_delete_policy" ON saved_articles
    FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- =======================
-- CREATE ACCOUNT-LEVEL VIEWS
-- =======================

-- View for account article statistics with built-in security
CREATE OR REPLACE VIEW account_article_stats AS
SELECT 
  acc.id as account_id,
  acc.name as account_name,
  acc.personal_account,
  COUNT(DISTINCT a.id) as total_articles,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'published') as published_articles,
  COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'draft') as draft_articles,
  COUNT(DISTINCT a.id) FILTER (WHERE a.visibility = 'public') as public_articles,
  COUNT(DISTINCT a.id) FILTER (WHERE a.visibility = 'account') as account_articles,
  COUNT(DISTINCT a.id) FILTER (WHERE a.visibility = 'private') as private_articles,
  COALESCE(SUM(a.total_views), 0) as total_views,
  COALESCE(SUM(a.vote_score), 0) as total_votes,
  COUNT(DISTINCT a.created_by_user_id) as unique_authors,
  MAX(a.created_at) as last_article_created,
  MIN(a.created_at) as first_article_created
FROM basejump.accounts acc
LEFT JOIN articles a ON a.account_id = acc.id
-- Security: Only show accounts the user belongs to
WHERE basejump.has_role_on_account(acc.id)
GROUP BY acc.id, acc.name, acc.personal_account;

-- Grant access to the view
GRANT SELECT ON account_article_stats TO authenticated;

-- =======================
-- VERIFICATION
-- =======================

-- Verify all related tables have account_id
DO $$
DECLARE
  events_without_account INTEGER;
  analytics_without_account INTEGER;
BEGIN
  -- Check article_events
  SELECT COUNT(*) INTO events_without_account
  FROM article_events
  WHERE account_id IS NULL;
  
  IF events_without_account > 0 THEN
    RAISE WARNING 'Found % article_events without account_id', events_without_account;
  END IF;
  
  -- Check article_analytics_daily if exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'article_analytics_daily') THEN
    SELECT COUNT(*) INTO analytics_without_account
    FROM article_analytics_daily
    WHERE account_id IS NULL;
    
    IF analytics_without_account > 0 THEN
      RAISE WARNING 'Found % article_analytics_daily without account_id', analytics_without_account;
    END IF;
  END IF;
  
  RAISE NOTICE 'Related tables migration completed';
END $$;

COMMIT; 