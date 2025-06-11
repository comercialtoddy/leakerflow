// Principle 3: Atomic Unit - Shared data structure for content items
export interface ContentItem {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  source: string;
  category: string;
  readTime: string;
  publishedAt: string;
  bookmarked: boolean;
  // Voting system fields
  upvotes?: number;
  downvotes?: number;
  vote_score?: number;
  user_vote?: 'upvote' | 'downvote' | null;
}

// Navigation category structure
export interface Category {
  id: string;
  label: string;
  icon: string;
  active: boolean;
}

// API response types for future integration
export interface ContentResponse {
  hero: ContentItem;
  stream: ContentItem[];
  categories: Category[];
  pagination?: {
    hasMore: boolean;
    nextCursor?: string;
  };
}

// Content interaction events
export interface ContentActions {
  onBookmarkToggle: (id: string, isHero?: boolean) => void;
  onCategoryChange: (categoryId: string) => void;
  onContentClick: (content: ContentItem) => void;
}

export interface DiscoverNavItem {
  id: number;
  name: string;
  href: string;
  icon?: string;
}

export interface DiscoverCategory {
  id: string;
  label: string;
  icon: string;
}

export interface ContentStreamProps {
  content: ContentItem[];
  onBookmarkToggle: (id: string, isHero?: boolean) => void;
  onCategoryChange: (categoryId: string) => void;
  onContentClick: (content: ContentItem) => void;
} 