-- Articles Storage Configuration
-- This migration sets up storage buckets and policies for article media

-- =======================
-- STORAGE BUCKET SETUP
-- =======================

-- Create storage bucket for articles media (images/videos up to 15MB)
INSERT INTO storage.buckets (id, name, public)
VALUES ('articles-media', 'articles-media', true)
ON CONFLICT (id) DO NOTHING;

-- Set file size limit to 15MB (15,728,640 bytes)
UPDATE storage.buckets 
SET file_size_limit = 15728640 
WHERE id = 'articles-media';

-- =======================
-- STORAGE POLICIES
-- =======================

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view published files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to articles-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to articles-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to view all files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view all articles-media files" ON storage.objects;

-- Create new storage policies for articles-media bucket
CREATE POLICY "Allow authenticated uploads to articles-media" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'articles-media');

CREATE POLICY "Allow authenticated updates to articles-media" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'articles-media');

CREATE POLICY "Allow authenticated users to view all files" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'articles-media');

CREATE POLICY "Allow authenticated users to delete their files" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'articles-media');

-- Public read access for all content (since it's article content)
CREATE POLICY "Public can view all articles-media files" ON storage.objects
    FOR SELECT TO public USING (bucket_id = 'articles-media');

-- =======================
-- STORAGE CLEANUP FUNCTION
-- =======================

-- Function to help cleanup storage when article is deleted
CREATE OR REPLACE FUNCTION cleanup_article_storage()
RETURNS TRIGGER AS $$
BEGIN
    -- This function is called when an article is deleted
    -- The actual storage cleanup happens in the application layer
    -- This is a placeholder for future storage cleanup enhancements
    
    -- Log the deletion for debugging
    RAISE NOTICE 'Article % deleted, storage cleanup may be needed for paths: %, %, %, %', 
        OLD.id, 
        OLD.content_storage_path,
        OLD.sections_storage_path,
        OLD.media_items_storage_path,
        OLD.sources_storage_path;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create or replace trigger for storage cleanup
DROP TRIGGER IF EXISTS cleanup_article_storage_trigger ON articles;
CREATE TRIGGER cleanup_article_storage_trigger
    BEFORE DELETE ON articles
    FOR EACH ROW EXECUTE FUNCTION cleanup_article_storage(); 