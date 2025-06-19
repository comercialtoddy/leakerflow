-- Migration: Add Basejump integration to Articles
-- Phase 1: Add new columns and indexes
-- Date: 2024-01-XX
-- CRITICAL: This migration adds multi-tenant support to articles

BEGIN;

-- =======================
-- ADD NEW COLUMNS
-- =======================

-- Add account_id to link articles to accounts (initially nullable)
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES basejump.accounts(id);

-- Add created_by_user_id to track the actual creator (different from user_id)
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id);

-- Add visibility to control access levels
ALTER TABLE articles 
  ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'account';

-- Add constraint for visibility values
ALTER TABLE articles 
  ADD CONSTRAINT articles_visibility_check 
  CHECK (visibility IN ('private', 'account', 'public'));

-- =======================
-- CREATE INDEXES
-- =======================

-- Index for account-based queries (critical for performance)
CREATE INDEX IF NOT EXISTS idx_articles_account_id ON articles(account_id);

-- Index for author queries
CREATE INDEX IF NOT EXISTS idx_articles_created_by_user_id ON articles(created_by_user_id);

-- Index for visibility filtering
CREATE INDEX IF NOT EXISTS idx_articles_visibility ON articles(visibility);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_articles_account_visibility ON articles(account_id, visibility, status);
CREATE INDEX IF NOT EXISTS idx_articles_account_created_at ON articles(account_id, created_at DESC);

-- =======================
-- ADD COMMENTS
-- =======================

COMMENT ON COLUMN articles.account_id IS 'The account (personal or team) that owns this article';
COMMENT ON COLUMN articles.created_by_user_id IS 'The user who created this article (author)';
COMMENT ON COLUMN articles.visibility IS 'Access level: private (author only), account (team members), public (everyone)';

-- =======================
-- VERIFICATION
-- =======================

-- Verify columns were added
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'articles' AND column_name = 'account_id') THEN
    RAISE EXCEPTION 'Failed to add account_id column';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'articles' AND column_name = 'created_by_user_id') THEN
    RAISE EXCEPTION 'Failed to add created_by_user_id column';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'articles' AND column_name = 'visibility') THEN
    RAISE EXCEPTION 'Failed to add visibility column';
  END IF;
END $$;

COMMIT; 