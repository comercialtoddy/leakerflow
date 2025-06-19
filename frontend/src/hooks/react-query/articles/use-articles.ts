import React from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  articlesService, 
  type CreateArticleData, 
  type UpdateArticleData,
  type ArticlesFilters,
  type ArticlesPagination,
  type ArticleAnalytics,
  type DashboardStats
} from '@/lib/supabase/articles';

const ARTICLES_QUERY_KEY = 'articles';

// =======================
// QUERY KEYS
// =======================
export const articlesKeys = {
  all: ['articles'] as const,
  lists: () => [...articlesKeys.all, 'list'] as const,
  list: (filters: ArticlesFilters) => [...articlesKeys.lists(), filters] as const,
  details: () => [...articlesKeys.all, 'detail'] as const,
  detail: (id: string) => [...articlesKeys.details(), id] as const,
  stats: () => [...articlesKeys.all, 'stats'] as const,
  analytics: () => [...articlesKeys.all, 'analytics'] as const,
  dashboardStats: () => [...articlesKeys.all, 'dashboard-stats'] as const,
};

// =======================
// ARTICLES QUERIES
// =======================

// Hook para listar artigos com paginação infinita
export function useArticles(filters: ArticlesFilters = {}) {
  return useInfiniteQuery({
    queryKey: articlesKeys.list(filters),
    queryFn: async ({ pageParam = 1 }) => {
      return articlesService.getArticles(
        { page: pageParam, pageSize: 10 },
        filters
      );
    },
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

// Hook para buscar artigo específico
export function useArticle(id: string | null) {
  return useQuery({
    queryKey: articlesKeys.detail(id || ''),
    queryFn: () => articlesService.getArticleById(id!),
    enabled: !!id,
  });
}

// =======================
// ARTICLE MUTATIONS
// =======================

// Hook para criar artigo
export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateArticleData) => articlesService.createArticle(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.stats() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
      toast.success('Article created successfully!');
    },
    onError: (error) => {
      console.error('Error creating article:', error);
      toast.error('Failed to create article');
    },
  });
}

// Hook para atualizar artigo
export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateArticleData) => articlesService.updateArticle(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(data.id) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.stats() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
      toast.success('Article updated successfully!');
    },
    onError: (error) => {
      console.error('Error updating article:', error);
      toast.error('Failed to update article');
    },
  });
}

// Hook para deletar artigo
export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => articlesService.deleteArticle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.stats() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
      toast.success('Article deleted successfully!');
    },
    onError: (error) => {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article');
    },
  });
}

// =======================
// METRICS & ANALYTICS
// =======================

// Track article events
export function useTrackEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      articleId, 
      eventType, 
      options 
    }: { 
      articleId: string; 
      eventType: 'view' | 'share' | 'save' | 'comment' | 'like' | 'bookmark';
      options?: { readTimeSeconds?: number; scrollPercentage?: number; metadata?: any };
    }) => articlesService.trackEvent(articleId, eventType, options),
    onSuccess: (_, variables) => {
      // Update article details to reflect new metrics
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(variables.articleId) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.analytics() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
    },
    onError: (error) => {
      console.error('Error tracking event:', error);
      // Don't show error toast for tracking to avoid disrupting UX
    },
  });
}

// Get analytics summary
export function useAnalyticsSummary(
  articleId?: string,
  dateFrom?: string,
  dateTo?: string
) {
  return useQuery({
    queryKey: [...articlesKeys.analytics(), { articleId, dateFrom, dateTo }],
    queryFn: () => articlesService.getAnalyticsSummary(articleId, dateFrom, dateTo),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get dashboard statistics
export function useDashboardStats() {
  return useQuery({
    queryKey: articlesKeys.dashboardStats(),
    queryFn: () => articlesService.getDashboardStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// Get enhanced dashboard statistics
export function useEnhancedDashboardStats(daysBack: number = 30) {
  return useQuery({
    queryKey: [...articlesKeys.dashboardStats(), 'enhanced', daysBack],
    queryFn: () => articlesService.getEnhancedDashboardStats(daysBack),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  });
}

// Get analytics time series
export function useAnalyticsTimeSeries(
  articleId?: string,
  daysBack: number = 30,
  metric: 'views' | 'shares' | 'saves' | 'engagement' = 'views'
) {
  return useQuery({
    queryKey: [...articlesKeys.analytics(), 'timeSeries', { articleId, daysBack, metric }],
    queryFn: () => articlesService.getAnalyticsTimeSeries(articleId, daysBack, metric),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get top performing articles
export function useTopPerformingArticles(
  metric: 'views' | 'engagement' | 'shares' | 'saves' | 'trending' = 'views',
  limit: number = 5
) {
  return useQuery({
    queryKey: [...articlesKeys.analytics(), 'topPerformers', metric, limit],
    queryFn: () => articlesService.getTopPerformingArticles(metric, limit),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Get category analytics
export function useCategoryAnalytics() {
  return useQuery({
    queryKey: [...articlesKeys.analytics(), 'categories'],
    queryFn: () => articlesService.getCategoryAnalytics(),
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
}

// Get reader behavior insights
export function useReaderBehaviorInsights(articleId?: string) {
  return useQuery({
    queryKey: [...articlesKeys.analytics(), 'behavior', articleId],
    queryFn: () => articlesService.getReaderBehaviorInsights(articleId),
    staleTime: 15 * 60 * 1000, // 15 minutes
  });
}

// Increment views with optimistic update
export function useIncrementViews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      id, 
      readTime, 
      scrollPercentage 
    }: { 
      id: string; 
      readTime?: number; 
      scrollPercentage?: number; 
    }) => articlesService.incrementViews(id, readTime, scrollPercentage),
    onMutate: async ({ id }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: articlesKeys.detail(id) });

      // Snapshot previous value
      const previousArticle = queryClient.getQueryData(articlesKeys.detail(id));

      // Optimistically update views only if user is authenticated
      // Note: We'll optimistically update, but revert if the mutation indicates no view was counted
      queryClient.setQueryData(articlesKeys.detail(id), (old: any) => {
        if (old) {
          return {
            ...old,
            views: (old.views || 0) + 1,
            total_views: (old.total_views || 0) + 1,
          };
        }
        return old;
      });

      return { previousArticle, id };
    },
    onSuccess: (wasViewCounted, variables, context) => {
      // If the view wasn't counted (user already viewed or not authenticated), revert optimistic update
      if (!wasViewCounted && context?.previousArticle) {
        queryClient.setQueryData(articlesKeys.detail(context.id), context.previousArticle);
      }
    },
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousArticle) {
        queryClient.setQueryData(articlesKeys.detail(context.id), context.previousArticle);
      }
    },
    onSettled: (wasViewCounted, __, variables) => {
      // Only refresh data if a view was actually counted
      if (wasViewCounted) {
        queryClient.invalidateQueries({ queryKey: articlesKeys.detail(variables.id) });
        queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
      }
    },
  });
}

// Toggle bookmark with optimistic update (kept for backwards compatibility)
export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => articlesService.toggleBookmark(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: articlesKeys.detail(id) });

      const previousArticle = queryClient.getQueryData(articlesKeys.detail(id));

      queryClient.setQueryData(articlesKeys.detail(id), (old: any) => {
        if (old) {
          return {
            ...old,
            bookmarked: !old.bookmarked,
          };
        }
        return old;
      });

      return { previousArticle, id };
    },
    onError: (err, id, context) => {
      if (context?.previousArticle) {
        queryClient.setQueryData(articlesKeys.detail(context.id), context.previousArticle);
      }
      toast.error('Failed to update bookmark');
    },
    onSuccess: (bookmarked) => {
      toast.success(bookmarked ? 'Article bookmarked' : 'Bookmark removed');
    },
    onSettled: (_, __, id) => {
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
    },
  });
}

// Save article with optimistic update
export function useSaveArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => articlesService.saveArticle(id),
    onMutate: async (id) => {
      // Cancel outgoing queries for this article
      await queryClient.cancelQueries({ queryKey: articlesKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: articlesKeys.lists() });

      // Snapshot previous values
      const previousArticle = queryClient.getQueryData(articlesKeys.detail(id));
      const previousLists = queryClient.getQueriesData({ queryKey: articlesKeys.lists() });

      // Optimistically update the detail
      queryClient.setQueryData(articlesKeys.detail(id), (old: any) => {
        if (old) {
          return {
            ...old,
            saved: !old.saved,
            bookmarked: !old.bookmarked, // Also update bookmarked for compatibility
          };
        }
        return old;
      });

      // Optimistically update all list queries
      queryClient.setQueriesData({ queryKey: articlesKeys.lists() }, (old: any) => {
        if (!old || !old.pages) return old;
        
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            articles: page.articles?.map((article: any) => 
              article.id === id 
                ? { ...article, saved: !article.saved, bookmarked: !article.bookmarked }
                : article
            ) || []
          }))
        };
      });

      return { previousArticle, previousLists, id };
    },
    onError: (err, id, context) => {
      // Revert detail update
      if (context?.previousArticle) {
        queryClient.setQueryData(articlesKeys.detail(context.id), context.previousArticle);
      }
      
      // Revert list updates
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      toast.error('Failed to save article');
    },
    onSuccess: (saved) => {
      toast.success(saved ? 'Article saved' : 'Save removed');
    },
    onSettled: (_, __, id) => {
      // Always refresh data to ensure consistency
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
    },
  });
}

// Share article (no longer named useSaveArticle)
export function useShareArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, platform }: { id: string; platform?: string }) => 
      articlesService.shareArticle(id, platform),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
      toast.success('Article shared!');
    },
    onError: () => {
      toast.error('Failed to track share');
    },
  });
}

// Vote on article with optimistic updates
export function useVoteOnArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ articleId, voteType }: { articleId: string; voteType: 'upvote' | 'downvote' }) => 
      articlesService.voteOnArticle(articleId, voteType),
    onMutate: async ({ articleId, voteType }) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: articlesKeys.detail(articleId) });
      await queryClient.cancelQueries({ queryKey: articlesKeys.lists() });

      // Snapshot previous values
      const previousArticle = queryClient.getQueryData(articlesKeys.detail(articleId));
      const previousLists = queryClient.getQueriesData({ queryKey: articlesKeys.lists() });

      // Optimistically update the detail
      queryClient.setQueryData(articlesKeys.detail(articleId), (old: any) => {
        if (old) {
          const wasUpvoted = old.user_vote === 'upvote';
          const wasDownvoted = old.user_vote === 'downvote';
          const isTogglingOff = old.user_vote === voteType;
          
          let newUpvotes = old.upvotes || 0;
          let newDownvotes = old.downvotes || 0;
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
            ...old,
            upvotes: newUpvotes,
            downvotes: newDownvotes,
            vote_score: newUpvotes - newDownvotes,
            user_vote: newUserVote
          };
        }
        return old;
      });

      // Optimistically update all list queries
      queryClient.setQueriesData({ queryKey: articlesKeys.lists() }, (old: any) => {
        if (!old || !old.pages) return old;
        
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            articles: page.articles?.map((article: any) => {
              if (article.id === articleId) {
                const wasUpvoted = article.user_vote === 'upvote';
                const wasDownvoted = article.user_vote === 'downvote';
                const isTogglingOff = article.user_vote === voteType;
                
                let newUpvotes = article.upvotes || 0;
                let newDownvotes = article.downvotes || 0;
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
                  ...article,
                  upvotes: newUpvotes,
                  downvotes: newDownvotes,
                  vote_score: newUpvotes - newDownvotes,
                  user_vote: newUserVote
                };
              }
              return article;
            }) || []
          }))
        };
      });

      return { previousArticle, previousLists, articleId };
    },
    onError: (error: any, variables, context) => {
      // Revert detail update
      if (context?.previousArticle) {
        queryClient.setQueryData(articlesKeys.detail(context.articleId), context.previousArticle);
      }
      
      // Revert list updates
      if (context?.previousLists) {
        context.previousLists.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      console.error('Failed to vote on article:', error);
      toast.error('Failed to vote on article');
    },
    onSuccess: (voteResult, { articleId }) => {
      // Update with actual server response to ensure consistency
      queryClient.setQueryData(articlesKeys.detail(articleId), (old: any) => {
        if (old) {
          return {
            ...old,
            upvotes: voteResult.upvotes,
            downvotes: voteResult.downvotes,
            vote_score: voteResult.vote_score,
            user_vote: voteResult.user_vote,
          };
        }
        return old;
      });
    },
    onSettled: (_, __, { articleId }) => {
      // Always refresh data to ensure consistency
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(articleId) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
    },
  });
}

// =======================
// LEGACY SUPPORT
// =======================

// Get article stats (legacy compatibility)
export function useArticleStats() {
  return useDashboardStats();
}

// =======================
// REAL-TIME SUBSCRIPTIONS
// =======================

export function useArticleSubscription() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const subscription = articlesService.subscribeToArticleChanges((payload) => {
      // Invalidate relevant queries when articles change
      queryClient.invalidateQueries({ queryKey: articlesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.stats() });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
      
      if (payload.new?.id) {
        queryClient.invalidateQueries({ queryKey: articlesKeys.detail(payload.new.id) });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
}

// =======================
// CONVENIENCE HOOKS
// =======================

// Hook to automatically track page views (only for authenticated users)
export function useAutoTrackView(articleId: string | null, enabled = true) {
  const { mutate: incrementView } = useIncrementViews();
  const hasTracked = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (articleId && enabled && hasTracked.current !== articleId) {
      console.log('Attempting to track view for article:', articleId); // Debug log
      incrementView({ id: articleId });
      hasTracked.current = articleId;
    }
  }, [articleId, enabled, incrementView]);

  // Reset tracking when component unmounts
  React.useEffect(() => {
    return () => {
      hasTracked.current = null;
    };
  }, []);
}

// Hook for easy metrics tracking
export function useArticleMetrics(articleId: string) {
  const trackEvent = useTrackEvent();
  const shareArticle = useShareArticle();
  const saveArticle = useSaveArticle();
  const toggleBookmark = useToggleBookmark();

  return {
    trackView: (readTime?: number, scrollPercentage?: number) => 
      trackEvent.mutate({ 
        articleId, 
        eventType: 'view', 
        options: { readTimeSeconds: readTime, scrollPercentage } 
      }),
    trackShare: (platform?: string) => shareArticle.mutate({ id: articleId, platform }),
    trackSave: () => saveArticle.mutate(articleId),
    trackLike: () => trackEvent.mutate({ articleId, eventType: 'like' }),
    trackComment: () => trackEvent.mutate({ articleId, eventType: 'comment' }),
    toggleBookmark: () => toggleBookmark.mutate(articleId),
  };
}

// =======================
// REAL-TIME ACTIVITY
// =======================

// Track real-time activity
export function useTrackRealtimeActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      articleId, 
      activityType, 
      metadata 
    }: { 
      articleId: string; 
      activityType: 'viewing' | 'reading' | 'typing_comment';
      metadata?: any;
    }) => articlesService.trackRealtimeActivity(articleId, activityType, metadata),
    onSuccess: (_, variables) => {
      // Invalidate active users queries
      queryClient.invalidateQueries({ 
        queryKey: [...articlesKeys.all, 'activeUsers', variables.articleId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [...articlesKeys.all, 'globalActiveUsers'] 
      });
    },
  });
}

// End real-time activity
export function useEndRealtimeActivity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ 
      articleId, 
      activityType 
    }: { 
      articleId: string; 
      activityType: 'viewing' | 'reading' | 'typing_comment';
    }) => articlesService.endRealtimeActivity(articleId, activityType),
    onSuccess: (_, variables) => {
      // Invalidate active users queries
      queryClient.invalidateQueries({ 
        queryKey: [...articlesKeys.all, 'activeUsers', variables.articleId] 
      });
      queryClient.invalidateQueries({ 
        queryKey: [...articlesKeys.all, 'globalActiveUsers'] 
      });
    },
  });
}

// Get active users for an article
export function useArticleActiveUsers(articleId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...articlesKeys.all, 'activeUsers', articleId],
    queryFn: () => articlesService.getArticleActiveUsers(articleId!),
    enabled: !!articleId && enabled,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 15 * 1000, // Refetch every 15 seconds
  });
}

// Get global active users
export function useGlobalActiveUsers() {
  return useQuery({
    queryKey: [...articlesKeys.all, 'globalActiveUsers'],
    queryFn: () => articlesService.getGlobalActiveUsers(),
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 30 * 1000, // Refetch every 30 seconds
  });
}

// Hook to track article viewing with activity heartbeat
export function useTrackArticleViewing(articleId: string | null, enabled = true) {
  const trackActivity = useTrackRealtimeActivity();
  const endActivity = useEndRealtimeActivity();
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    if (!articleId || !enabled) return;

    // Start tracking
    trackActivity.mutate({ 
      articleId, 
      activityType: 'viewing' 
    });

    // Heartbeat every 15 seconds
    intervalRef.current = setInterval(() => {
      trackActivity.mutate({ 
        articleId, 
        activityType: 'viewing' 
      });
    }, 15000);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      endActivity.mutate({ 
        articleId, 
        activityType: 'viewing' 
      });
    };
  }, [articleId, enabled]);
}

// Subscribe to activity updates for an article
export function useArticleActivitySubscription(articleId: string | null) {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    if (!articleId) return;

    const subscription = articlesService.subscribeToActivityChanges(articleId, () => {
      // Invalidate active users query when activity changes
      queryClient.invalidateQueries({ 
        queryKey: [...articlesKeys.all, 'activeUsers', articleId] 
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [articleId, queryClient]);
}

// Subscribe to global activity updates
export function useGlobalActivitySubscription() {
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const subscription = articlesService.subscribeToGlobalActivity(() => {
      // Invalidate global active users query when activity changes
      queryClient.invalidateQueries({ 
        queryKey: [...articlesKeys.all, 'globalActiveUsers'] 
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);
} 