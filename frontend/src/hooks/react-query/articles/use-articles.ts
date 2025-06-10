import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  articlesService, 
  type CreateArticleData, 
  type UpdateArticleData,
  type ArticlesFilters,
  type ArticlesPagination 
} from '@/lib/supabase/articles';

const ARTICLES_QUERY_KEY = 'articles';

// Hook para listar artigos com paginação infinita
export function useArticles(filters: ArticlesFilters = {}) {
  return useInfiniteQuery({
    queryKey: [ARTICLES_QUERY_KEY, filters],
    queryFn: async ({ pageParam = 1 }) => {
      return articlesService.getArticles(
        { page: pageParam, pageSize: 10 },
        filters
      );
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.hasMore) {
        return pages.length + 1;
      }
      return undefined;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Hook para buscar artigo específico
export function useArticle(id: string | null) {
  return useQuery({
    queryKey: [ARTICLES_QUERY_KEY, id],
    queryFn: () => articlesService.getArticleById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// Hook para estatísticas dos artigos
export function useArticleStats() {
  return useQuery({
    queryKey: [ARTICLES_QUERY_KEY, 'stats'],
    queryFn: () => articlesService.getArticleStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

// Hook para criar artigo
export function useCreateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateArticleData) => articlesService.createArticle(data),
    onSuccess: (newArticle) => {
      // Invalidate and refetch articles list
      queryClient.invalidateQueries({ queryKey: [ARTICLES_QUERY_KEY] });
      
      toast.success('Article created successfully!');
    },
    onError: (error: any) => {
      console.error('Error creating article:', error);
      toast.error('Failed to create article. Please try again.');
    },
  });
}

// Hook para atualizar artigo
export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateArticleData) => articlesService.updateArticle(data),
    onSuccess: (updatedArticle) => {
      // Update the specific article in cache
      queryClient.setQueryData([ARTICLES_QUERY_KEY, updatedArticle.id], updatedArticle);
      
      // Invalidate articles list to ensure consistency
      queryClient.invalidateQueries({ queryKey: [ARTICLES_QUERY_KEY] });
      
      toast.success('Article updated successfully!');
    },
    onError: (error: any) => {
      console.error('Error updating article:', error);
      toast.error('Failed to update article. Please try again.');
    },
  });
}

// Hook para deletar artigo
export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => articlesService.deleteArticle(id),
    onSuccess: (_, deletedId) => {
      // Remove the article from cache
      queryClient.removeQueries({ queryKey: [ARTICLES_QUERY_KEY, deletedId] });
      
      // Invalidate articles list
      queryClient.invalidateQueries({ queryKey: [ARTICLES_QUERY_KEY] });
      
      toast.success('Article deleted successfully!');
    },
    onError: (error: any) => {
      console.error('Error deleting article:', error);
      toast.error('Failed to delete article. Please try again.');
    },
  });
}

// Hook para toggle bookmark
export function useToggleBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => articlesService.toggleBookmark(id),
    onSuccess: (_, articleId) => {
      // Invalidate articles to update bookmark status
      queryClient.invalidateQueries({ queryKey: [ARTICLES_QUERY_KEY] });
    },
    onError: (error: any) => {
      console.error('Error toggling bookmark:', error);
      toast.error('Failed to update bookmark status.');
    },
  });
}

// Hook para incrementar views
export function useIncrementViews() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => articlesService.incrementViews(id),
    onSuccess: (_, articleId) => {
      // Optionally invalidate to update view count
      queryClient.invalidateQueries({ queryKey: [ARTICLES_QUERY_KEY, articleId] });
    },
    onError: (error: any) => {
      console.error('Error incrementing views:', error);
    },
  });
} 