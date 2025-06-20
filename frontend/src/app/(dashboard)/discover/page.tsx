'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ContentHero, 
  ContentStream, 
  DiscoverHeader 
} from '@/components/discover';
import type { ContentItem } from '@/types/discover';
import { useArticles, useSaveArticle, useIncrementViews, useVoteOnArticle } from '@/hooks/react-query/articles/use-articles';

// Tab categories mapping
export const TAB_CATEGORIES = {
  'for-you': 'for-you',
  'trends': 'trends', 
  'official': 'official',
  'rumor': 'rumor',
  'community': 'community'
} as const;

export type TabCategory = keyof typeof TAB_CATEGORIES;

// Convert Supabase article to ContentItem format (memoized)
const convertArticleToContentItem = (article: any): ContentItem => ({
  id: article.id,
  title: article.title,
  subtitle: article.subtitle,
  imageUrl: article.image_url || '/api/placeholder/400/250',
  source: article.author,
  author_avatar: article.author_avatar,
  category: article.category,
  readTime: article.read_time,
  publishedAt: article.publish_date || article.created_at,
  saved: article.saved || article.bookmarked,
  bookmarked: article.bookmarked, // Keep for backward compatibility
  // Voting fields
  upvotes: article.upvotes || 0,
  downvotes: article.downvotes || 0,
  vote_score: article.vote_score || 0,
  user_vote: article.user_vote || null,
  // View tracking fields - properly handle views
  views: article.views || article.total_views || 0,
  total_views: article.total_views || article.views || 0,
  unique_views: article.unique_views || article.total_views || article.views || 0,
});

// Optimized chunking utility with memoization
const chunkContent = (content: ContentItem[]) => {
  return content.reduce<ContentItem[][]>((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / 4);
    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [];
    }
    resultArray[chunkIndex].push(item);
    return resultArray;
  }, []);
};

export default function DiscoverPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<TabCategory>('for-you');
  const [currentCycle, setCurrentCycle] = useState(0);
  
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Fetch published articles from Supabase
  const { 
    data: articlesData, 
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage 
  } = useArticles({ status: 'published' });

  const saveArticleMutation = useSaveArticle();
  const incrementViewsMutation = useIncrementViews();
  const voteOnArticleMutation = useVoteOnArticle();

  // Memoized article conversion and filtering by active tab
  const { convertedArticles, filteredArticles } = useMemo(() => {
    const allArticles = articlesData?.pages.flatMap(page => (page as any)?.articles || []) || [];
    
    // Remove duplicates by article ID first
    const uniqueArticles = Array.from(
      new Map(allArticles.map(article => [article.id, article])).values()
    );
    
    const converted = uniqueArticles.map(convertArticleToContentItem);
    
    // Filter articles by active tab category
    const filtered = activeTab === 'for-you' 
      ? converted // For You shows all articles
      : activeTab === 'trends'
        ? converted.filter(article => article.vote_score && article.vote_score > 0) // Trends shows articles with positive vote score
        : converted.filter(article => article.category === TAB_CATEGORIES[activeTab]);
    
    return { convertedArticles: converted, filteredArticles: filtered };
  }, [articlesData, activeTab]);

  // Handle tab changes
  const handleTabChange = useCallback((tab: TabCategory) => {
    setActiveTab(tab);
    setCurrentCycle(0); // Reset cycle when switching tabs
  }, []);

  // Handle voting on articles - NO local state management, rely on React Query
  const handleVote = useCallback(async (articleId: string, voteType: 'upvote' | 'downvote') => {
    try {
      await voteOnArticleMutation.mutateAsync({ 
        articleId, 
        voteType 
      });
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  }, [voteOnArticleMutation]);

  // Handle save toggle - NO local state management, rely on React Query
  const handleSaveToggle = useCallback(async (contentId: string) => {
    try {
      await saveArticleMutation.mutateAsync(contentId);
    } catch (error) {
      console.error('Failed to save article:', error);
    }
  }, [saveArticleMutation]);

  const handleContentClick = useCallback(async (content: ContentItem) => {
    try {
      await incrementViewsMutation.mutateAsync({ id: content.id });
    } catch (error) {
      console.error('Failed to increment views:', error);
    }
  }, [incrementViewsMutation]);

  // Load more content function - simplified to always show more content
  const loadMoreContent = useCallback(async () => {
    if (isLoading || isFetchingNextPage) return;

    try {
      // If we have more pages to fetch from the server, fetch them first
      if (hasNextPage) {
        await fetchNextPage();
      } else if (filteredArticles.length > 0) {
        // No more pages to fetch, but we have articles - cycle through them
        setCurrentCycle(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load more content:', error);
    }
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, filteredArticles.length]);

  // Intersection observer setup
  useEffect(() => {
    const createObserver = () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            loadMoreContent();
          }
        },
        { 
          threshold: 0.1,
          rootMargin: '100px' // Start loading before user reaches the end
        }
      );

      if (sentinelRef.current) {
        observerRef.current.observe(sentinelRef.current);
      }
    };

    createObserver();

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMoreContent]);

  // Calculate how many articles to show based on cycles - simplified approach
  const articlesToShow = useMemo(() => {
    if (filteredArticles.length === 0) return [];
    
    // Start with showing 12 articles or all available articles if less than 12
    const baseArticles = Math.min(12, filteredArticles.length);
    const additionalArticles = currentCycle * 4; // Each cycle adds 4 more articles
    const totalToShow = baseArticles + additionalArticles;
    
    // If we need more articles than available, cycle through them
    if (totalToShow <= filteredArticles.length) {
      return filteredArticles.slice(0, totalToShow);
    } else {
      // Create a cycling array by repeating articles
      const cycles = Math.ceil(totalToShow / filteredArticles.length);
      const repeatedArticles = Array(cycles).fill(filteredArticles).flat();
      return repeatedArticles.slice(0, totalToShow);
    }
  }, [filteredArticles, currentCycle]);

  // Memoized chunked content
  const chunkedContent = useMemo(() => 
    chunkContent(articlesToShow), 
    [articlesToShow]
  );

  // Memoized loading states
  const isInitialLoading = isLoading && filteredArticles.length === 0;
  const isLoadingMoreContent = isFetchingNextPage && filteredArticles.length > 0;
  const showCycleIndicator = !hasNextPage && filteredArticles.length > 0 && currentCycle > 0 && articlesToShow.length > filteredArticles.length;

  return (
    <>
      <DiscoverHeader activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <main className="pb-16 pt-12 transform scale-75 origin-top">
            {isInitialLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              </div>
            ) : articlesToShow.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h2 className="text-2xl font-bold mb-4">
                  {activeTab === 'for-you' ? 'No Articles Available' : 
                   activeTab === 'trends' ? 'No Trending Articles' :
                   `No ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Articles`}
                </h2>
                <p className="text-muted-foreground mb-6">
                  {activeTab === 'for-you' 
                    ? 'There are no published articles yet. Check back later or create some articles!'
                    : activeTab === 'trends'
                    ? 'No articles are trending yet. Vote on articles to help them trend!'
                    : `There are no ${activeTab} articles available yet. Try another category or create some articles!`
                  }
                </p>
                <a 
                  href="/articles/editor" 
                  className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Create Your First Article
                </a>
              </div>
            ) : (
              <div className="space-y-6">
                {chunkedContent.map((chunk, index) => (
                  <section key={`chunk-${index}-${chunk[0]?.id || index}`} className="space-y-6">
                    {chunk[0] && (
                      <ContentHero
                        content={chunk[0]}
                        onSaveToggle={() => handleSaveToggle(chunk[0].id)}
                        onVote={(voteType) => handleVote(chunk[0].id, voteType)}
                      />
                    )}
                    {chunk.length > 1 && (
                      <ContentStream
                        content={chunk.slice(1)}
                        onSaveToggle={handleSaveToggle}
                        onVote={handleVote}
                      />
                    )}
                  </section>
                ))}
              </div>
            )}
            
            <div ref={sentinelRef} className="h-10" />

            {isLoadingMoreContent && (
              <div className="flex justify-center items-center py-6">
                <div className="w-8 h-8 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              </div>
            )}

            {showCycleIndicator && process.env.NODE_ENV === 'development' && (
              <div className="flex justify-center items-center py-6">
                <div className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Showing articles again • Cycle {currentCycle + 1}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
} 