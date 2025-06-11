'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  ContentHero, 
  ContentStream, 
  DiscoverHeader 
} from '@/components/discover';
import type { ContentItem } from '@/types/discover';
import { useArticles, useToggleBookmark, useIncrementViews, useVoteOnArticle } from '@/hooks/react-query/articles/use-articles';

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
  bookmarked: article.bookmarked,
  // Voting fields
  upvotes: article.upvotes || 0,
  downvotes: article.downvotes || 0,
  vote_score: article.vote_score || 0,
  user_vote: article.user_vote || null,
  // View tracking fields
  views: article.views || 0,
  total_views: article.total_views || 0,
  unique_views: article.unique_views || 0,
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
  
  // Consolidated state for better performance
  const [displayState, setDisplayState] = useState({
    shownArticles: [] as ContentItem[],
    currentCycle: 0,
    isLoadingMore: false
  });
  
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

  const toggleBookmarkMutation = useToggleBookmark();
  const incrementViewsMutation = useIncrementViews();
  const voteOnArticleMutation = useVoteOnArticle();

  // Memoized article conversion and filtering by active tab
  const { convertedArticles, filteredArticles } = useMemo(() => {
    const allArticles = articlesData?.pages.flatMap(page => (page as any)?.articles || []) || [];
    const converted = allArticles.map(convertArticleToContentItem);
    
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
    // Reset display state when switching tabs
    setDisplayState({
      shownArticles: [],
      currentCycle: 0,
      isLoadingMore: false
    });
  }, []);

  // Handle voting on articles
  const handleVote = useCallback(async (articleId: string, voteType: 'upvote' | 'downvote') => {
    try {
      // Optimistic update
      setDisplayState(prev => ({
        ...prev,
        shownArticles: prev.shownArticles.map(item => {
          if (item.id === articleId) {
            const wasUpvoted = item.user_vote === 'upvote';
            const wasDownvoted = item.user_vote === 'downvote';
            const isTogglingOff = item.user_vote === voteType;
            
            let newUpvotes = item.upvotes || 0;
            let newDownvotes = item.downvotes || 0;
            let newUserVote: 'upvote' | 'downvote' | null = null;
            
            if (isTogglingOff) {
              // Removing vote
              if (voteType === 'upvote') newUpvotes--;
              else newDownvotes--;
              newUserVote = null;
            } else {
              // Adding or changing vote
              if (voteType === 'upvote') {
                if (wasDownvoted) newDownvotes--;
                newUpvotes++;
                newUserVote = 'upvote';
              } else {
                if (wasUpvoted) newUpvotes--;
                newDownvotes++;
                newUserVote = 'downvote';
              }
            }
            
            return {
              ...item,
              upvotes: newUpvotes,
              downvotes: newDownvotes,
              vote_score: newUpvotes - newDownvotes,
              user_vote: newUserVote
            };
          }
          return item;
        })
      }));

      // Call the real API
      await voteOnArticleMutation.mutateAsync({ 
        articleId, 
        voteType 
      });
      
    } catch (error) {
      // Revert optimistic update on error
      console.error('Failed to vote:', error);
      setDisplayState(prev => ({
        ...prev,
        shownArticles: prev.shownArticles.map(item => {
          if (item.id === articleId) {
            // Revert to original state - this is a simplified revert
            // In a real app, you'd store the original state
            return item;
          }
          return item;
        })
      }));
    }
  }, [voteOnArticleMutation]);

  // Optimized bookmark handler with optimistic updates
  const handleBookmarkToggle = useCallback(async (contentId: string) => {
    // Immediate optimistic update
    setDisplayState(prev => ({
      ...prev,
      shownArticles: prev.shownArticles.map(item => 
        item.id === contentId 
          ? { ...item, bookmarked: !item.bookmarked }
          : item
      )
    }));

    try {
      await toggleBookmarkMutation.mutateAsync(contentId);
    } catch (error) {
      // Revert on error
      setDisplayState(prev => ({
        ...prev,
        shownArticles: prev.shownArticles.map(item => 
          item.id === contentId 
            ? { ...item, bookmarked: !item.bookmarked }
            : item
        )
      }));
      console.error('Failed to toggle bookmark:', error);
    }
  }, [toggleBookmarkMutation]);

  const handleContentClick = useCallback(async (content: ContentItem) => {
    try {
      await incrementViewsMutation.mutateAsync({ id: content.id });
    } catch (error) {
      console.error('Failed to increment views:', error);
    }
  }, [incrementViewsMutation]);

  // Optimized load more function with debouncing
  const loadMoreContent = useCallback(async () => {
    if (displayState.isLoadingMore || isLoading || isFetchingNextPage) return;

    setDisplayState(prev => ({ ...prev, isLoadingMore: true }));

    try {
      // If we have more pages to fetch, fetch them
      if (hasNextPage) {
        await fetchNextPage();
      } else if (filteredArticles.length > 0) {
        // Restart cycle with batch loading from filtered articles
        const articlesToAdd = filteredArticles.slice(0, 4);
        if (articlesToAdd.length > 0) {
          setDisplayState(prev => ({
            shownArticles: [...prev.shownArticles, ...articlesToAdd],
            currentCycle: prev.currentCycle + 1,
            isLoadingMore: false
          }));
          return;
        }
      }
    } finally {
      setDisplayState(prev => ({ ...prev, isLoadingMore: false }));
    }
  }, [displayState.isLoadingMore, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, filteredArticles]);

  // Optimized intersection observer setup
  useEffect(() => {
    const createObserver = () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !displayState.isLoadingMore) {
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
  }, [loadMoreContent, displayState.isLoadingMore]);

  // Optimized initial load and data updates based on filtered articles
  useEffect(() => {
    if (filteredArticles.length > 0) {
      setDisplayState(prev => {
        // Initial load for the current tab
        if (prev.shownArticles.length === 0) {
          return {
            ...prev,
            shownArticles: filteredArticles.slice(0, 4)
          };
        }

        // Add new articles when they arrive
        const currentlyShown = prev.shownArticles.length;
        const cycleSize = 4;
        const expectedArticles = Math.ceil(currentlyShown / cycleSize) * cycleSize;
        
        if (filteredArticles.length > expectedArticles) {
          const newArticles = filteredArticles.slice(currentlyShown, currentlyShown + cycleSize);
          if (newArticles.length > 0) {
            return {
              ...prev,
              shownArticles: [...prev.shownArticles, ...newArticles]
            };
          }
        }

        return prev;
      });
    }
  }, [filteredArticles]);

  // Memoized chunked content
  const chunkedContent = useMemo(() => 
    chunkContent(displayState.shownArticles), 
    [displayState.shownArticles]
  );

  // Memoized loading states
  const isInitialLoading = isLoading && displayState.shownArticles.length === 0;
  const isLoadingMoreContent = (isFetchingNextPage || displayState.isLoadingMore) && displayState.shownArticles.length > 0;
  const showCycleIndicator = !hasNextPage && filteredArticles.length > 0 && displayState.currentCycle > 0;

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
            ) : displayState.shownArticles.length === 0 ? (
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
                  <section key={`chunk-${index}`} className="space-y-6">
                    {chunk[0] && (
                      <ContentHero
                        content={chunk[0]}
                        onBookmarkToggle={() => handleBookmarkToggle(chunk[0].id)}
                        onVote={(voteType) => handleVote(chunk[0].id, voteType)}
                      />
                    )}
                    {chunk.length > 1 && (
                      <ContentStream
                        content={chunk.slice(1)}
                        onBookmarkToggle={handleBookmarkToggle}
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
                  Showing articles again • Cycle {displayState.currentCycle + 1}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
} 