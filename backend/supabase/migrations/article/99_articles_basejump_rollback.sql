-- ROLLBACK Migration: Remove Basejump integration from Articles
-- WARNING: This will remove all team article associations!
-- Only run this if absolutely necessary

-- Create a backup table first
CREATE TABLE IF NOT EXISTS articles_basejump_backup AS 
SELECT * FROM articles;

BEGIN;

-- =======================
-- RESTORE OLD RLS POLICIES
-- =======================

-- Drop new policies
DROP POLICY IF EXISTS "articles_select_policy" ON articles;
DROP POLICY IF EXISTS "articles_insert_policy" ON articles;
DROP POLICY IF EXISTS "articles_update_policy" ON articles;
DROP POLICY IF EXISTS "articles_delete_policy" ON articles;

-- Recreate original policies
CREATE POLICY "Users can view published articles or own articles" ON articles
    FOR SELECT USING (
        status = 'published' OR 
        auth.uid() = user_id
    );

CREATE POLICY "Users can insert own articles" ON articles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own articles" ON articles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own articles" ON articles
    FOR DELETE USING (auth.uid() = user_id);

-- =======================
-- RESTORE ARTICLE_VOTES POLICIES
-- =======================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'article_votes') THEN
    -- Drop new policies
    DROP POLICY IF EXISTS "article_votes_select_policy" ON article_votes;
    DROP POLICY IF EXISTS "article_votes_insert_policy" ON article_votes;
    DROP POLICY IF EXISTS "article_votes_update_policy" ON article_votes;
    DROP POLICY IF EXISTS "article_votes_delete_policy" ON article_votes;
    
    -- Recreate original policies
    CREATE POLICY "Users can view all votes" ON article_votes
      FOR SELECT USING (true);
    
    CREATE POLICY "Users can manage their own votes" ON article_votes
      FOR ALL USING (user_id = auth.uid());
  END IF;
END $$;

-- =======================
-- REMOVE BASEJUMP COLUMNS
-- =======================

-- Remove from related tables first
ALTER TABLE article_events 
  DROP COLUMN IF EXISTS account_id CASCADE;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'article_analytics_daily') THEN
    ALTER TABLE article_analytics_daily 
      DROP COLUMN IF EXISTS account_id CASCADE;
  END IF;
END $$;

-- Drop views that depend on account_id
DROP VIEW IF EXISTS article_publish_permissions CASCADE;
DROP VIEW IF EXISTS account_article_stats CASCADE;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS articles_protect_immutable_fields ON articles;
DROP FUNCTION IF EXISTS protect_article_immutable_fields();

-- Drop indexes
DROP INDEX IF EXISTS idx_articles_account_id;
DROP INDEX IF EXISTS idx_articles_created_by_user_id;
DROP INDEX IF EXISTS idx_articles_visibility;
DROP INDEX IF EXISTS idx_articles_account_visibility;
DROP INDEX IF EXISTS idx_articles_account_created_at;
DROP INDEX IF EXISTS idx_article_events_account_id;
DROP INDEX IF EXISTS idx_article_analytics_daily_account_id;

-- Remove constraints
ALTER TABLE articles 
  DROP CONSTRAINT IF EXISTS articles_visibility_check;

-- Finally, drop the columns from articles
ALTER TABLE articles 
  DROP COLUMN IF EXISTS account_id CASCADE,
  DROP COLUMN IF EXISTS created_by_user_id CASCADE,
  DROP COLUMN IF EXISTS visibility CASCADE;

-- =======================
-- VERIFICATION
-- =======================

-- Verify rollback
DO $$
DECLARE
  column_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO column_count
  FROM information_schema.columns
  WHERE table_name = 'articles'
  AND column_name IN ('account_id', 'created_by_user_id', 'visibility');
  
  IF column_count > 0 THEN
    RAISE EXCEPTION 'Rollback failed: Basejump columns still exist';
  ELSE
    RAISE NOTICE 'Rollback successful: Basejump columns removed';
  END IF;
END $$;

COMMIT;

-- Final message
DO $$
BEGIN
  RAISE NOTICE '
    ROLLBACK COMPLETED
    
    The articles system has been reverted to user-based ownership.
    A backup of the data with account associations has been saved in articles_basejump_backup.
    
    To restore the backup if needed:
    TRUNCATE articles;
    INSERT INTO articles SELECT * FROM articles_basejump_backup;
  ';
END $$; 