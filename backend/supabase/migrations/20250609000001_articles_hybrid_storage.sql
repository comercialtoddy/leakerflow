-- Add hybrid storage columns for sections, media_items, and sources
-- This migration extends the articles table to support storing large JSONB fields in Supabase Storage

-- Add storage path columns for large JSONB fields
DO $$
BEGIN
    -- Add sections_storage_path column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'articles' AND column_name = 'sections_storage_path') THEN
        ALTER TABLE articles ADD COLUMN sections_storage_path text;
        COMMENT ON COLUMN articles.sections_storage_path IS 'Path to sections stored in Supabase Storage for large section arrays';
    END IF;
    
    -- Add media_items_storage_path column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'articles' AND column_name = 'media_items_storage_path') THEN
        ALTER TABLE articles ADD COLUMN media_items_storage_path text;
        COMMENT ON COLUMN articles.media_items_storage_path IS 'Path to media items stored in Supabase Storage for large media arrays';
    END IF;
    
    -- Add sources_storage_path column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'articles' AND column_name = 'sources_storage_path') THEN
        ALTER TABLE articles ADD COLUMN sources_storage_path text;
        COMMENT ON COLUMN articles.sources_storage_path IS 'Path to sources stored in Supabase Storage for large source arrays';
    END IF;
END $$;

-- Create function to clean up storage when article is deleted
CREATE OR REPLACE FUNCTION cleanup_article_storage()
RETURNS TRIGGER AS $$
BEGIN
    -- This function will be called when an article is deleted
    -- Storage cleanup happens in the application layer
    -- This is just a placeholder for future enhancements
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for storage cleanup (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'cleanup_article_storage_trigger') THEN
        CREATE TRIGGER cleanup_article_storage_trigger
            BEFORE DELETE ON articles
            FOR EACH ROW EXECUTE FUNCTION cleanup_article_storage();
    END IF;
END $$; 