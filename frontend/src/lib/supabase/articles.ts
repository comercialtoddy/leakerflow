import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type Tables = Database['public']['Tables'];
type Article = Tables['articles']['Row'];
type ArticleInsert = Tables['articles']['Insert'];
type ArticleUpdate = Tables['articles']['Update'];

export interface CreateArticleData {
  title: string;
  subtitle: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived' | 'scheduled';
  media_items: any[];
  sources: any[];
  read_time: string;
  image_url?: string;
  publish_date?: string;
}

export interface UpdateArticleData extends Partial<CreateArticleData> {
  id: string;
}

export interface ArticlesFilters {
  status?: string;
  category?: string;
  search?: string;
}

export interface ArticlesPagination {
  page: number;
  pageSize: number;
}

// Metrics interfaces
export interface ArticleEvent {
  id?: string;
  article_id: string;
  user_id?: string;
  session_id?: string;
  event_type: 'view' | 'share' | 'save' | 'comment' | 'like' | 'bookmark';
  read_time_seconds?: number;
  scroll_percentage?: number;
  metadata?: any;
  created_at?: string;
}

export interface ArticleAnalytics {
  total_views: number;
  unique_views: number;
  total_shares: number;
  total_saves: number;
  total_comments: number;
  avg_engagement_rate: number;
  avg_read_time: number;
  avg_bounce_rate: number;
}

export interface DashboardStats {
  total_articles: number;
  total_views: number;
  total_engagement: number;
  total_shares: number;
  total_saves: number;
  weekly_growth: {
    views: number;
    engagement: number;
    articles: number;
  };
}

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  size: string;
}

export class ArticlesService {
  private supabase = createClient();

  // Size limits to prevent payload too long errors
  private readonly MAX_CONTENT_SIZE = 200000; // 200K characters for content
  private readonly MAX_MEDIA_ITEMS = 20; // Maximum 20 media items
  private readonly MAX_SOURCES = 50; // Maximum 50 sources

  private validatePayloadSize(data: any): any {
    const result = { ...data };
    const warnings: string[] = [];

    // Truncate content if too long
    if (result.content && result.content.length > this.MAX_CONTENT_SIZE) {
      warnings.push(`Content was truncated from ${result.content.length} to ${this.MAX_CONTENT_SIZE} characters`);
      result.content = result.content.substring(0, this.MAX_CONTENT_SIZE) + '\n\n[Content truncated due to size limits. Please break this into multiple articles or reduce content size.]';
    }

    // Limit media items
    if (result.media_items && Array.isArray(result.media_items) && result.media_items.length > this.MAX_MEDIA_ITEMS) {
      warnings.push(`Media items reduced from ${result.media_items.length} to ${this.MAX_MEDIA_ITEMS}`);
      result.media_items = result.media_items.slice(0, this.MAX_MEDIA_ITEMS);
    }

    // Limit sources
    if (result.sources && Array.isArray(result.sources) && result.sources.length > this.MAX_SOURCES) {
      warnings.push(`Sources reduced from ${result.sources.length} to ${this.MAX_SOURCES}`);
      result.sources = result.sources.slice(0, this.MAX_SOURCES);
    }

    // Check individual media item sizes and clean up data
    if (result.media_items && Array.isArray(result.media_items)) {
      result.media_items = result.media_items.map((item: any) => {
        // Clean up media item data to essential fields only
        const cleanItem = {
          id: item.id,
          type: item.type,
          url: item.url && item.url.length > 2000 ? item.url.substring(0, 2000) : item.url,
          name: item.name && item.name.length > 500 ? item.name.substring(0, 500) : item.name,
          size: item.size
        };
        return cleanItem;
      });
    }

    // Log warnings if any
    if (warnings.length > 0) {
      console.warn('Article payload size warnings:', warnings);
      
      // In a real app, you might want to show these warnings to the user
      // For now, we'll just log them
    }

    return result;
  }

  // Helper method to get size limits for UI display
  getSizeLimits() {
    return {
      maxContentSize: this.MAX_CONTENT_SIZE,
      maxMediaItems: this.MAX_MEDIA_ITEMS,
      maxSources: this.MAX_SOURCES,
      maxContentSizeFormatted: `${(this.MAX_CONTENT_SIZE / 1000).toFixed(0)}KB`
    };
  }

  // =======================
  // ARTICLES CRUD
  // =======================

  async getArticles(
    pagination: ArticlesPagination = { page: 1, pageSize: 10 },
    filters: ArticlesFilters = {}
  ) {
    try {
      const { page, pageSize } = pagination;
      const offset = (page - 1) * pageSize;

      let query = this.supabase
        .from('articles')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + pageSize - 1);

      // Apply filters
      if (filters.status && filters.status !== 'all') {
        query = query.eq('status', filters.status);
      }

      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }

      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,subtitle.ilike.%${filters.search}%`);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        articles: data || [],
        totalCount: count || 0,
        hasMore: (offset + pageSize) < (count || 0),
      };
    } catch (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }
  }

  async getArticleById(id: string) {
    try {
      const { data, error } = await this.supabase
        .from('articles')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching article:', error);
      throw error;
    }
  }

  async createArticle(articleData: CreateArticleData) {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Validate payload size before sending
      const validatedData = this.validatePayloadSize(articleData);

      const insertData: ArticleInsert = {
        ...validatedData,
        user_id: user.user.id,
        publish_date: validatedData.status === 'published' 
          ? (validatedData.publish_date ? new Date(validatedData.publish_date).toISOString() : new Date().toISOString())
          : null,
      };

      // Debug logging
      console.log('=== PAYLOAD DEBUG ===');
      console.log('Original content length:', articleData.content?.length || 0);
      console.log('Validated content length:', validatedData.content?.length || 0);
      console.log('Media items count:', validatedData.media_items?.length || 0);
      console.log('Sources count:', validatedData.sources?.length || 0);
      console.log('Total payload size estimate:', JSON.stringify(insertData).length, 'bytes');

      const { data, error } = await this.supabase
        .from('articles')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }
      return data;
    } catch (error) {
      console.error('Error creating article:', error);
      throw error;
    }
  }

  async updateArticle(articleData: UpdateArticleData) {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { id, ...updateData } = articleData;

      // Validate payload size before sending
      const validatedData = this.validatePayloadSize(updateData);

      // Debug logging
      console.log('=== UPDATE PAYLOAD DEBUG ===');
      console.log('Content length:', validatedData.content?.length || 0);
      console.log('Media items count:', validatedData.media_items?.length || 0);
      console.log('Sources count:', validatedData.sources?.length || 0);

      const { data, error } = await this.supabase
        .from('articles')
        .update({
          ...validatedData,
          publish_date: validatedData.status === 'published' 
            ? (validatedData.publish_date ? new Date(validatedData.publish_date).toISOString() : new Date().toISOString())
            : null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error updating article:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating article:', error);
      throw error;
    }
  }

  async deleteArticle(id: string) {
    try {
      const { error } = await this.supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting article:', error);
      throw error;
    }
  }

  // =======================
  // METRICS & ANALYTICS
  // =======================

  // Track article events (only for authenticated users)
  async trackEvent(
    articleId: string, 
    eventType: 'view' | 'share' | 'save' | 'comment' | 'like' | 'bookmark',
    options: {
      readTimeSeconds?: number;
      scrollPercentage?: number;
      metadata?: any;
    } = {}
  ) {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      
      // Only track events for authenticated users
      if (!user.user) {
        console.log('Skipping event tracking - user not authenticated');
        return null;
      }

      const { data, error } = await this.supabase.rpc('track_article_event', {
        p_article_id: articleId,
        p_event_type: eventType,
        p_read_time_seconds: options.readTimeSeconds || 0,
        p_scroll_percentage: options.scrollPercentage || 0,
        p_metadata: options.metadata || {}
      });

      if (error) {
        console.error('Error tracking event:', error);
        // Don't throw here to avoid breaking user experience
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error tracking event:', error);
      return null;
    }
  }

  // Get analytics summary
  async getAnalyticsSummary(
    articleId?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<ArticleAnalytics> {
    try {
      const { data, error } = await this.supabase.rpc('get_article_analytics_summary', {
        p_article_id: articleId || null,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null
      });

      if (error) throw error;

      return data[0] || {
        total_views: 0,
        unique_views: 0,
        total_shares: 0,
        total_saves: 0,
        total_comments: 0,
        avg_engagement_rate: 0,
        avg_read_time: 0,
        avg_bounce_rate: 0
      };
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      throw error;
    }
  }

  // Get dashboard statistics
  async getDashboardStats(): Promise<DashboardStats> {
    try {
      // Get overall stats
      const { data: articles, error: articlesError } = await this.supabase
        .from('articles')
        .select('total_views, engagement, total_shares, total_saves, created_at')
        .eq('status', 'published');

      if (articlesError) throw articlesError;

      // Calculate current week and previous week
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const currentWeekArticles = articles?.filter(a => 
        new Date(a.created_at) >= oneWeekAgo
      ) || [];

      const totalViews = articles?.reduce((sum, a) => sum + (a.total_views || 0), 0) || 0;
      const totalShares = articles?.reduce((sum, a) => sum + (a.total_shares || 0), 0) || 0;
      const totalSaves = articles?.reduce((sum, a) => sum + (a.total_saves || 0), 0) || 0;
      const avgEngagement = articles?.reduce((sum, a) => sum + (a.engagement || 0), 0) / (articles?.length || 1) || 0;

      // Previous week stats for growth calculation
      const twoWeeksAgo = new Date();
      twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const previousWeekArticles = articles?.filter(a => {
        const createdAt = new Date(a.created_at);
        return createdAt >= twoWeeksAgo && createdAt < oneWeekAgo;
      }) || [];

      const prevWeekViews = previousWeekArticles.reduce((sum, a) => sum + (a.total_views || 0), 0);
      const prevWeekEngagement = previousWeekArticles.reduce((sum, a) => sum + (a.engagement || 0), 0) / (previousWeekArticles.length || 1);

      const currentWeekViews = currentWeekArticles.reduce((sum, a) => sum + (a.total_views || 0), 0);
      const currentWeekEngagement = currentWeekArticles.reduce((sum, a) => sum + (a.engagement || 0), 0) / (currentWeekArticles.length || 1);

      return {
        total_articles: articles?.length || 0,
        total_views: totalViews,
        total_engagement: avgEngagement,
        total_shares: totalShares,
        total_saves: totalSaves,
        weekly_growth: {
          views: prevWeekViews > 0 ? ((currentWeekViews - prevWeekViews) / prevWeekViews) * 100 : 0,
          engagement: prevWeekEngagement > 0 ? ((currentWeekEngagement - prevWeekEngagement) / prevWeekEngagement) * 100 : 0,
          articles: currentWeekArticles.length
        }
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  // Increment views (only for authenticated users, returns boolean indicating if view was counted)
  async incrementViews(id: string, readTime?: number, scrollPercentage?: number): Promise<boolean> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      
      // Only track views for authenticated users
      if (!user.user) {
        console.log('Skipping view tracking - user not authenticated');
        return false;
      }

      const { data, error } = await this.supabase.rpc('increment_article_views', {
        p_article_id: id,
        p_read_time_seconds: readTime || 0,
        p_scroll_percentage: scrollPercentage || 0
      });

      if (error) {
        console.error('Error incrementing views:', error);
        return false;
      }

      // Return whether a new view was actually counted
      return data === true;
    } catch (error) {
      console.error('Error incrementing views:', error);
      return false;
    }
  }

  // Toggle bookmark
  async toggleBookmark(id: string) {
    try {
      const { data, error } = await this.supabase.rpc('toggle_article_bookmark', {
        article_id: id
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      throw error;
    }
  }

  // Share article
  async shareArticle(id: string, platform?: string) {
    return this.trackEvent(id, 'share', {
      metadata: { platform }
    });
  }

  // Save article
  async saveArticle(id: string) {
    return this.trackEvent(id, 'save');
  }

  // Get article stats (legacy compatibility)
  async getArticleStats() {
    return this.getDashboardStats();
  }

  // =======================
  // FILE STORAGE
  // =======================

  // Add file upload method
  async uploadFile(file: File): Promise<string> {
    try {
      // Check file size (15MB limit)
      const maxSize = 15 * 1024 * 1024; // 15MB
      if (file.size > maxSize) {
        throw new Error(`File size exceeds 15MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `articles/${fileName}`;

      const { data, error } = await this.supabase.storage
        .from('articles-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        throw error;
      }

      // Get public URL
      const { data: urlData } = this.supabase.storage
        .from('articles-media')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  // Add method to delete file from storage
  async deleteFile(url: string): Promise<void> {
    try {
      // Extract file path from URL
      const urlParts = url.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const filePath = `articles/${fileName}`;

      const { error } = await this.supabase.storage
        .from('articles-media')
        .remove([filePath]);

      if (error) {
        console.error('Delete file error:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      // Don't throw here to avoid breaking article deletion
    }
  }

  // =======================
  // REAL-TIME & UTILITIES
  // =======================

  subscribeToArticleChanges(callback: (payload: any) => void) {
    return this.supabase
      .channel('article_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'articles' }, 
        callback
      )
      .subscribe();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }
}

export const articlesService = new ArticlesService();
export type { Article, ArticleInsert, ArticleUpdate }; 