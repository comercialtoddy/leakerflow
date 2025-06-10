-- Articles table for Discover platform
-- Auto-cleanup after 1 week using Row Level Security and periodic cleanup

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create articles table
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
  
  -- Metadata
  read_time text NOT NULL,
  image_url text,
  views integer DEFAULT 0,
  engagement numeric(5,2) DEFAULT 0,
  bookmarked boolean DEFAULT false,
  
  -- Publishing
  publish_date timestamptz,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Auto-cleanup constraint (articles older than 1 week will be cleaned up)
  CONSTRAINT valid_article_age CHECK (created_at > now() - interval '1 week' OR status = 'published')
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_articles_publish_date ON articles(publish_date DESC);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_articles_updated_at ON articles;
CREATE TRIGGER update_articles_updated_at 
    BEFORE UPDATE ON articles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view published articles or own articles" ON articles;
DROP POLICY IF EXISTS "Users can insert own articles" ON articles;
DROP POLICY IF EXISTS "Users can update own articles" ON articles;
DROP POLICY IF EXISTS "Users can delete own articles" ON articles;

-- Policy: Users can see published articles and their own articles
CREATE POLICY "Users can view published articles or own articles" ON articles
    FOR SELECT USING (
        status = 'published' OR 
        auth.uid() = user_id
    );

-- Policy: Users can insert their own articles
CREATE POLICY "Users can insert own articles" ON articles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own articles
CREATE POLICY "Users can update own articles" ON articles
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own articles
CREATE POLICY "Users can delete own articles" ON articles
    FOR DELETE USING (auth.uid() = user_id);

-- Function to auto-cleanup old articles (run daily via cron)
CREATE OR REPLACE FUNCTION cleanup_old_articles()
RETURNS void AS $$
BEGIN
    DELETE FROM articles 
    WHERE created_at < now() - interval '1 week' 
    AND status != 'published';
    
    -- Log cleanup
    RAISE NOTICE 'Cleaned up old articles at %', now();
END;
$$ LANGUAGE plpgsql;

-- Function to increment article views
CREATE OR REPLACE FUNCTION increment_article_views(article_id uuid)
RETURNS void AS $$
BEGIN
    UPDATE articles 
    SET views = views + 1 
    WHERE id = article_id;
END;
$$ LANGUAGE plpgsql;

-- Function to toggle bookmark status
CREATE OR REPLACE FUNCTION toggle_article_bookmark(article_id uuid)
RETURNS boolean AS $$
DECLARE
    new_bookmark_status boolean;
BEGIN
    UPDATE articles 
    SET bookmarked = NOT bookmarked 
    WHERE id = article_id
    RETURNING bookmarked INTO new_bookmark_status;
    
    RETURN new_bookmark_status;
END;
$$ LANGUAGE plpgsql;

-- Function to get articles with pagination
CREATE OR REPLACE FUNCTION get_articles_paginated(
    page_size integer DEFAULT 10,
    page_offset integer DEFAULT 0,
    filter_status text DEFAULT 'published',
    filter_category text DEFAULT NULL
)
RETURNS TABLE (
    id uuid,
    title text,
    subtitle text,
    content text,
    category text,
    tags text[],
    author text,
    status text,
    media_items jsonb,
    sources jsonb,
    read_time text,
    image_url text,
    views integer,
    engagement numeric,
    bookmarked boolean,
    publish_date timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    total_count bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.title,
        a.subtitle,
        a.content,
        a.category,
        a.tags,
        a.author,
        a.status,
        a.media_items,
        a.sources,
        a.read_time,
        a.image_url,
        a.views,
        a.engagement,
        a.bookmarked,
        a.publish_date,
        a.created_at,
        a.updated_at,
        COUNT(*) OVER() as total_count
    FROM articles a
    WHERE 
        (filter_status IS NULL OR a.status = filter_status) AND
        (filter_category IS NULL OR a.category = filter_category) AND
        (a.status = 'published' OR a.user_id = auth.uid())
    ORDER BY 
        CASE WHEN a.status = 'published' THEN a.publish_date ELSE a.created_at END DESC
    LIMIT page_size
    OFFSET page_offset;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing (will be auto-cleaned after 1 week)
INSERT INTO articles (
    title, 
    subtitle, 
    content, 
    category, 
    tags, 
    author, 
    status, 
    read_time, 
    image_url,
    views,
    engagement,
    user_id
) VALUES 
(
    'Welcome to Articles Dashboard',
    'This is a sample article to demonstrate the new articles system.',
    'This article demonstrates the new articles management system integrated with Supabase. All articles are now stored in the database and will be automatically cleaned up after one week unless published.',
    'AI & Automation',
    ARRAY['Welcome', 'System', 'Database'],
    'System',
    'published',
    '2 min read',
    '/api/placeholder/800/400',
    1250,
    92.5,
    (SELECT id FROM auth.users LIMIT 1)
);

-- Enable real-time subscriptions for articles (only if not already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'articles'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE articles;
    END IF;
END $$;

-- Create notification function for real-time updates
CREATE OR REPLACE FUNCTION notify_article_changes()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'article_changes',
        json_build_object(
            'operation', TG_OP,
            'record', row_to_json(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END)
        )::text
    );
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for real-time notifications
DROP TRIGGER IF EXISTS article_changes_trigger ON articles;
CREATE TRIGGER article_changes_trigger
    AFTER INSERT OR UPDATE OR DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION notify_article_changes();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON articles TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON articles TO authenticated;
GRANT SELECT ON articles TO anon; 

-- =======================
-- STORAGE BUCKET SETUP
-- =======================

-- Create storage bucket for articles media (images/videos up to 15MB)
INSERT INTO storage.buckets (id, name, public)
VALUES ('articles-media', 'articles-media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies first
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view published files" ON storage.objects;

-- Storage policies for articles-media bucket
CREATE POLICY "Authenticated users can upload files" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'articles-media');

CREATE POLICY "Authenticated users can view files" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'articles-media');

CREATE POLICY "Users can update their own files" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'articles-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'articles-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read access for published content
CREATE POLICY "Public can view published files" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'articles-media');

-- Set file size limit to 15MB (15,728,640 bytes)
UPDATE storage.buckets 
SET file_size_limit = 15728640 
WHERE id = 'articles-media'; 