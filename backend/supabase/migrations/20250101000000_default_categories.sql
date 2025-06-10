-- Insert default categories for the Discover platform
-- These categories match the navbar in the Discover page

-- First, clear any existing categories (soft delete)
UPDATE categories SET is_active = false WHERE is_active = true;

-- Insert the new default categories
INSERT INTO categories (id, name, slug, icon, description, color, sort_order, is_active, user_id) VALUES 
(
    uuid_generate_v4(),
    'For You',
    'for-you',
    '🎯',
    'Personalized content recommendations',
    '#3b82f6',
    1,
    true,
    '00000000-0000-0000-0000-000000000000'  -- System user
),
(
    uuid_generate_v4(),
    'Trends',
    'trends',
    '📈',
    'Trending topics and popular content',
    '#ec4899',
    2,
    true,
    '00000000-0000-0000-0000-000000000000'  -- System user
),
(
    uuid_generate_v4(),
    'Official',
    'official',
    '✅',
    'Official news and announcements',
    '#10b981',
    3,
    true,
    '00000000-0000-0000-0000-000000000000'  -- System user
),
(
    uuid_generate_v4(),
    'Rumor',
    'rumor',
    '👂',
    'Unconfirmed reports and rumors',
    '#f59e0b',
    4,
    true,
    '00000000-0000-0000-0000-000000000000'  -- System user
),
(
    uuid_generate_v4(),
    'Theories',
    'theories',
    '🧠',
    'Analysis and speculation',
    '#8b5cf6',
    5,
    true,
    '00000000-0000-0000-0000-000000000000'  -- System user
),
(
    uuid_generate_v4(),
    'Community',
    'community',
    '👥',
    'Community discussions and content',
    '#ef4444',
    6,
    true,
    '00000000-0000-0000-0000-000000000000'  -- System user
)
ON CONFLICT (name) DO UPDATE SET
    slug = EXCLUDED.slug,
    icon = EXCLUDED.icon,
    description = EXCLUDED.description,
    color = EXCLUDED.color,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active; 