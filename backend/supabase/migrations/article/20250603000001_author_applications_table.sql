-- =======================================================================
-- MIGRATION: Author Applications Table
-- Task 6: Database Schema for Author Applications
-- Created: 2025-06-03
-- =======================================================================

BEGIN;

-- =======================================================================
-- 1. CREATE AUTHOR_APPLICATIONS TABLE
-- =======================================================================

-- Table to manage user applications to become authors in the Articles Dashboard
CREATE TABLE IF NOT EXISTS author_applications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Application details
    full_name text NOT NULL,
    email text NOT NULL,
    bio text,
    writing_experience text,
    portfolio_links text[],
    motivation text NOT NULL,
    
    -- Application status
    status text NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'approved', 'rejected', 'under_review')
    ),
    
    -- Review information
    reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at timestamptz,
    review_notes text,
    rejection_reason text,
    
    -- Metadata
    submitted_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    
    -- Constraints
    UNIQUE(user_id), -- Each user can have only one application
    
    -- Ensure review fields are consistent
    CONSTRAINT review_consistency CHECK (
        (status IN ('pending', 'under_review') AND reviewed_by IS NULL AND reviewed_at IS NULL) OR
        (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    )
);

-- =======================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =======================================================================

CREATE INDEX IF NOT EXISTS idx_author_applications_user_id ON author_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_author_applications_status ON author_applications(status);
CREATE INDEX IF NOT EXISTS idx_author_applications_submitted_at ON author_applications(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_author_applications_reviewed_by ON author_applications(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_author_applications_reviewed_at ON author_applications(reviewed_at DESC);

-- =======================================================================
-- 3. CREATE TRIGGERS FOR AUTOMATIC UPDATES
-- =======================================================================

-- Apply updated_at trigger to author_applications
CREATE TRIGGER update_author_applications_updated_at 
    BEFORE UPDATE ON author_applications 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =======================================================================
-- 4. CREATE FUNCTIONS FOR APPLICATION MANAGEMENT
-- =======================================================================

-- Function to submit an author application
CREATE OR REPLACE FUNCTION submit_author_application(
    p_full_name text,
    p_email text,
    p_bio text DEFAULT NULL,
    p_writing_experience text DEFAULT NULL,
    p_portfolio_links text[] DEFAULT NULL,
    p_motivation text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    application_id uuid;
    current_user_id uuid;
BEGIN
    -- Get current authenticated user
    current_user_id := auth.uid();
    
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'User must be authenticated to submit an application';
    END IF;
    
    -- Check if user already has an application
    IF EXISTS(SELECT 1 FROM author_applications WHERE user_id = current_user_id) THEN
        RAISE EXCEPTION 'User already has an author application. Only one application per user is allowed.';
    END IF;
    
    -- Validate required fields
    IF p_full_name IS NULL OR trim(p_full_name) = '' THEN
        RAISE EXCEPTION 'Full name is required';
    END IF;
    
    IF p_email IS NULL OR trim(p_email) = '' THEN
        RAISE EXCEPTION 'Email is required';
    END IF;
    
    IF p_motivation IS NULL OR trim(p_motivation) = '' THEN
        RAISE EXCEPTION 'Motivation is required';
    END IF;
    
    -- Insert application
    INSERT INTO author_applications (
        user_id, full_name, email, bio, writing_experience, 
        portfolio_links, motivation, status
    ) VALUES (
        current_user_id, p_full_name, p_email, p_bio, p_writing_experience,
        p_portfolio_links, p_motivation, 'pending'
    ) RETURNING id INTO application_id;
    
    RETURN application_id;
END;
$$;

-- Function to review an author application (admin only)
CREATE OR REPLACE FUNCTION review_author_application(
    p_application_id uuid,
    p_status text,
    p_review_notes text DEFAULT NULL,
    p_rejection_reason text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    reviewing_user_id uuid;
    app_user_id uuid;
BEGIN
    -- Get current authenticated user
    reviewing_user_id := auth.uid();
    
    -- Only global admins can review applications
    IF NOT is_global_admin(reviewing_user_id) THEN
        RAISE EXCEPTION 'Access denied: Only global administrators can review author applications';
    END IF;
    
    -- Validate status
    IF p_status NOT IN ('approved', 'rejected', 'under_review', 'pending') THEN
        RAISE EXCEPTION 'Invalid status. Must be: approved, rejected, under_review, or pending';
    END IF;
    
    -- For rejection, require rejection reason
    IF p_status = 'rejected' AND (p_rejection_reason IS NULL OR trim(p_rejection_reason) = '') THEN
        RAISE EXCEPTION 'Rejection reason is required when rejecting an application';
    END IF;
    
    -- Get application user_id for potential account creation
    SELECT user_id INTO app_user_id
    FROM author_applications 
    WHERE id = p_application_id;
    
    IF app_user_id IS NULL THEN
        RAISE EXCEPTION 'Application not found';
    END IF;
    
    -- Update application
    UPDATE author_applications SET
        status = p_status,
        reviewed_by = reviewing_user_id,
        reviewed_at = now(),
        review_notes = p_review_notes,
        rejection_reason = CASE WHEN p_status = 'rejected' THEN p_rejection_reason ELSE NULL END
    WHERE id = p_application_id;
    
    -- If approved, grant user access to create articles (give them author account role)
    IF p_status = 'approved' THEN
        -- Create a personal account for the new author if they don't have one
        PERFORM ensure_author_account_access(app_user_id);
    END IF;
    
    RETURN FOUND;
END;
$$;

-- Function to ensure approved author has proper account access
CREATE OR REPLACE FUNCTION ensure_author_account_access(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_account_id uuid;
BEGIN
    -- Check if user already has a personal account
    SELECT au.account_id INTO user_account_id
    FROM basejump.account_user au
    JOIN basejump.accounts a ON a.id = au.account_id
    WHERE au.user_id = p_user_id 
    AND a.personal_account = true
    LIMIT 1;
    
    -- If no personal account exists, create one
    IF user_account_id IS NULL THEN
        INSERT INTO basejump.accounts (name, slug, personal_account, created_by, updated_by)
        SELECT 
            COALESCE(u.raw_user_meta_data->>'full_name', 'Author ' || u.email),
            'author-' || p_user_id,
            true,
            p_user_id,
            p_user_id
        FROM auth.users u
        WHERE u.id = p_user_id
        RETURNING id INTO user_account_id;
        
        -- Associate user with their new personal account as owner
        INSERT INTO basejump.account_user (account_id, user_id, account_role)
        VALUES (user_account_id, p_user_id, 'owner');
    END IF;
    
    -- Ensure user has author privileges (this could be extended later)
    -- For now, having a personal account is sufficient for article creation
END;
$$;

-- Function to get user's application status
CREATE OR REPLACE FUNCTION get_user_application_status(p_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    check_user_id uuid;
    application_data jsonb;
BEGIN
    check_user_id := COALESCE(p_user_id, auth.uid());
    
    IF check_user_id IS NULL THEN
        RETURN jsonb_build_object('has_application', false, 'message', 'User not authenticated');
    END IF;
    
    SELECT jsonb_build_object(
        'has_application', true,
        'application_id', aa.id,
        'status', aa.status,
        'submitted_at', aa.submitted_at,
        'reviewed_at', aa.reviewed_at,
        'review_notes', aa.review_notes,
        'rejection_reason', aa.rejection_reason,
        'can_resubmit', (aa.status = 'rejected' AND aa.reviewed_at < now() - INTERVAL '30 days')
    ) INTO application_data
    FROM author_applications aa
    WHERE aa.user_id = check_user_id;
    
    IF application_data IS NULL THEN
        application_data := jsonb_build_object(
            'has_application', false, 
            'can_submit', true,
            'message', 'No application found'
        );
    END IF;
    
    RETURN application_data;
END;
$$;

-- Function to list all applications (admin only)
CREATE OR REPLACE FUNCTION list_author_applications(
    p_status text DEFAULT NULL,
    p_limit integer DEFAULT 50,
    p_offset integer DEFAULT 0
)
RETURNS TABLE (
    id uuid,
    user_id uuid,
    user_email text,
    full_name text,
    email text,
    bio text,
    writing_experience text,
    portfolio_links text[],
    motivation text,
    status text,
    submitted_at timestamptz,
    reviewed_by uuid,
    reviewed_at timestamptz,
    review_notes text,
    rejection_reason text,
    reviewer_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only global admins can list applications
    IF NOT is_global_admin() THEN
        RAISE EXCEPTION 'Access denied: Only global administrators can list author applications';
    END IF;
    
    RETURN QUERY
    SELECT 
        aa.id,
        aa.user_id,
        u.email as user_email,
        aa.full_name,
        aa.email,
        aa.bio,
        aa.writing_experience,
        aa.portfolio_links,
        aa.motivation,
        aa.status,
        aa.submitted_at,
        aa.reviewed_by,
        aa.reviewed_at,
        aa.review_notes,
        aa.rejection_reason,
        r.email as reviewer_email
    FROM author_applications aa
    JOIN auth.users u ON u.id = aa.user_id
    LEFT JOIN auth.users r ON r.id = aa.reviewed_by
    WHERE (p_status IS NULL OR aa.status = p_status)
    ORDER BY 
        CASE aa.status 
            WHEN 'pending' THEN 1 
            WHEN 'under_review' THEN 2 
            WHEN 'approved' THEN 3 
            WHEN 'rejected' THEN 4 
        END,
        aa.submitted_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- =======================================================================
-- 5. PERMISSIONS AND SECURITY
-- =======================================================================

-- Enable RLS on author_applications table
ALTER TABLE author_applications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own application
CREATE POLICY "Users can view own application" ON author_applications
FOR SELECT USING (user_id = auth.uid());

-- Policy: Users can insert their own application
CREATE POLICY "Users can submit application" ON author_applications
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own pending application
CREATE POLICY "Users can update own pending application" ON author_applications
FOR UPDATE USING (
    user_id = auth.uid() 
    AND status = 'pending'
);

-- Policy: Global admins can view all applications
CREATE POLICY "Global admins can view all applications" ON author_applications
FOR SELECT USING (is_global_admin());

-- Policy: Global admins can update applications for review
CREATE POLICY "Global admins can review applications" ON author_applications
FOR UPDATE USING (is_global_admin());

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON author_applications TO authenticated;
GRANT EXECUTE ON FUNCTION submit_author_application(text, text, text, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION review_author_application(uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_author_account_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_application_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION list_author_applications(text, integer, integer) TO authenticated;

-- =======================================================================
-- 6. COMMENTS AND DOCUMENTATION
-- =======================================================================

COMMENT ON TABLE author_applications IS 'Applications from users requesting access to become authors in the Articles Dashboard';
COMMENT ON COLUMN author_applications.user_id IS 'Reference to auth.users - the applicant';
COMMENT ON COLUMN author_applications.status IS 'Application status: pending, approved, rejected, under_review';
COMMENT ON COLUMN author_applications.reviewed_by IS 'Global admin who reviewed the application';
COMMENT ON COLUMN author_applications.portfolio_links IS 'Array of URLs to applicant''s writing portfolio';
COMMENT ON COLUMN author_applications.motivation IS 'Why the user wants to become an author';

COMMENT ON FUNCTION submit_author_application(text, text, text, text, text[], text) IS 'Submit a new author application';
COMMENT ON FUNCTION review_author_application(uuid, text, text, text) IS 'Review an author application (admin only)';
COMMENT ON FUNCTION get_user_application_status(uuid) IS 'Get application status for a user';
COMMENT ON FUNCTION list_author_applications(text, integer, integer) IS 'List all applications (admin only)';

-- =======================================================================
-- 7. VERIFICATION AND TESTING
-- =======================================================================

-- Test function to verify table creation and constraints
CREATE OR REPLACE FUNCTION test_author_applications_table()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    test_results jsonb;
    table_exists boolean;
    unique_constraint_exists boolean;
    default_status_test boolean;
    function_count integer;
BEGIN
    -- Check if table exists
    SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'author_applications'
    ) INTO table_exists;
    
    -- Check if unique constraint on user_id exists
    SELECT EXISTS(
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'author_applications' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%user_id%'
    ) INTO unique_constraint_exists;
    
    -- Check default status
    SELECT EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'author_applications' 
        AND column_name = 'status'
        AND column_default LIKE '%pending%'
    ) INTO default_status_test;
    
    -- Count related functions
    SELECT COUNT(*) INTO function_count
    FROM pg_proc 
    WHERE proname IN (
        'submit_author_application',
        'review_author_application', 
        'get_user_application_status',
        'list_author_applications',
        'ensure_author_account_access'
    );
    
    test_results := jsonb_build_object(
        'table_exists', table_exists,
        'unique_constraint_exists', unique_constraint_exists,
        'default_status_pending', default_status_test,
        'functions_created', function_count,
        'functions_expected', 5,
        'test_timestamp', now()
    );
    
    RETURN test_results;
END;
$$;

GRANT EXECUTE ON FUNCTION test_author_applications_table() TO authenticated;

-- =======================================================================
-- 8. FINAL VERIFICATION
-- =======================================================================

DO $$
DECLARE
    verification_result jsonb;
BEGIN
    -- Run verification test
    SELECT test_author_applications_table() INTO verification_result;
    
    -- Log results
    RAISE NOTICE 'Author applications table verification: %', verification_result;
    
    -- Check critical components
    IF NOT (verification_result->>'table_exists')::boolean THEN
        RAISE WARNING 'author_applications table was not created';
    END IF;
    
    IF NOT (verification_result->>'unique_constraint_exists')::boolean THEN
        RAISE WARNING 'Unique constraint on user_id was not created';
    END IF;
    
    IF NOT (verification_result->>'default_status_pending')::boolean THEN
        RAISE WARNING 'Default status was not set to pending';
    END IF;
    
    IF (verification_result->>'functions_created')::integer < 5 THEN
        RAISE WARNING 'Not all required functions were created';
    END IF;
    
    RAISE NOTICE '✅ Author applications table migration completed successfully!';
    RAISE NOTICE '📋 Next steps:';
    RAISE NOTICE '   1. Test with: SELECT test_author_applications_table();';
    RAISE NOTICE '   2. Test application submission: SELECT submit_author_application(''Test Name'', ''test@example.com'', ''Bio'', ''Experience'', ARRAY[''https://portfolio.com''], ''Motivation'');';
    RAISE NOTICE '   3. Test application listing: SELECT * FROM list_author_applications();';
END $$;

COMMIT; 