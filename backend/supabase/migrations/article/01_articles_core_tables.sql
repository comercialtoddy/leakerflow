-- Articles Core Tables and Indexes
-- This migration creates the main tables structure for the articles system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =======================
-- MAIN ARTICLES TABLE
-- =======================

-- Create articles table with all fields including saved column
CREATE TABLE IF NOT EXISTS articles (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  title text NOT NULL,
  subtitle text NOT NULL,
  content text NOT NULL,
  category text NOT NULL,
  tags text[] DEFAULT '{}',
  author text NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived', 'scheduled')),
  
  -- Media and sources as JSONB for flexibility
  media_items jsonb DEFAULT '[]',
  sources jsonb DEFAULT '[]',
  
  -- Article sections for modular content
  sections jsonb DEFAULT '[]',
  
  -- Metadata
  read_time text NOT NULL,
  image_url text,
  views integer DEFAULT 0,
  engagement numeric(5,2) DEFAULT 0,
  bookmarked boolean DEFAULT false, -- Legacy field for backward compatibility
  saved boolean DEFAULT false, -- New field to replace bookmarked
  
  -- Voting system (Reddit-style)
  upvotes integer DEFAULT 0,
  downvotes integer DEFAULT 0,
  vote_score integer DEFAULT 0, -- upvotes - downvotes
  trend_score numeric(10,2) DEFAULT 0, -- calculated trend score for Trends section
  is_trending boolean DEFAULT false, -- flag for articles that qualify for Trends
  
  -- Advanced metrics (calculated from events)
  total_views integer DEFAULT 0,
  unique_views integer DEFAULT 0,
  total_shares integer DEFAULT 0,
  total_saves integer DEFAULT 0,
  total_comments integer DEFAULT 0,
  avg_read_time numeric(8,2) DEFAULT 0,
  bounce_rate numeric(5,2) DEFAULT 0,
  
  -- Publishing
  publish_date timestamptz,
  
  -- Hybrid storage support columns
  content_storage_path text,
  content_size integer,
  sections_storage_path text,
  media_items_storage_path text,
  sources_storage_path text,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Auto-cleanup constraint (articles older than 1 week will be cleaned up)
  CONSTRAINT valid_article_age CHECK (created_at > now() - interval '1 week' OR status = 'published')
);

-- Add comments on storage columns
COMMENT ON COLUMN articles.content_storage_path IS 'Path to content stored in Supabase Storage for large articles';
COMMENT ON COLUMN articles.content_size IS 'Original content size in characters';
COMMENT ON COLUMN articles.sections_storage_path IS 'Path to sections stored in Supabase Storage for large section arrays';
COMMENT ON COLUMN articles.media_items_storage_path IS 'Path to media items stored in Supabase Storage for large media arrays';
COMMENT ON COLUMN articles.sources_storage_path IS 'Path to sources stored in Supabase Storage for large source arrays';
COMMENT ON COLUMN articles.saved IS 'Whether the article is saved by the user';

-- =======================
-- INDEXES
-- =======================

-- Performance indexes for articles table
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date DESC);
CREATE INDEX IF NOT EXISTS idx_articles_trend_score ON articles(trend_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_trending ON articles(is_trending);
CREATE INDEX IF NOT EXISTS idx_articles_vote_score ON articles(vote_score DESC);
CREATE INDEX IF NOT EXISTS idx_articles_saved ON articles(saved) WHERE saved = true;

-- =======================
-- TRIGGERS
-- =======================

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to articles
CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =======================
-- ROW LEVEL SECURITY
-- =======================

-- Enable RLS on articles table
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Article policies
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