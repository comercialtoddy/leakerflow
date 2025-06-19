-- Migration: Update Articles RLS Policies for Basejump
-- Phase 3: Replace user-based policies with account-based policies
-- Date: 2024-01-XX
-- CRITICAL: This changes authorization from user-based to account-based

BEGIN;

-- =======================
-- DROP OLD POLICIES
-- =======================

-- Remove all existing user-based policies
DROP POLICY IF EXISTS "Users can view published articles or own articles" ON articles;
DROP POLICY IF EXISTS "Users can insert own articles" ON articles;
DROP POLICY IF EXISTS "Users can update own articles" ON articles;
DROP POLICY IF EXISTS "Users can delete own articles" ON articles;

-- =======================
-- CREATE NEW ACCOUNT-BASED POLICIES
-- =======================

-- Policy: View articles based on account membership and visibility
CREATE POLICY "articles_select_policy" ON articles
FOR SELECT USING (
  CASE 
    -- Public articles that are published can be viewed by anyone
    WHEN visibility = 'public' AND status = 'published' THEN true
    
    -- Account-visible articles can be viewed by account members
    WHEN visibility = 'account' THEN
      basejump.has_role_on_account(articles.account_id)
    
    -- Private articles can only be viewed by the author
    WHEN visibility = 'private' THEN
      created_by_user_id = auth.uid()
      
    -- Default deny
    ELSE false
  END
);

-- Policy: Create articles in accounts where user is a member
CREATE POLICY "articles_insert_policy" ON articles
FOR INSERT WITH CHECK (
  -- User must be a member of the account
  basejump.has_role_on_account(articles.account_id)
  -- AND the created_by_user_id must be the current user
  AND created_by_user_id = auth.uid()
);

-- Policy: Update articles based on role and authorship
CREATE POLICY "articles_update_policy" ON articles
FOR UPDATE USING (
  -- Either the author can edit their own articles
  (articles.created_by_user_id = auth.uid() AND basejump.has_role_on_account(articles.account_id))
  OR
  -- Or account owners can edit any article in their account
  basejump.has_role_on_account(articles.account_id, 'owner')
);

-- =======================
-- PROTECT IMMUTABLE FIELDS
-- =======================

-- Create a trigger to prevent changes to account_id and created_by_user_id
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

-- Policy: Delete articles based on role and authorship
CREATE POLICY "articles_delete_policy" ON articles
FOR DELETE USING (
  -- Either the author can delete if they're still a member
  (articles.created_by_user_id = auth.uid() AND basejump.has_role_on_account(articles.account_id))
  OR
  -- Or account owners can delete any article
  basejump.has_role_on_account(articles.account_id, 'owner')
);

-- =======================
-- PUBLISH PERMISSION POLICY
-- =======================

-- Create a separate view for checking publish permissions
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

-- Grant access to the view
GRANT SELECT ON article_publish_permissions TO authenticated;

-- =======================
-- UPDATE RELATED TABLES
-- =======================

-- Update article_votes policies if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'article_votes') THEN
    -- Drop old policies
    DROP POLICY IF EXISTS "Users can view all votes" ON article_votes;
    DROP POLICY IF EXISTS "Users can manage their own votes" ON article_votes;
    
    -- Create new policies that respect article visibility
    CREATE POLICY "article_votes_select_policy" ON article_votes
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM articles a
        WHERE a.id = article_votes.article_id
        AND (
          -- Can see votes on public published articles
          (a.visibility = 'public' AND a.status = 'published')
          OR
          -- Can see votes on articles in their accounts
          basejump.has_role_on_account(a.account_id)
          OR
          -- Can see votes on their own private articles
          (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
        )
      )
    );
    
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
          -- Can vote on articles in their accounts
          basejump.has_role_on_account(a.account_id)
          OR
          -- Can vote on their own private articles
          (a.visibility = 'private' AND a.created_by_user_id = auth.uid())
        )
      )
    );
    
    CREATE POLICY "article_votes_update_policy" ON article_votes
    FOR UPDATE USING (user_id = auth.uid());
    
    CREATE POLICY "article_votes_delete_policy" ON article_votes
    FOR DELETE USING (user_id = auth.uid());
  END IF;
END $$;

-- =======================
-- VERIFICATION
-- =======================

-- Verify policies were created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'articles'
  AND policyname IN (
    'articles_select_policy',
    'articles_insert_policy',
    'articles_update_policy',
    'articles_delete_policy'
  );
  
  IF policy_count != 4 THEN
    RAISE EXCEPTION 'Not all policies were created. Found % policies', policy_count;
  END IF;
  
  RAISE NOTICE 'Successfully created % article policies', policy_count;
END $$;

COMMIT; 