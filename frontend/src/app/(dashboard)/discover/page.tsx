'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ContentHero, 
  ContentStream, 
  DiscoverHeader 
} from '@/components/discover';
import type { ContentItem } from '@/types/discover';
import { useArticles, useToggleBookmark, useIncrementViews } from '@/hooks/react-query/articles/use-articles';

// Convert Supabase article to ContentItem format
const convertArticleToContentItem = (article: any): ContentItem => {
  return {
    id: article.id,
    title: article.title,
    subtitle: article.subtitle,
    imageUrl: article.image_url || '/api/placeholder/400/250',
    source: article.author,
    category: article.category,
    readTime: article.read_time,
    publishedAt: article.publish_date || article.created_at,
    bookmarked: article.bookmarked,
  };
};

// Chunking utility to group content into hero + stream items
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
  const [allShownArticles, setAllShownArticles] = useState<ContentItem[]>([]);
  const [currentCycle, setCurrentCycle] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  // Flatten all articles from all pages
  const allArticles = articlesData?.pages.flatMap(page => (page as any)?.articles || []) || [];
  
  // Convert to ContentItem format
  const convertedArticles = allArticles.map(convertArticleToContentItem);

  const handleBookmarkToggle = useCallback(async (contentId: string) => {
    try {
      await toggleBookmarkMutation.mutateAsync(contentId);
      
      // Update local state optimistically
      setAllShownArticles(prev => 
        prev.map(item => 
          item.id === contentId 
            ? { ...item, bookmarked: !item.bookmarked }
            : item
        )
      );
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  }, [toggleBookmarkMutation]);

  const handleContentClick = useCallback(async (content: ContentItem) => {
    try {
      await incrementViewsMutation.mutateAsync(content.id);
    } catch (error) {
      console.error('Failed to increment views:', error);
    }
  }, [incrementViewsMutation]);

  const loadMoreContent = useCallback(async () => {
    if (isLoading || isFetchingNextPage) return;

    // If we have more pages to fetch, fetch them
    if (hasNextPage) {
      await fetchNextPage();
      return;
    }

    // If no more pages and we have articles, restart the cycle
    if (convertedArticles.length > 0) {
      const articlesToAdd = convertedArticles.slice(0, 4); // Add 4 articles per cycle
      
      if (articlesToAdd.length > 0) {
        setAllShownArticles(prev => [...prev, ...articlesToAdd]);
        setCurrentCycle(prev => prev + 1);
      }
    }
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, convertedArticles]);

  // Initial load and infinite scroll setup
  useEffect(() => {
    if (convertedArticles.length > 0 && allShownArticles.length === 0) {
      // Initial load - add first batch of articles
      const initialArticles = convertedArticles.slice(0, 4);
      setAllShownArticles(initialArticles);
    }
  }, [convertedArticles, allShownArticles.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMoreContent();
        }
      },
      { threshold: 1.0 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [loadMoreContent]);

  // Update shown articles when new data arrives
  useEffect(() => {
    if (convertedArticles.length > 0) {
      const currentlyShown = allShownArticles.length;
      const cycleSize = 4;
      const totalCycles = Math.floor(currentlyShown / cycleSize);
      
      // If we have new articles and are not in the middle of adding them
      if (convertedArticles.length > totalCycles * cycleSize) {
        const newArticles = convertedArticles.slice(currentlyShown, currentlyShown + cycleSize);
        if (newArticles.length > 0) {
          setAllShownArticles(prev => [...prev, ...newArticles]);
        }
      }
    }
  }, [convertedArticles, allShownArticles.length]);

  const chunked = chunkContent(allShownArticles);

  return (
    <>
      <DiscoverHeader />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <main className="pb-16 pt-12 transform scale-75 origin-top">
            {allShownArticles.length === 0 && isLoading ? (
              <div className="flex justify-center items-center py-12">
                <div className="w-8 h-8 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              </div>
            ) : allShownArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <h2 className="text-2xl font-bold mb-4">No Articles Available</h2>
                <p className="text-muted-foreground mb-6">
                  There are no published articles yet. Check back later or create some articles!
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
                {chunked.map((chunk, index) => (
                  <section key={`chunk-${index}`} className="space-y-6">
                                         {chunk[0] && (
                       <ContentHero
                         content={chunk[0]}
                         onBookmarkToggle={() => handleBookmarkToggle(chunk[0].id)}
                       />
                     )}
                     {chunk.length > 1 && (
                       <ContentStream
                         content={chunk.slice(1)}
                         onBookmarkToggle={handleBookmarkToggle}
                       />
                     )}
                  </section>
                ))}
              </div>
            )}
            
            <div ref={sentinelRef} className="h-10" />

            {(isLoading || isFetchingNextPage) && allShownArticles.length > 0 && (
              <div className="flex justify-center items-center py-6">
                <div className="w-8 h-8 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              </div>
            )}

            {/* Show cycle indicator when restarting articles */}
            {!hasNextPage && convertedArticles.length > 0 && currentCycle > 0 && (
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