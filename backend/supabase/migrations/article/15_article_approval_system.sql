-- =======================
-- MIGRATION: Article Approval System
-- Add pending_approval status and approval workflow
-- =======================

BEGIN;

-- Add new status 'pending_approval' to the existing status check constraint
ALTER TABLE articles 
DROP CONSTRAINT IF EXISTS articles_status_check;

ALTER TABLE articles 
ADD CONSTRAINT articles_status_check 
CHECK (status IN ('draft', 'published', 'archived', 'scheduled', 'pending_approval'));

-- Add approval-related columns
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at timestamptz,
ADD COLUMN IF NOT EXISTS rejection_reason text,
ADD COLUMN IF NOT EXISTS submitted_for_approval_at timestamptz;

-- Create function to submit article for approval
CREATE OR REPLACE FUNCTION submit_article_for_approval(article_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    article_record articles%ROWTYPE;
    result jsonb;
BEGIN
    -- Get the article
    SELECT * INTO article_record
    FROM articles
    WHERE id = article_id
    AND created_by_user_id = auth.uid();
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Article not found or you do not have permission to modify it'
        );
    END IF;
    
    -- Check if article is in draft status
    IF article_record.status != 'draft' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only draft articles can be submitted for approval'
        );
    END IF;
    
    -- Update article status to pending_approval
    UPDATE articles
    SET 
        status = 'pending_approval',
        submitted_for_approval_at = now(),
        approved_by = NULL,
        approved_at = NULL,
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = article_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Article submitted for approval successfully'
    );
END;
$$;

-- Create function to approve article (admin only)
CREATE OR REPLACE FUNCTION approve_article(article_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    article_record articles%ROWTYPE;
    is_admin boolean;
    result jsonb;
BEGIN
    -- Check if user is admin
    SELECT is_global_admin() INTO is_admin;
    
    IF NOT is_admin THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only administrators can approve articles'
        );
    END IF;
    
    -- Get the article
    SELECT * INTO article_record
    FROM articles
    WHERE id = article_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Article not found'
        );
    END IF;
    
    -- Check if article is pending approval
    IF article_record.status != 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Article is not pending approval'
        );
    END IF;
    
    -- Approve the article
    UPDATE articles
    SET 
        status = 'published',
        visibility = 'public',
        approved_by = auth.uid(),
        approved_at = now(),
        publish_date = now(),
        rejection_reason = NULL,
        updated_at = now()
    WHERE id = article_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Article approved and published successfully'
    );
END;
$$;

-- Create function to reject article (admin only)
CREATE OR REPLACE FUNCTION reject_article(article_id uuid, reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    article_record articles%ROWTYPE;
    is_admin boolean;
    result jsonb;
BEGIN
    -- Check if user is admin
    SELECT is_global_admin() INTO is_admin;
    
    IF NOT is_admin THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only administrators can reject articles'
        );
    END IF;
    
    -- Get the article
    SELECT * INTO article_record
    FROM articles
    WHERE id = article_id;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Article not found'
        );
    END IF;
    
    -- Check if article is pending approval
    IF article_record.status != 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Article is not pending approval'
        );
    END IF;
    
    -- Reject the article (return to draft)
    UPDATE articles
    SET 
        status = 'draft',
        visibility = 'account',
        approved_by = NULL,
        approved_at = NULL,
        rejection_reason = reason,
        updated_at = now()
    WHERE id = article_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'Article rejected and returned to draft'
    );
END;
$$;

-- Create function to get pending articles for admin
CREATE OR REPLACE FUNCTION get_pending_articles()
RETURNS TABLE (
    id uuid,
    title text,
    subtitle text,
    author text,
    category text,
    submitted_for_approval_at timestamptz,
    created_at timestamptz,
    created_by_user_id uuid,
    content text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    is_admin boolean;
BEGIN
    -- Check if user is admin
    SELECT is_global_admin() INTO is_admin;
    
    IF NOT is_admin THEN
        RAISE EXCEPTION 'Only administrators can view pending articles';
    END IF;
    
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.subtitle,
        a.author,
        a.category,
        a.submitted_for_approval_at,
        a.created_at,
        a.created_by_user_id,
        a.content
    FROM articles a
    WHERE a.status = 'pending_approval'
    ORDER BY a.submitted_for_approval_at DESC;
END;
$$;

-- Update RLS policies to handle pending_approval status
DROP POLICY IF EXISTS "Users can view articles" ON articles;
CREATE POLICY "Users can view articles" ON articles FOR SELECT USING (
    CASE 
        -- Own articles: always visible
        WHEN created_by_user_id = auth.uid() THEN true
        -- Public published articles: visible to all
        WHEN visibility = 'public' AND status = 'published' THEN true
        -- Account-level published articles: visible to authenticated users
        WHEN visibility = 'account' AND status = 'published' THEN auth.uid() IS NOT NULL
        -- Pending approval articles: only visible to admins and author
        WHEN status = 'pending_approval' THEN 
            created_by_user_id = auth.uid() OR is_global_admin()
        -- Default: not visible
        ELSE false
    END
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_status_pending ON articles(status) WHERE status = 'pending_approval';
CREATE INDEX IF NOT EXISTS idx_articles_submitted_approval_at ON articles(submitted_for_approval_at) WHERE submitted_for_approval_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_approved_by ON articles(approved_by) WHERE approved_by IS NOT NULL;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION submit_article_for_approval(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_article(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_article(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_articles() TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION submit_article_for_approval(uuid) IS 'Submit a draft article for admin approval';
COMMENT ON FUNCTION approve_article(uuid) IS 'Admin function to approve a pending article';
COMMENT ON FUNCTION reject_article(uuid, text) IS 'Admin function to reject a pending article with optional reason';
COMMENT ON FUNCTION get_pending_articles() IS 'Admin function to get all articles pending approval';

COMMIT; 