-- Migration: Migrate existing articles data to Basejump
-- Phase 2: Data migration from user_id to account_id
-- Date: 2024-01-XX
-- CRITICAL: This migrates all existing articles to use accounts

BEGIN;

-- =======================
-- CREATE PERSONAL ACCOUNTS FOR ORPHAN USERS
-- =======================

-- Create personal accounts for users who have articles but no account
INSERT INTO basejump.accounts (name, slug, personal_account, created_by, updated_by, created_at, updated_at)
SELECT 
  COALESCE(u.raw_user_meta_data->>'full_name', u.email) as name,
  'personal-' || u.id as slug,
  true as personal_account,
  u.id as created_by,
  u.id as updated_by,
  u.created_at,
  now() as updated_at
FROM auth.users u
WHERE u.id IN (SELECT DISTINCT user_id FROM articles)
AND NOT EXISTS (
  SELECT 1 FROM basejump.account_user au 
  WHERE au.user_id = u.id 
)
ON CONFLICT DO NOTHING;

-- =======================
-- ASSOCIATE USERS WITH THEIR PERSONAL ACCOUNTS
-- =======================

-- Create account_user relationships for personal accounts
INSERT INTO basejump.account_user (account_id, user_id, account_role)
SELECT 
  a.id as account_id,
  a.created_by as user_id,
  'owner' as account_role
FROM basejump.accounts a
WHERE a.personal_account = true
AND NOT EXISTS (
  SELECT 1 FROM basejump.account_user au 
  WHERE au.account_id = a.id 
  AND au.user_id = a.created_by
)
ON CONFLICT DO NOTHING;

-- =======================
-- MIGRATE ARTICLES DATA
-- =======================

-- Update articles with account_id and created_by_user_id
UPDATE articles a
SET 
  account_id = COALESCE(
    a.account_id,
    (
      SELECT au.account_id 
      FROM basejump.account_user au 
      JOIN basejump.accounts acc ON acc.id = au.account_id
      WHERE au.user_id = a.user_id 
      AND acc.personal_account = true
      LIMIT 1
    )
  ),
  created_by_user_id = COALESCE(a.created_by_user_id, a.user_id),
  visibility = CASE 
    WHEN a.status = 'published' THEN 'public'
    WHEN a.status = 'draft' THEN 'account'
    ELSE COALESCE(a.visibility, 'account')
  END
WHERE a.account_id IS NULL;

-- =======================
-- VERIFICATION
-- =======================

-- Check for any articles without account_id
DO $$
DECLARE
  orphan_count INTEGER;
  null_creator_count INTEGER;
BEGIN
  -- Count articles without account_id
  SELECT COUNT(*) INTO orphan_count
  FROM articles 
  WHERE account_id IS NULL;
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Found % articles without account_id', orphan_count;
    -- Log details for debugging
    RAISE WARNING 'Orphan article user_ids: %', 
      (SELECT string_agg(user_id::text, ', ') 
       FROM articles 
       WHERE account_id IS NULL 
       LIMIT 10);
  END IF;
  
  -- Count articles without created_by_user_id
  SELECT COUNT(*) INTO null_creator_count
  FROM articles 
  WHERE created_by_user_id IS NULL;
  
  IF null_creator_count > 0 THEN
    RAISE EXCEPTION 'Migration failed: % articles without created_by_user_id', null_creator_count;
  END IF;
END $$;

-- =======================
-- MAKE COLUMNS REQUIRED
-- =======================

-- Only make columns required if all data is migrated
DO $$
DECLARE
  can_make_required BOOLEAN;
BEGIN
  -- Check if we can make columns required
  SELECT COUNT(*) = 0 INTO can_make_required
  FROM articles 
  WHERE account_id IS NULL OR created_by_user_id IS NULL;
  
  IF can_make_required THEN
    -- Make account_id required
    ALTER TABLE articles
      ALTER COLUMN account_id SET NOT NULL;
    
    -- Make created_by_user_id required
    ALTER TABLE articles
      ALTER COLUMN created_by_user_id SET NOT NULL;
    
    RAISE NOTICE 'Successfully made account_id and created_by_user_id required';
  ELSE
    RAISE WARNING 'Cannot make columns required - some articles still have NULL values';
  END IF;
END $$;

-- =======================
-- MIGRATION STATS
-- =======================

-- Display migration statistics
SELECT 
  'Migration Summary' as info,
  COUNT(*) as total_articles,
  COUNT(account_id) as articles_with_account,
  COUNT(DISTINCT account_id) as unique_accounts,
  COUNT(*) FILTER (WHERE visibility = 'public') as public_articles,
  COUNT(*) FILTER (WHERE visibility = 'account') as account_articles,
  COUNT(*) FILTER (WHERE visibility = 'private') as private_articles
FROM articles;

COMMIT; 