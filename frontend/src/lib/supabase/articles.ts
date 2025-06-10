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
      const { id, ...updateData } = articleData;

      // Validate payload size before sending
      const validatedData = this.validatePayloadSize(updateData);

      const updatePayload: ArticleUpdate = {
        ...validatedData,
        publish_date: validatedData.status === 'published' 
          ? (validatedData.publish_date ? new Date(validatedData.publish_date).toISOString() : new Date().toISOString())
          : undefined,
      };

      const { data, error } = await this.supabase
        .from('articles')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
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

  async toggleBookmark(id: string) {
    try {
      const { data, error } = await this.supabase
        .rpc('toggle_article_bookmark', { article_id: id });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      throw error;
    }
  }

  async incrementViews(id: string) {
    try {
      const { error } = await this.supabase
        .rpc('increment_article_views', { article_id: id });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error incrementing views:', error);
      throw error;
    }
  }

  async getArticleStats() {
    try {
      const { data, error } = await this.supabase
        .from('articles')
        .select('status, views, engagement');

      if (error) throw error;

      const stats = {
        totalArticles: data.length,
        publishedArticles: data.filter(a => a.status === 'published').length,
        draftArticles: data.filter(a => a.status === 'draft').length,
        totalViews: data.reduce((sum, a) => sum + (a.views || 0), 0),
        averageReadTime: '4.2 min', // This could be calculated from articles
        engagement: data.length > 0 
          ? data.reduce((sum, a) => sum + (a.engagement || 0), 0) / data.length 
          : 0,
      };

      return stats;
    } catch (error) {
      console.error('Error fetching article stats:', error);
      throw error;
    }
  }

  // Real-time subscription for articles changes
  subscribeToArticleChanges(callback: (payload: any) => void) {
    return this.supabase
      .channel('articles_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'articles' }, 
        callback
      )
      .subscribe();
  }

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
}

export const articlesService = new ArticlesService();
export type { Article, ArticleInsert, ArticleUpdate }; 