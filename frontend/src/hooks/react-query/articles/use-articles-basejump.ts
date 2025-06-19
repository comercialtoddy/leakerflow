import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { toast } from 'sonner';

// Types
export interface CreateArticleData {
  title: string;
  subtitle: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived' | 'scheduled';
  visibility: 'private' | 'account' | 'public';
  media_items: any[];
  sources: any[];
  sections?: any[];
  read_time: string;
  image_url?: string;
  publish_date?: string;
  account_id: string;
}

export interface UpdateArticleData extends Partial<CreateArticleData> {
  id: string;
}

export interface ArticlesFilters {
  status?: string;
  category?: string;
  search?: string;
  visibility?: string;
  account_id?: string;
}

export interface ArticlesPagination {
  page: number;
  page_size: number;
}

// Query Keys
export const articleKeys = {
  all: ['articles'] as const,
  lists: () => [...articleKeys.all, 'list'] as const,
  list: (filters: ArticlesFilters, pagination: ArticlesPagination) => 
    [...articleKeys.lists(), { filters, pagination }] as const,
  details: () => [...articleKeys.all, 'detail'] as const,
  detail: (id: string) => [...articleKeys.details(), id] as const,
  stats: (accountId: string) => [...articleKeys.all, 'stats', accountId] as const,
  public: (filters: ArticlesFilters, pagination: ArticlesPagination) =>
    [...articleKeys.all, 'public', { filters, pagination }] as const,
};

// Hooks

/**
 * Get paginated articles with filters
 */
export function useArticles(
  filters: ArticlesFilters = {},
  pagination: ArticlesPagination = { page: 1, page_size: 10 }
) {
  return useQuery({
    queryKey: articleKeys.list(filters, pagination),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.page_size.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v != null)
        ),
      });
      
      const response = await api.get(`/articles?${params}`);
      return response.data;
    },
  });
}

/**
 * Get a single article by ID
 */
export function useArticle(articleId: string | null) {
  return useQuery({
    queryKey: articleKeys.detail(articleId!),
    queryFn: async () => {
      const response = await api.get(`/articles/${articleId}`);
      return response.data;
    },
    enabled: !!articleId,
  });
}

/**
 * Get public articles for discover page (no auth required)
 */
export function usePublicArticles(
  filters: Pick<ArticlesFilters, 'category' | 'search'> = {},
  pagination: ArticlesPagination = { page: 1, page_size: 10 }
) {
  return useQuery({
    queryKey: articleKeys.public(filters, pagination),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        page_size: pagination.page_size.toString(),
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, v]) => v != null)
        ),
      });
      
      const response = await api.get(`/articles/public/discover?${params}`);
      return response.data;
    },
  });
}

/**
 * Create a new article
 */
export function useCreateArticle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: CreateArticleData) => {
      const response = await api.post('/articles', data);
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate all article lists
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
      
      // Also invalidate account-specific queries
      if (data.account_id) {
        queryClient.invalidateQueries({ 
          queryKey: articleKeys.list({ account_id: data.account_id }, { page: 1, page_size: 10 }) 
        });
      }
      
      toast.success('Article created successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to create article');
    },
  });
}

/**
 * Update an existing article
 */
export function useUpdateArticle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: UpdateArticleData) => {
      const response = await api.put(`/articles/${id}`, data);
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Invalidate the specific article
      queryClient.invalidateQueries({ queryKey: articleKeys.detail(variables.id) });
      
      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
      
      toast.success('Article updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update article');
    },
  });
}

/**
 * Delete an article
 */
export function useDeleteArticle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (articleId: string) => {
      const response = await api.delete(`/articles/${articleId}`);
      return response.data;
    },
    onSuccess: (_, articleId) => {
      // Invalidate the specific article
      queryClient.invalidateQueries({ queryKey: articleKeys.detail(articleId) });
      
      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
      
      toast.success('Article deleted successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to delete article');
    },
  });
}

/**
 * Vote on an article
 */
export function useVoteArticle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ articleId, voteType }: { articleId: string; voteType: 'upvote' | 'downvote' }) => {
      const response = await api.post(`/articles/${articleId}/vote`, { vote_type: voteType });
      return response.data;
    },
    onSuccess: (data, variables) => {
      // Update the specific article
      queryClient.setQueryData(articleKeys.detail(variables.articleId), data);
      
      // Invalidate lists to update vote counts
      queryClient.invalidateQueries({ queryKey: articleKeys.lists() });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to vote');
    },
  });
}

/**
 * Get article statistics for an account
 */
export function useAccountArticleStats(accountId: string | null) {
  return useQuery({
    queryKey: articleKeys.stats(accountId!),
    queryFn: async () => {
      const response = await api.get(`/articles/stats/${accountId}`);
      return response.data;
    },
    enabled: !!accountId,
  });
} 