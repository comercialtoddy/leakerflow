import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type Tables = Database['public']['Tables'];
type Article = Tables['articles']['Row'];
type ArticleInsert = Tables['articles']['Insert'];
type ArticleUpdate = Tables['articles']['Update'];

interface ArticleSection {
  id: string;
  title: string;
  content: string;
  media: MediaItem[];
  sources: SourceItem[];
  order: number;
}

interface SourceItem {
  id: string;
  title: string;
  url: string;
  description?: string;
}

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
  sections?: ArticleSection[];
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

  // Updated size limits for hybrid storage
  private readonly MAX_CONTENT_SIZE = 50000; // 50K characters before using storage
  private readonly MAX_MEDIA_ITEMS = 20; // Maximum 20 media items
  private readonly MAX_SOURCES = 50; // Maximum 50 sources
  private readonly STORAGE_THRESHOLD = 4000; // Store content in storage if larger than 4KB
  private readonly TOTAL_PAYLOAD_LIMIT = 7000; // Total JSON payload limit (7KB to be safe)

  private async storeContentInStorage(content: string, articleId: string): Promise<string> {
    try {
      const fileName = `articles/${articleId}/content.json`;
      const contentData = JSON.stringify({ content, timestamp: new Date().toISOString() });
      
      const { data, error } = await this.supabase.storage
        .from('articles-media')
        .upload(fileName, contentData, {
          contentType: 'application/json',
          upsert: true
        });

      if (error) throw error;
      return fileName;
    } catch (error) {
      console.error('Error storing content in storage:', error);
      throw error;
    }
  }

  private async getContentFromStorage(storagePath: string): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from('articles-media')
        .download(storagePath);

      if (error) throw error;
      
      const contentData = JSON.parse(await data.text());
      return contentData.content;
    } catch (error) {
      console.error('Error retrieving content from storage:', error);
      throw error;
    }
  }

  private optimizeContentForDatabase(content: string): string {
    // Smart content optimization that preserves structure but reduces size
    
    // Remove excessive whitespace and empty lines
    let optimized = content
      .replace(/\n\s*\n\s*\n/g, '\n\n') // Reduce multiple empty lines to double line break
      .replace(/\s{3,}/g, ' ') // Reduce multiple spaces to single space
      .trim();

    // If still too large, remove some HTML attributes that aren't essential
    if (optimized.length > 2500) {
      optimized = optimized
        .replace(/data-start="[^"]*"/g, '') // Remove data-start attributes
        .replace(/data-end="[^"]*"/g, '') // Remove data-end attributes
        .replace(/style="[^"]*"/g, '') // Remove inline styles
        .replace(/class="[^"]*"/g, ''); // Remove class attributes
    }

    // Final safety: if still too large, truncate but preserve last closing tags
    if (optimized.length > 3000) {
      const truncated = optimized.substring(0, 2800);
      const lastCompleteTag = truncated.lastIndexOf('</');
      if (lastCompleteTag > 2500) {
        optimized = truncated.substring(0, lastCompleteTag) + '</p>';
      } else {
        optimized = truncated + '...</p>';
      }
    }

    return optimized;
  }

  private async validatePayloadSize(data: any, articleId?: string): Promise<any> {
    const result = { ...data };
    const warnings: string[] = [];

    // Check if content should be moved to storage (either by content size or total payload size)
    let shouldUseStorage = false;
    let totalPayloadSize = 0;

    // First check: individual content size
    if (result.content && result.content.length > this.STORAGE_THRESHOLD) {
      shouldUseStorage = true;
      warnings.push(`Content size (${result.content.length} chars) exceeds threshold`);
    }

    // Second check: total payload size
    if (!shouldUseStorage) {
      const tempPayload = JSON.stringify(result);
      totalPayloadSize = tempPayload.length;
      if (totalPayloadSize > this.TOTAL_PAYLOAD_LIMIT) {
        shouldUseStorage = true;
        warnings.push(`Total payload size (${totalPayloadSize} bytes) exceeds limit`);
      }
    }

    // Move content to storage if needed
    if (shouldUseStorage && result.content) {
      if (!articleId) {
        // Fallback for environments without crypto.randomUUID
        articleId = typeof crypto !== 'undefined' && crypto.randomUUID 
          ? crypto.randomUUID()
          : `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      }
      
      try {
        // Store content in storage and replace with reference
        const storagePath = await this.storeContentInStorage(result.content, articleId);
        result.content = `[STORED_IN_STORAGE:${storagePath}]`;
        result.content_storage_path = storagePath;
        result.content_size = data.content.length;
        warnings.push(`Content moved to storage: ${storagePath}`);
      } catch (storageError) {
        console.error('Failed to store content in storage:', storageError);
        // Smart fallback: try to break content into manageable chunks
        if (result.content.length > 3000) {
          warnings.push(`Storage failed, attempting smart content optimization`);
          result.content = this.optimizeContentForDatabase(result.content);
          warnings.push(`Content optimized to ${result.content.length} chars`);
        } else {
          // If content is already small but still causing issues, throw error
          throw new Error(`Unable to save article: Storage system unavailable and content format incompatible. Please try again later.`);
        }
      }
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

    // Clean up media items
    if (result.media_items && Array.isArray(result.media_items)) {
      result.media_items = result.media_items.map((item: any) => ({
        id: item.id,
        type: item.type,
        url: item.url?.substring(0, 2000) || '',
        name: item.name?.substring(0, 500) || '',
        size: item.size
      }));
    }

    // Final safety check: ensure total payload is under limit
    const finalPayload = JSON.stringify(result);
    const finalSize = finalPayload.length;
    
    if (finalSize > this.TOTAL_PAYLOAD_LIMIT) {
      warnings.push(`Final payload still too large (${finalSize} bytes), performing emergency truncation`);
      
      // Emergency truncation of all string fields
      if (result.content && !result.content.startsWith('[STORED_IN_STORAGE:')) {
        result.content = result.content.substring(0, 500) + '\n[Emergency truncation applied]';
      }
      if (result.subtitle && result.subtitle.length > 200) {
        result.subtitle = result.subtitle.substring(0, 200) + '...';
      }
      if (result.title && result.title.length > 100) {
        result.title = result.title.substring(0, 100) + '...';
      }
      
      // Reduce arrays if still too large
      if (result.media_items && result.media_items.length > 5) {
        result.media_items = result.media_items.slice(0, 5);
      }
      if (result.sources && result.sources.length > 10) {
        result.sources = result.sources.slice(0, 10);
      }
    }

    if (warnings.length > 0) {
      console.warn('Article payload optimizations:', warnings);
    }

    return result;
  }

  // Helper method to get size limits for UI display
  getSizeLimits() {
    return {
      maxContentSize: this.MAX_CONTENT_SIZE,
      maxMediaItems: this.MAX_MEDIA_ITEMS,
      maxSources: this.MAX_SOURCES,
      storageThreshold: this.STORAGE_THRESHOLD,
      totalPayloadLimit: this.TOTAL_PAYLOAD_LIMIT,
      maxContentSizeFormatted: `${(this.MAX_CONTENT_SIZE / 1000).toFixed(0)}KB`,
      storageThresholdFormatted: `${(this.STORAGE_THRESHOLD / 1000).toFixed(1)}KB`,
      totalPayloadLimitFormatted: `${(this.TOTAL_PAYLOAD_LIMIT / 1000).toFixed(1)}KB`
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

      // Use the database function that includes voting fields and user vote status
      const { data, error } = await this.supabase.rpc('get_articles_paginated', {
        page_size: pageSize,
        page_offset: offset,
        filter_status: filters.status === 'all' ? null : (filters.status || 'published'),
        filter_category: filters.category === 'all' ? null : filters.category
      });

      if (error) throw error;

      // If we have search filters, we need to apply them post-query
      // since the function doesn't support search yet
      let articles = data || [];
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        articles = articles.filter((article: any) => 
          article.title?.toLowerCase().includes(searchLower) ||
          article.subtitle?.toLowerCase().includes(searchLower)
        );
      }

      const totalCount = articles.length > 0 ? articles[0].total_count : 0;

      return {
        articles,
        totalCount,
        hasMore: (offset + pageSize) < totalCount,
      };
    } catch (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }
  }

  async getArticleById(id: string) {
    try {
      // First get the article with all fields including voting data
      const { data, error } = await this.supabase.rpc('get_articles_paginated', {
        page_size: 1,
        page_offset: 0,
        filter_status: null, // Get any status if user owns it
        filter_category: null
      });

      if (error) throw error;

      // Find the specific article by ID
      const article = data?.find((a: any) => a.id === id);
      
      if (!article) {
        // Fallback to direct query if not found in paginated results
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from('articles')
          .select('*, upvotes, downvotes, vote_score, trend_score, is_trending')
          .eq('id', id)
          .single();

        if (fallbackError) throw fallbackError;
        
        // Get user vote separately for fallback
        if (fallbackData) {
          fallbackData.user_vote = await this.getUserVote(id);
        }
        
        return this.processArticleContent(fallbackData);
      }

      return this.processArticleContent(article);
    } catch (error) {
      console.error('Error fetching article:', error);
      throw error;
    }
  }

  private async processArticleContent(data: any) {
    if (!data) return null;
    
    // If content is stored in storage, retrieve it
    if (data?.content?.startsWith('[STORED_IN_STORAGE:')) {
      const storagePath = data.content.replace('[STORED_IN_STORAGE:', '').replace(']', '');
      try {
        data.content = await this.getContentFromStorage(storagePath);
      } catch (storageError) {
        console.error('Error retrieving content from storage:', storageError);
        data.content = '[Content temporarily unavailable - stored content could not be retrieved]';
      }
    }
    
    return data;
  }

  async createArticle(articleData: CreateArticleData) {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Pre-generate article ID for storage operations
      const articleId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID()
        : `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Validate payload size before sending  
      const validatedData = await this.validatePayloadSize(articleData, articleId);

      // Clean the data to only include fields that exist in the database
      const insertData: ArticleInsert = {
        id: articleId,
        title: validatedData.title,
        subtitle: validatedData.subtitle,
        content: validatedData.content,
        category: validatedData.category,
        tags: validatedData.tags || [],
        author: validatedData.author,
        status: validatedData.status,
        media_items: validatedData.media_items || [],
        sources: validatedData.sources || [],
        sections: validatedData.sections || [],
        read_time: validatedData.read_time,
        image_url: validatedData.image_url,
        user_id: user.user.id,
        publish_date: validatedData.status === 'published' 
          ? (validatedData.publish_date ? new Date(validatedData.publish_date).toISOString() : new Date().toISOString())
          : null,
        // Only include hybrid storage fields if they exist
        ...(validatedData.content_storage_path && { content_storage_path: validatedData.content_storage_path }),
        ...(validatedData.content_size && { content_size: validatedData.content_size }),
      };

      // Enhanced debug logging
      console.log('=== CREATE ARTICLE DEBUG ===');
      console.log('Article ID:', articleId);
      console.log('Original content length:', articleData.content?.length || 0);
      console.log('Final content length:', validatedData.content?.length || 0);
      console.log('Storage path:', validatedData.content_storage_path);
      console.log('Content starts with storage ref:', validatedData.content?.startsWith('[STORED_IN_STORAGE:'));
      console.log('Insert data keys:', Object.keys(insertData));
      console.log('Total payload size:', JSON.stringify(insertData).length, 'bytes');
      console.log('Payload limit:', this.TOTAL_PAYLOAD_LIMIT, 'bytes');

      const { data, error } = await this.supabase
        .from('articles')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('=== SUPABASE ERROR DETAILS ===');
        console.error('Code:', error.code);
        console.error('Message:', error.message);
        console.error('Details:', error.details);
        console.error('Hint:', error.hint);
        console.error('Insert data that caused error:', insertData);
        throw new Error(`Database error: ${error.message} (${error.code})`);
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

      // First, check if the article exists and verify ownership
      const { data: existingArticle, error: fetchError } = await this.supabase
        .from('articles')
        .select('id, user_id, title')
        .eq('id', id)
        .single();

      if (fetchError) {
        console.error('Error fetching article for update:', fetchError);
        if (fetchError.code === 'PGRST116') {
          throw new Error('Article not found. It may have been deleted or you may not have permission to access it.');
        }
        throw fetchError;
      }

      // Debug authentication and ownership
      console.log('=== AUTHENTICATION DEBUG ===');
      console.log('Current user ID:', user.user.id);
      console.log('Article user ID:', existingArticle.user_id);
      console.log('Article ID:', id);
      console.log('Article title:', existingArticle.title);
      console.log('User IDs match:', user.user.id === existingArticle.user_id);

      if (user.user.id !== existingArticle.user_id) {
        throw new Error('You do not have permission to update this article. Only the article author can make changes.');
      }

      // Validate payload size before sending
      const validatedData = await this.validatePayloadSize(updateData, id);

      // Debug logging
      console.log('=== UPDATE PAYLOAD DEBUG ===');
      console.log('Content length:', validatedData.content?.length || 0);
      console.log('Media items count:', validatedData.media_items?.length || 0);
      console.log('Sources count:', validatedData.sources?.length || 0);
      console.log('Sections count:', validatedData.sections?.length || 0);

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
        console.error('=== UPDATE ERROR DEBUG ===');
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        
        if (error.code === 'PGRST116') {
          throw new Error('Failed to update article. The article may have been deleted or you may have lost permission to edit it.');
        }
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
      // First, check if article has content stored in storage
      const { data: article, error: fetchError } = await this.supabase
        .from('articles')
        .select('content_storage_path')
        .eq('id', id)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      // Delete the article from database
      const { error } = await this.supabase
        .from('articles')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Clean up storage content if exists
      if (article?.content_storage_path) {
        try {
          await this.supabase.storage
            .from('articles-media')
            .remove([article.content_storage_path]);
        } catch (storageError) {
          console.warn('Could not delete storage content:', storageError);
          // Don't fail the entire operation if storage cleanup fails
        }
      }

      return true;
    } catch (error) {
      console.error('Error deleting article:', error);
      throw error;
    }
  }

  // =======================
  // METRICS & ANALYTICS
  // =======================

  // Vote on article (upvote or downvote)
  async voteOnArticle(articleId: string, voteType: 'upvote' | 'downvote') {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      
      // Only authenticated users can vote
      if (!user.user) {
        throw new Error('User must be authenticated to vote');
      }

      const { data, error } = await this.supabase.rpc('vote_on_article', {
        p_article_id: articleId,
        p_vote_type: voteType
      });

      if (error) {
        console.error('Error voting on article:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error voting on article:', error);
      throw error;
    }
  }

  // Get user's vote status for an article
  async getUserVote(articleId: string): Promise<string | null> {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      
      if (!user.user) {
        return null;
      }

      const { data, error } = await this.supabase.rpc('get_user_vote', {
        p_article_id: articleId
      });

      if (error) {
        console.error('Error getting user vote:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error getting user vote:', error);
      return null;
    }
  }

  // Track article events (only for authenticated users)
  async trackEvent(
    articleId: string, 
    eventType: 'view' | 'share' | 'save' | 'comment' | 'like' | 'bookmark' | 'upvote' | 'downvote',
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

  // Get articles for current user
  async getUserArticles() {
    try {
      const { data, error } = await this.supabase
        .from('articles')
        .select('id, title, status, created_at, user_id')
        .eq('user_id', (await this.supabase.auth.getUser()).data.user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching user articles:', error);
      throw error;
    }
  }
}

export const articlesService = new ArticlesService();
export type { Article, ArticleInsert, ArticleUpdate }; 