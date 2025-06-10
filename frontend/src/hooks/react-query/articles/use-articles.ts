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

      // Optimistically update views
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
    onError: (err, variables, context) => {
      // Revert optimistic update on error
      if (context?.previousArticle) {
        queryClient.setQueryData(articlesKeys.detail(context.id), context.previousArticle);
      }
    },
    onSettled: (_, __, variables) => {
      // Refresh data
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
    },
  });
}

// Toggle bookmark with optimistic update
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

// Share article
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

// Save article
export function useSaveArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => articlesService.saveArticle(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: articlesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: articlesKeys.dashboardStats() });
      toast.success('Article saved!');
    },
    onError: () => {
      toast.error('Failed to save article');
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

// Hook to automatically track page views
export function useAutoTrackView(articleId: string | null, enabled = true) {
  const trackEvent = useTrackEvent();

  React.useEffect(() => {
    if (articleId && enabled) {
      const startTime = Date.now();
      let scrollPercentage = 0;

      // Track scroll percentage
      const handleScroll = () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
        scrollPercentage = Math.max(scrollPercentage, (scrollTop / documentHeight) * 100);
      };

      // Track view on mount
      trackEvent.mutate({
        articleId,
        eventType: 'view',
        options: { readTimeSeconds: 0, scrollPercentage: 0 }
      });

      window.addEventListener('scroll', handleScroll);

      // Track detailed metrics on unmount
      return () => {
        window.removeEventListener('scroll', handleScroll);
        
        const readTime = Math.floor((Date.now() - startTime) / 1000);
        if (readTime > 5) { // Only track if user spent more than 5 seconds
          trackEvent.mutate({
            articleId,
            eventType: 'view',
            options: { 
              readTimeSeconds: readTime, 
              scrollPercentage: Math.round(scrollPercentage)
            }
          });
        }
      };
    }
  }, [articleId, enabled, trackEvent]);
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