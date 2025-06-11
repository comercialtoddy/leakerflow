-- Insert default categories for the Discover platform
-- These categories match the navbar in the Discover page
-- Categories table for Discover platform
-- This table stores the different content categories available

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  
  -- Audit fields
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE  -- NULL for system categories
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_is_active ON categories(is_active);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_categories_updated_at 
    BEFORE UPDATE ON categories 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Categories policies
CREATE POLICY "Everyone can view active categories" ON categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own categories" ON categories
    FOR SELECT USING (auth.uid() = user_id);

-- System categories (user_id IS NULL) can be viewed by everyone
CREATE POLICY "Everyone can view system categories" ON categories
    FOR SELECT USING (user_id IS NULL);

CREATE POLICY "Users can insert own categories" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only allow service_role to create system categories (user_id = NULL)
CREATE POLICY "Service role can insert system categories" ON categories
    FOR INSERT WITH CHECK (auth.role() = 'service_role' AND user_id IS NULL);

CREATE POLICY "Users can update own categories" ON categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON categories
    FOR DELETE USING (auth.uid() = user_id);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON categories TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT ON categories TO anon;

-- Enable real-time subscriptions for categories
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'categories'
    ) THEN
        ALTER publication supabase_realtime ADD TABLE categories;
    END IF;
END $$; 

-- First, clear any existing categories (soft delete)
UPDATE categories SET is_active = false WHERE is_active = true;

-- Insert the new default categories (system categories with user_id = NULL)
INSERT INTO categories (id, name, slug, description, sort_order, is_active, user_id) VALUES 
(
    uuid_generate_v4(),
    'Trends',
    'trends',
    'Trending topics and popular content',
    2,
    true,
    NULL  -- System category
),
(
    uuid_generate_v4(),
    'For You',
    'for-you',
    'Personalized content recommendations',
    1,
    true,
    NULL  -- System category
),
(
    uuid_generate_v4(),
    'Official',
    'official',
    'Official news and announcements',
    3,
    true,
    NULL  -- System category
),
(
    uuid_generate_v4(),
    'Rumor',
    'rumor',
    'Unconfirmed reports and rumors',
    4,
    true,
    NULL  -- System category
),
(
    uuid_generate_v4(),
    'Community',
    'community',
    'Community discussions and content',
    6,
    true,
    NULL  -- System category
)
ON CONFLICT (name) DO UPDATE SET
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active; 