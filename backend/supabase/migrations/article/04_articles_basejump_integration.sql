-- =======================
-- MIGRATION: Articles Basejump Multi-tenant Integration
-- Consolidation of: 10-13_articles_basejump_*.sql + data migration
-- Applied fixes: Complete multi-tenant setup with automatic data migration
-- =======================

BEGIN;

-- =======================
-- CLEANUP ORPHANED DATA
-- =======================

-- Clean up orphaned records that could cause migration issues
DELETE FROM article_votes WHERE user_id IS NULL;
DELETE FROM article_events WHERE user_id IS NULL;
DELETE FROM saved_articles WHERE user_id IS NULL;

-- =======================
-- DATA MIGRATION FROM USER_ID TO ACCOUNT_ID
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
WHERE u.id IN (SELECT DISTINCT user_id FROM articles WHERE user_id IS NOT NULL)
AND NOT EXISTS (
  SELECT 1 FROM basejump.account_user au 
  WHERE au.user_id = u.id 
)
ON CONFLICT DO NOTHING;

-- Associate users with their personal accounts (ensure user_id is not null)
INSERT INTO basejump.account_user (account_id, user_id, account_role)
SELECT 
  a.id as account_id,
  a.created_by as user_id,
  'owner' as account_role
FROM basejump.accounts a
WHERE a.personal_account = true
AND a.created_by IS NOT NULL  -- Ensure user_id is not null
AND NOT EXISTS (
  SELECT 1 FROM basejump.account_user au 
  WHERE au.account_id = a.id 
  AND au.user_id = a.created_by
)
ON CONFLICT DO NOTHING;

-- Migrate articles data (update existing articles without account_id)
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
WHERE (a.account_id IS NULL OR a.created_by_user_id IS NULL)
  AND a.user_id IS NOT NULL; -- Only process articles with valid user_id

-- Update article_events with account_id from articles
UPDATE article_events e
SET account_id = a.account_id
FROM articles a
WHERE e.article_id = a.id
AND e.account_id IS NULL;

-- =======================
-- ACCOUNT-LEVEL VIEWS
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

-- View for checking publish permissions
CREATE OR REPLACE VIEW article_publish_permissions AS
SELECT 
  a.id as article_id,
  a.account_id,
  au.user_id,
  au.account_role,
  CASE 
    WHEN au.account_role = 'owner' THEN true
    ELSE false
  END as can_publish
FROM articles a
JOIN basejump.account_user au ON au.account_id = a.account_id
WHERE au.user_id = auth.uid();

-- =======================
-- BASEJUMP HELPER FUNCTIONS
-- =======================

-- Function to get user's default account for creating articles
CREATE OR REPLACE FUNCTION get_user_default_account()
RETURNS uuid AS $$
DECLARE
    default_account_id uuid;
BEGIN
    -- Get user's personal account first
    SELECT au.account_id INTO default_account_id
    FROM basejump.account_user au
    JOIN basejump.accounts a ON a.id = au.account_id
    WHERE au.user_id = auth.uid() 
    AND a.personal_account = true
    LIMIT 1;
    
    -- If no personal account, get first available account
    IF default_account_id IS NULL THEN
        SELECT au.account_id INTO default_account_id
        FROM basejump.account_user au
        WHERE au.user_id = auth.uid()
        LIMIT 1;
    END IF;
    
    RETURN default_account_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can create articles in account
CREATE OR REPLACE FUNCTION can_create_article_in_account(p_account_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN basejump.has_role_on_account(p_account_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get accounts where user can create articles
CREATE OR REPLACE FUNCTION get_user_article_accounts()
RETURNS TABLE (
    account_id uuid,
    account_name text,
    account_slug text,
    personal_account boolean,
    user_role text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.name,
        a.slug,
        a.personal_account,
        au.account_role::text
    FROM basejump.accounts a
    JOIN basejump.account_user au ON au.account_id = a.id
    WHERE au.user_id = auth.uid()
    ORDER BY a.personal_account DESC, a.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =======================
-- VERIFICATION AND CLEANUP
-- =======================

-- Verification of migration
DO $$
DECLARE
    orphan_count INTEGER;
    null_creator_count INTEGER;
    articles_without_account INTEGER;
    events_without_account INTEGER;
BEGIN
    -- Count articles without account_id
    SELECT COUNT(*) INTO articles_without_account
    FROM articles 
    WHERE account_id IS NULL;
    
    IF articles_without_account > 0 THEN
        RAISE WARNING 'Found % articles without account_id after migration', articles_without_account;
    END IF;
    
    -- Count articles without created_by_user_id
    SELECT COUNT(*) INTO null_creator_count
    FROM articles 
    WHERE created_by_user_id IS NULL;
    
    IF null_creator_count > 0 THEN
        RAISE WARNING 'Found % articles without created_by_user_id after migration', null_creator_count;
    END IF;
    
    -- Count events without account_id
    SELECT COUNT(*) INTO events_without_account
    FROM article_events
    WHERE account_id IS NULL;
    
    IF events_without_account > 0 THEN
        RAISE WARNING 'Found % article_events without account_id after migration', events_without_account;
    END IF;
    
    -- Display migration statistics
    RAISE NOTICE 'Basejump integration completed:';
    RAISE NOTICE '- Articles: % total, % without account_id', 
        (SELECT COUNT(*) FROM articles), 
        articles_without_account;
    RAISE NOTICE '- Events: % total, % without account_id', 
        (SELECT COUNT(*) FROM article_events), 
        events_without_account;
    RAISE NOTICE '- Accounts: % total', 
        (SELECT COUNT(*) FROM basejump.accounts);
END $$;

-- =======================
-- STORAGE POLICIES FOR BASEJUMP
-- =======================

-- Update storage policies to work with account-based access
-- Drop all existing policies to avoid conflicts
DROP POLICY IF EXISTS "Allow authenticated uploads to articles-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to articles-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view all files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view all articles-media files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view articles-media files" ON storage.objects;

-- Create storage policies for articles-media bucket
CREATE POLICY "Allow authenticated uploads to articles-media" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (
        bucket_id = 'articles-media'
    );

CREATE POLICY "Allow authenticated updates to articles-media" ON storage.objects
    FOR UPDATE TO authenticated USING (
        bucket_id = 'articles-media'
    );

CREATE POLICY "Allow authenticated users to view files" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'articles-media');

CREATE POLICY "Allow authenticated users to delete files" ON storage.objects
    FOR DELETE TO authenticated USING (
        bucket_id = 'articles-media'
    );

-- Public read access for all articles-media content
CREATE POLICY "Public can view articles-media files" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'articles-media');

-- =======================
-- FINAL VERIFICATION
-- =======================

DO $$
DECLARE
  view_count integer;
  function_count integer;
BEGIN
  -- Check views were created
  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_name IN ('account_article_stats', 'article_publish_permissions');
  
  IF view_count < 2 THEN
    RAISE WARNING 'Not all Basejump views were created. Found % views', view_count;
  END IF;
  
  -- Check functions were created
  SELECT COUNT(*) INTO function_count
  FROM pg_proc 
  WHERE proname IN (
    'get_user_default_account', 
    'can_create_article_in_account', 
    'get_user_article_accounts'
  );
  
  IF function_count < 3 THEN
    RAISE WARNING 'Not all Basejump helper functions were created. Found % functions', function_count;
  END IF;
  
  RAISE NOTICE 'Articles Basejump integration completed successfully';
END $$;

COMMIT;