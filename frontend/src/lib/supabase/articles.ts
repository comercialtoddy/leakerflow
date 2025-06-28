import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/supabase';

type Tables = Database['public']['Tables'];
type Article = Tables['articles']['Row'] & {
  saved?: boolean; // Add saved field until Supabase types are regenerated
};
type ArticleInsert = Tables['articles']['Insert'] & {
  // Add Basejump fields that might not be in the generated types yet
  account_id?: string;
  created_by_user_id?: string;
  visibility?: string;
};
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
  status: 'draft' | 'published' | 'archived' | 'scheduled' | 'pending_approval';
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
  accountId?: string;
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
  private readonly TOTAL_PAYLOAD_LIMIT = 1000000; // Total JSON payload limit (1MB - PostgreSQL can handle up to ~1GB per field)

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

  private async storeLargeDataInStorage(data: any, articleId: string, dataType: 'sections' | 'media_items' | 'sources'): Promise<string> {
    try {
      const fileName = `articles/${articleId}/${dataType}.json`;
      const contentData = JSON.stringify({ [dataType]: data, timestamp: new Date().toISOString() });
      
      const { data: uploadData, error } = await this.supabase.storage
        .from('articles-media')
        .upload(fileName, contentData, {
          contentType: 'application/json',
          upsert: true
        });

      if (error) throw error;
      return fileName;
    } catch (error) {
      console.error(`Error storing ${dataType} in storage:`, error);
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

  private async getLargeDataFromStorage(storagePath: string, dataType: 'sections' | 'media_items' | 'sources'): Promise<any> {
    try {
      const { data, error } = await this.supabase.storage
        .from('articles-media')
        .download(storagePath);

      if (error) throw error;
      
      const contentData = JSON.parse(await data.text());
      return contentData[dataType] || [];
    } catch (error) {
      console.error(`Error retrieving ${dataType} from storage:`, error);
      return []; // Return empty array as fallback
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

    // Generate article ID if not provided
    if (!articleId) {
      articleId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID()
        : `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Calculate total payload size
    const tempPayload = JSON.stringify(result);
    const totalPayloadSize = tempPayload.length;
    warnings.push(`Initial payload size: ${(totalPayloadSize / 1024).toFixed(2)} KB`);

    // Check individual field sizes and move large ones to storage
    const FIELD_SIZE_LIMIT = 100000; // 100KB per field

    // Handle content
    if (result.content && result.content.length > this.STORAGE_THRESHOLD) {
      try {
        const storagePath = await this.storeContentInStorage(result.content, articleId);
        result.content = `[STORED_IN_STORAGE:${storagePath}]`;
        result.content_storage_path = storagePath;
        result.content_size = data.content.length;
        warnings.push(`Content moved to storage: ${storagePath} (${(data.content.length / 1024).toFixed(2)} KB)`);
      } catch (storageError) {
        console.error('Failed to store content in storage:', storageError);
        throw new Error(`Unable to save article: Storage system error. Please try again.`);
      }
    }

    // Handle sections - store in storage if too large
    if (result.sections && Array.isArray(result.sections)) {
      const sectionsSize = JSON.stringify(result.sections).length;
      if (sectionsSize > FIELD_SIZE_LIMIT) {
        try {
          const storagePath = await this.storeLargeDataInStorage(result.sections, articleId, 'sections');
          result.sections = `[STORED_IN_STORAGE:${storagePath}]`;
          if (!result.sections_storage_path) {
            result.sections_storage_path = storagePath;
          }
          warnings.push(`Sections moved to storage: ${storagePath} (${(sectionsSize / 1024).toFixed(2)} KB)`);
        } catch (storageError) {
          console.error('Failed to store sections in storage:', storageError);
          // Fallback: reduce sections
          warnings.push(`Storage failed for sections, reducing content`);
          result.sections = result.sections.slice(0, 5).map((section: any) => ({
            ...section,
            content: section.content?.substring(0, 1000) || '',
            media: section.media?.slice(0, 3) || [],
            sources: section.sources?.slice(0, 5) || []
          }));
        }
      }
    }

    // Handle media_items - store in storage if too large
    if (result.media_items && Array.isArray(result.media_items)) {
      const mediaSize = JSON.stringify(result.media_items).length;
      if (mediaSize > FIELD_SIZE_LIMIT || result.media_items.length > this.MAX_MEDIA_ITEMS) {
        try {
          const storagePath = await this.storeLargeDataInStorage(result.media_items, articleId, 'media_items');
          result.media_items = `[STORED_IN_STORAGE:${storagePath}]`;
          if (!result.media_items_storage_path) {
            result.media_items_storage_path = storagePath;
          }
          warnings.push(`Media items moved to storage: ${storagePath} (${(mediaSize / 1024).toFixed(2)} KB)`);
        } catch (storageError) {
          console.error('Failed to store media_items in storage:', storageError);
          // Fallback: limit media items
          warnings.push(`Storage failed for media, limiting to ${this.MAX_MEDIA_ITEMS} items`);
          result.media_items = result.media_items.slice(0, this.MAX_MEDIA_ITEMS).map((item: any) => ({
            id: item.id,
            type: item.type,
            url: item.url?.substring(0, 2000) || '',
            name: item.name?.substring(0, 500) || '',
            size: item.size
          }));
        }
      }
    }

    // Handle sources - store in storage if too large
    if (result.sources && Array.isArray(result.sources)) {
      const sourcesSize = JSON.stringify(result.sources).length;
      if (sourcesSize > FIELD_SIZE_LIMIT || result.sources.length > this.MAX_SOURCES) {
        try {
          const storagePath = await this.storeLargeDataInStorage(result.sources, articleId, 'sources');
          result.sources = `[STORED_IN_STORAGE:${storagePath}]`;
          if (!result.sources_storage_path) {
            result.sources_storage_path = storagePath;
          }
          warnings.push(`Sources moved to storage: ${storagePath} (${(sourcesSize / 1024).toFixed(2)} KB)`);
        } catch (storageError) {
          console.error('Failed to store sources in storage:', storageError);
          // Fallback: limit sources
          warnings.push(`Storage failed for sources, limiting to ${this.MAX_SOURCES} items`);
          result.sources = result.sources.slice(0, this.MAX_SOURCES);
        }
      }
    }

    // Final payload check
    const finalPayload = JSON.stringify(result);
    const finalSize = finalPayload.length;
    warnings.push(`Final payload size: ${(finalSize / 1024).toFixed(2)} KB`);
    
    if (finalSize > this.TOTAL_PAYLOAD_LIMIT) {
      warnings.push(`Final payload still too large (${(finalSize / 1024).toFixed(2)} KB), please reduce content`);
      // Instead of truncating, throw an error with helpful message
      throw new Error(`Article is too large to save. Please reduce the number of sections, media items, or sources. Current size: ${(finalSize / 1024).toFixed(2)} KB, limit: ${(this.TOTAL_PAYLOAD_LIMIT / 1024).toFixed(2)} KB`);
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

      // Check saved status for all articles in one query
      let savedArticleIds: string[] = [];
      try {
        const { data: user } = await this.supabase.auth.getUser();
        if (user.user && articles.length > 0) {
          const articleIds = articles.map((a: any) => a.id);
          const { data: savedArticles } = await this.supabase
            .from('saved_articles')
            .select('article_id')
            .eq('user_id', user.user.id)
            .in('article_id', articleIds);
          
          savedArticleIds = savedArticles?.map(s => s.article_id) || [];
        }
      } catch (savedError) {
        console.warn('Could not check saved status:', savedError);
      }

      // Process articles and update saved status
      const processedArticles = await Promise.all(
        articles.map(async (article: any) => {
          // Update saved status based on our query
          const isSaved = savedArticleIds.includes(article.id);
          article.saved = isSaved;
          article.bookmarked = isSaved; // Keep both in sync
          
          return this.processArticleContent(article);
        })
      );

      return {
        articles: processedArticles,
        totalCount,
        hasMore: (offset + pageSize) < totalCount,
      };
    } catch (error) {
      console.error('Error fetching articles:', error);
      throw error;
    }
  }

  // New method for dashboard articles (user's own articles only)
  async getUserArticles(
    pagination: ArticlesPagination = { page: 1, pageSize: 10 },
    filters: ArticlesFilters = {}
  ) {
    try {
      const { page, pageSize } = pagination;
      const offset = (page - 1) * pageSize;

      // Use the new database function for user's own articles
      const { data, error } = await this.supabase.rpc('get_user_articles_paginated', {
        page_size: pageSize,
        page_offset: offset,
        filter_status: filters.status === 'all' ? null : filters.status,
        filter_category: filters.category === 'all' ? null : filters.category,
        filter_account_id: filters.accountId || null
      });

      if (error) throw error;

      // If we have search filters, we need to apply them post-query
      let articles = data || [];
      
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        articles = articles.filter((article: any) => 
          article.title?.toLowerCase().includes(searchLower) ||
          article.subtitle?.toLowerCase().includes(searchLower)
        );
      }

      const totalCount = articles.length > 0 ? articles[0].total_count : 0;

      // Check saved status for all articles in one query
      let savedArticleIds: string[] = [];
      try {
        const { data: user } = await this.supabase.auth.getUser();
        if (user.user && articles.length > 0) {
          const articleIds = articles.map((a: any) => a.id);
          const { data: savedArticles } = await this.supabase
            .from('saved_articles')
            .select('article_id')
            .eq('user_id', user.user.id)
            .in('article_id', articleIds);
          
          savedArticleIds = savedArticles?.map(s => s.article_id) || [];
        }
      } catch (savedError) {
        console.warn('Could not check saved status:', savedError);
      }

      // Process articles and update saved status
      const processedArticles = await Promise.all(
        articles.map(async (article: any) => {
          // Update saved status based on our query
          const isSaved = savedArticleIds.includes(article.id);
          article.saved = isSaved;
          article.bookmarked = isSaved; // Keep both in sync
          
          return this.processArticleContent(article);
        })
      );

      return {
        articles: processedArticles,
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
      let article = data?.find((a: any) => a.id === id);
      
      if (!article) {
        // Fallback to direct query if not found in paginated results
        const { data: fallbackData, error: fallbackError } = await this.supabase
          .from('articles')
          .select('*, upvotes, downvotes, vote_score, trend_score, is_trending, sections')
          .eq('id', id)
          .single();

        if (fallbackError) throw fallbackError;
        
        // Get user vote separately for fallback
        if (fallbackData) {
          fallbackData.user_vote = await this.getUserVote(id);
        }
        
        article = fallbackData;
      }

      // Check if user has saved this article using the saved_articles table
      if (article) {
        try {
          const { data: user } = await this.supabase.auth.getUser();
          if (user.user) {
            const { data: savedCheck } = await this.supabase
              .from('saved_articles')
              .select('id')
              .eq('article_id', id)
              .eq('user_id', user.user.id)
              .single();
            
            // Update the saved status based on saved_articles table
            article.saved = !!savedCheck;
            article.bookmarked = !!savedCheck; // Keep both in sync
          }
        } catch (savedError) {
          // If saved_articles table doesn't exist or error, keep original value
          console.warn('Could not check saved status:', savedError);
        }
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
    
    // If sections are stored in storage, retrieve them
    if (typeof data?.sections === 'string' && data.sections.startsWith('[STORED_IN_STORAGE:')) {
      const storagePath = data.sections.replace('[STORED_IN_STORAGE:', '').replace(']', '');
      try {
        data.sections = await this.getLargeDataFromStorage(storagePath, 'sections');
      } catch (storageError) {
        console.error('Error retrieving sections from storage:', storageError);
        data.sections = [];
      }
    }
    
    // If media_items are stored in storage, retrieve them
    if (typeof data?.media_items === 'string' && data.media_items.startsWith('[STORED_IN_STORAGE:')) {
      const storagePath = data.media_items.replace('[STORED_IN_STORAGE:', '').replace(']', '');
      try {
        data.media_items = await this.getLargeDataFromStorage(storagePath, 'media_items');
      } catch (storageError) {
        console.error('Error retrieving media_items from storage:', storageError);
        data.media_items = [];
      }
    }
    
    // If sources are stored in storage, retrieve them
    if (typeof data?.sources === 'string' && data.sources.startsWith('[STORED_IN_STORAGE:')) {
      const storagePath = data.sources.replace('[STORED_IN_STORAGE:', '').replace(']', '');
      try {
        data.sources = await this.getLargeDataFromStorage(storagePath, 'sources');
      } catch (storageError) {
        console.error('Error retrieving sources from storage:', storageError);
        data.sources = [];
      }
    }
    
    return data;
  }

  async createArticle(articleData: CreateArticleData) {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Get user's personal account (required for Basejump integration)
      const { data: personalAccount, error: accountError } = await this.supabase.rpc('get_personal_account');
      if (accountError || !personalAccount) {
        console.error('Error getting personal account:', accountError);
        throw new Error('Failed to get user account information');
      }

      // Pre-generate article ID for storage operations
      const articleId = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID()
        : `article_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Validate payload size before sending  
      const validatedData = await this.validatePayloadSize(articleData, articleId);

      // Determine visibility based on status
      // Only 'published' articles get 'public' visibility, everything else stays 'account'
      const visibility = validatedData.status === 'published' ? 'public' : 'account';

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
        user_id: user.user.id, // Keep for backward compatibility
        account_id: personalAccount.account_id, // Required for Basejump
        created_by_user_id: user.user.id, // Required for Basejump
        visibility: visibility, // Required for Basejump
        publish_date: validatedData.status === 'published' 
          ? (validatedData.publish_date ? new Date(validatedData.publish_date).toISOString() : new Date().toISOString())
          : null,
        // Only include hybrid storage fields if they exist
        ...(validatedData.content_storage_path && { content_storage_path: validatedData.content_storage_path }),
        ...(validatedData.content_size && { content_size: validatedData.content_size }),
        ...(validatedData.sections_storage_path && { sections_storage_path: validatedData.sections_storage_path }),
        ...(validatedData.media_items_storage_path && { media_items_storage_path: validatedData.media_items_storage_path }),
        ...(validatedData.sources_storage_path && { sources_storage_path: validatedData.sources_storage_path }),
      };

      // Enhanced debug logging
      console.log('=== CREATE ARTICLE DEBUG ===');
      console.log('Article ID:', articleId);
      console.log('User ID:', user.user.id);
      console.log('Account ID:', personalAccount.account_id);
      console.log('Visibility:', visibility);
      console.log('Status:', validatedData.status);
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

      // Determine visibility based on status if it's being changed
      const updatePayload = {
        ...validatedData,
        publish_date: validatedData.status === 'published' 
          ? (validatedData.publish_date ? new Date(validatedData.publish_date).toISOString() : new Date().toISOString())
          : null,
      };

      // Update visibility if status is being changed
      if (validatedData.status) {
        updatePayload.visibility = validatedData.status === 'published' ? 'public' : 'account';
      }

      const { data, error } = await this.supabase
        .from('articles')
        .update(updatePayload)
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
      // First, check if article has any content stored in storage
      const { data: article, error: fetchError } = await this.supabase
        .from('articles')
        .select('content_storage_path, sections_storage_path, media_items_storage_path, sources_storage_path')
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

      // Clean up all storage files if they exist
      const storagePathsToDelete = [];
      
      if (article?.content_storage_path) {
        storagePathsToDelete.push(article.content_storage_path);
      }
      if (article?.sections_storage_path) {
        storagePathsToDelete.push(article.sections_storage_path);
      }
      if (article?.media_items_storage_path) {
        storagePathsToDelete.push(article.media_items_storage_path);
      }
      if (article?.sources_storage_path) {
        storagePathsToDelete.push(article.sources_storage_path);
      }

      if (storagePathsToDelete.length > 0) {
        try {
          await this.supabase.storage
            .from('articles-media')
            .remove(storagePathsToDelete);
        } catch (storageError) {
          console.warn('Could not delete some storage files:', storageError);
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
  // ARTICLE APPROVAL SYSTEM
  // =======================

  // Submit article for approval
  async submitArticleForApproval(articleId: string) {
    try {
      const { data, error } = await this.supabase.rpc('submit_article_for_approval', {
        article_id: articleId
      });

      if (error) {
        console.error('Error submitting article for approval:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error submitting article for approval:', error);
      throw error;
    }
  }

  // Get pending articles (admin only)
  async getPendingArticles() {
    try {
      const { data, error } = await this.supabase.rpc('get_pending_articles');

      if (error) {
        console.error('Error getting pending articles:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error getting pending articles:', error);
      throw error;
    }
  }

  // Approve article (admin only)
  async approveArticle(articleId: string) {
    try {
      const { data, error } = await this.supabase.rpc('approve_article', {
        article_id: articleId
      });

      if (error) {
        console.error('Error approving article:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error approving article:', error);
      throw error;
    }
  }

  // Reject article (admin only)
  async rejectArticle(articleId: string, reason?: string) {
    try {
      const { data, error } = await this.supabase.rpc('reject_article', {
        article_id: articleId,
        reason: reason || null
      });

      if (error) {
        console.error('Error rejecting article:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error rejecting article:', error);
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

  // Get enhanced dashboard statistics
  async getEnhancedDashboardStats(daysBack: number = 30): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc('get_enhanced_dashboard_stats', {
        p_days_back: daysBack
      });

      if (error) {
        console.warn('Enhanced stats not available, falling back to basic stats:', error);
        // Fallback to basic stats if enhanced function doesn't exist
        return this.getBasicDashboardStatsWithStructure(daysBack);
      }
      
      // Check if we got empty data
      const hasData = data?.metrics?.total_views > 0 || 
                      data?.overview?.total_articles > 0;
      
      if (!hasData) {
        // If no data from enhanced stats, use basic stats with same structure
        return this.getBasicDashboardStatsWithStructure(daysBack);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching enhanced dashboard stats:', error);
      // Fallback to basic stats
      return this.getBasicDashboardStatsWithStructure(daysBack);
    }
  }

  // Helper method to get basic stats in the same structure as enhanced stats
  private async getBasicDashboardStatsWithStructure(daysBack: number = 30): Promise<any> {
    try {
      // Get current user
      const { data: userData } = await this.supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        console.warn('No authenticated user for dashboard stats');
        return this.getEmptyStatsStructure(daysBack);
      }

      // Get all articles (both user's own and published by others)
      const { data: articles, error } = await this.supabase
        .from('articles')
        .select('*')
        .or(`user_id.eq.${userId},and(status.eq.published,user_id.neq.${userId})`);

      if (error) {
        console.error('Error fetching articles for stats:', error);
        return this.getEmptyStatsStructure(daysBack);
      }

      const now = new Date();
      const periodStart = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
      
      // Filter articles for current period
      const currentPeriodArticles = articles?.filter(a => 
        new Date(a.created_at) >= periodStart
      ) || [];

      // Filter only user's articles for counts
      const userArticles = currentPeriodArticles.filter(a => a.user_id === userId);

      // Calculate basic metrics
      const totalArticles = userArticles.length;
      const publishedArticles = userArticles.filter(a => a.status === 'published').length;
      const draftArticles = userArticles.filter(a => a.status === 'draft').length;
      
      // Use all articles for view metrics (including others' published articles user might have viewed)
      const totalViews = currentPeriodArticles.reduce((sum, a) => sum + (a.total_views || a.views || 0), 0);
      const uniqueViews = currentPeriodArticles.reduce((sum, a) => sum + (a.unique_views || 0), 0);
      const totalShares = currentPeriodArticles.reduce((sum, a) => sum + (a.total_shares || 0), 0);
      const totalSaves = currentPeriodArticles.reduce((sum, a) => sum + (a.total_saves || 0), 0);
      const totalUpvotes = currentPeriodArticles.reduce((sum, a) => sum + (a.upvotes || 0), 0);
      const totalDownvotes = currentPeriodArticles.reduce((sum, a) => sum + (a.downvotes || 0), 0);
      
      const avgEngagement = currentPeriodArticles.length > 0
        ? currentPeriodArticles.reduce((sum, a) => sum + (a.engagement || 0), 0) / currentPeriodArticles.length
        : 0;

      // Return in the same structure as enhanced stats
      return {
        overview: {
          total_articles: totalArticles,
          published_articles: publishedArticles,
          draft_articles: draftArticles,
          trending_articles: currentPeriodArticles.filter(a => a.is_trending).length
        },
        metrics: {
          total_views: totalViews,
          unique_views: uniqueViews || totalViews, // Fallback to total views if unique not available
          total_shares: totalShares,
          total_saves: totalSaves,
          total_comments: 0, // Not available in basic stats
          total_upvotes: totalUpvotes,
          total_downvotes: totalDownvotes,
          avg_engagement: avgEngagement,
          avg_read_time: currentPeriodArticles.reduce((sum, a) => sum + (a.avg_read_time || 0), 0) / (currentPeriodArticles.length || 1),
          avg_bounce_rate: currentPeriodArticles.reduce((sum, a) => sum + (a.bounce_rate || 0), 0) / (currentPeriodArticles.length || 1)
        },
        growth: {
          articles: 0, // Can't calculate without historical data
          views: 0,
          shares: 0,
          saves: 0,
          engagement: 0
        },
        recent_activity: {
          views_24h: 0,
          shares_24h: 0,
          saves_24h: 0,
          active_articles_24h: 0
        },
        period: {
          start_date: periodStart.toISOString().split('T')[0],
          end_date: now.toISOString().split('T')[0],
          days: daysBack
        }
      };
    } catch (error) {
      console.error('Error in basic dashboard stats:', error);
      return this.getEmptyStatsStructure(daysBack);
    }
  }

  // Helper to get empty stats structure
  private getEmptyStatsStructure(daysBack: number): any {
    const now = new Date();
    const periodStart = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    
    return {
      overview: { total_articles: 0, published_articles: 0, draft_articles: 0, trending_articles: 0 },
      metrics: {
        total_views: 0, unique_views: 0, total_shares: 0, total_saves: 0,
        total_comments: 0, total_upvotes: 0, total_downvotes: 0,
        avg_engagement: 0, avg_read_time: 0, avg_bounce_rate: 0
      },
      growth: { articles: 0, views: 0, shares: 0, saves: 0, engagement: 0 },
      recent_activity: { views_24h: 0, shares_24h: 0, saves_24h: 0, active_articles_24h: 0 },
      period: { 
        start_date: periodStart.toISOString().split('T')[0], 
        end_date: now.toISOString().split('T')[0], 
        days: daysBack 
      }
    };
  }

  // Get analytics time series data
  async getAnalyticsTimeSeries(
    articleId?: string,
    daysBack: number = 30,
    metric: 'views' | 'shares' | 'saves' | 'engagement' = 'views'
  ): Promise<{ date: string; value: number }[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_analytics_time_series', {
        p_article_id: articleId || null,
        p_days_back: daysBack,
        p_metric: metric
      });

      if (error) {
        console.warn('Time series analytics not available:', error);
        // Return empty array for now
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching analytics time series:', error);
      return [];
    }
  }

  // Get top performing articles
  async getTopPerformingArticles(
    metric: 'views' | 'engagement' | 'shares' | 'saves' | 'trending' = 'views',
    limit: number = 5
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_top_performing_articles', {
        p_metric: metric,
        p_limit: limit
      });

      if (error) {
        console.warn('Top performing articles function not available, using fallback:', error);
        // Fallback to basic query
        return this.getTopArticlesFallback(metric, limit);
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching top performing articles:', error);
      return this.getTopArticlesFallback(metric, limit);
    }
  }

  // Fallback method for top articles
  private async getTopArticlesFallback(metric: string, limit: number): Promise<any[]> {
    try {
      let orderBy = 'total_views';
      switch (metric) {
        case 'engagement': orderBy = 'engagement'; break;
        case 'shares': orderBy = 'total_shares'; break;
        case 'saves': orderBy = 'total_saves'; break;
        case 'trending': orderBy = 'trend_score'; break;
      }

      const { data, error } = await this.supabase
        .from('articles')
        .select('*')
        .eq('status', 'published')
        .order(orderBy, { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      
      return data?.map(article => ({
        ...article,
        metric_value: article[orderBy] || 0
      })) || [];
    } catch (error) {
      console.error('Error in top articles fallback:', error);
      return [];
    }
  }

  // Get category analytics
  async getCategoryAnalytics(): Promise<any[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_category_analytics');

      if (error) {
        console.warn('Category analytics not available, using fallback:', error);
        // Fallback to basic aggregation
        return this.getCategoryAnalyticsFallback();
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching category analytics:', error);
      return this.getCategoryAnalyticsFallback();
    }
  }

  // Fallback for category analytics
  private async getCategoryAnalyticsFallback(): Promise<any[]> {
    try {
      // Get current user
      const { data: userData } = await this.supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        console.warn('No authenticated user for category analytics');
        return [];
      }

      const { data, error } = await this.supabase
        .from('articles')
        .select('category, total_views, total_shares, total_saves, engagement, avg_read_time, views')
        .or(`user_id.eq.${userId},and(status.eq.published,user_id.neq.${userId})`);

      if (error) throw error;

      // Group by category manually
      const categoryMap = new Map<string, any>();
      
      data?.forEach(article => {
        const existing = categoryMap.get(article.category) || {
          category: article.category,
          article_count: 0,
          total_views: 0,
          total_shares: 0,
          total_saves: 0,
          engagement_sum: 0,
          read_time_sum: 0
        };
        
        existing.article_count++;
        existing.total_views += article.total_views || article.views || 0;
        existing.total_shares += article.total_shares || 0;
        existing.total_saves += article.total_saves || 0;
        existing.engagement_sum += article.engagement || 0;
        existing.read_time_sum += article.avg_read_time || 0;
        
        categoryMap.set(article.category, existing);
      });

      return Array.from(categoryMap.values()).map(cat => ({
        category: cat.category,
        article_count: cat.article_count,
        total_views: cat.total_views,
        total_shares: cat.total_shares,
        total_saves: cat.total_saves,
        avg_engagement: cat.article_count > 0 ? Math.round((cat.engagement_sum / cat.article_count) * 100) / 100 : 0,
        avg_read_time: cat.article_count > 0 ? Math.round((cat.read_time_sum / cat.article_count) * 100) / 100 : 0
      })).sort((a, b) => b.total_views - a.total_views);
    } catch (error) {
      console.error('Error in category analytics fallback:', error);
      return [];
    }
  }

  // Get reader behavior insights
  async getReaderBehaviorInsights(articleId?: string): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc('get_reader_behavior_insights', {
        p_article_id: articleId || null
      });

      if (error) {
        console.warn('Reader behavior insights not available:', error);
        // Return default structure
        return {
          reading_patterns: {
            avg_read_time_seconds: 0,
            avg_scroll_depth: 0,
            unique_readers: 0,
            bounce_rate: 0,
            engagement_rate: 0,
            completion_rate: 0
          },
          time_distribution: {
            morning: 0,
            afternoon: 0,
            evening: 0,
            night: 0
          }
        };
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching reader behavior insights:', error);
      return {
        reading_patterns: {
          avg_read_time_seconds: 0,
          avg_scroll_depth: 0,
          unique_readers: 0,
          bounce_rate: 0,
          engagement_rate: 0,
          completion_rate: 0
        },
        time_distribution: {
          morning: 0,
          afternoon: 0,
          evening: 0,
          night: 0
        }
      };
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

  // Toggle bookmark (kept for backwards compatibility)
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

  // Save article (new method that tracks save event)
  async saveArticle(id: string) {
    try {
      const { data: user } = await this.supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      // Check if article is currently saved
      const { data: currentSave } = await this.supabase
        .from('saved_articles')
        .select('id')
        .eq('article_id', id)
        .eq('user_id', user.user.id)
        .single();

      if (currentSave) {
        // Remove save
        const { error } = await this.supabase
          .from('saved_articles')
          .delete()
          .eq('article_id', id)
          .eq('user_id', user.user.id);
        
        if (error) throw error;
        return false;
      } else {
        // Add save
        const { error } = await this.supabase
          .from('saved_articles')
          .insert({
            article_id: id,
            user_id: user.user.id
          });
        
        if (error) throw error;
        
        // Track save event
        try {
          await this.trackEvent(id, 'save');
        } catch (trackError) {
          console.warn('Failed to track save event:', trackError);
          // Don't fail the save operation if tracking fails
        }
        
        return true;
      }
    } catch (error) {
      console.error('Error saving article:', error);
      throw error;
    }
  }

  // Share article
  async shareArticle(id: string, platform?: string) {
    return this.trackEvent(id, 'share', {
      metadata: { platform }
    });
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



  // =======================
  // REAL-TIME ACTIVITY
  // =======================

  // Generate unique session ID for activity tracking
  private getSessionId(): string {
    if (typeof window !== 'undefined') {
      const existing = sessionStorage.getItem('article_session_id');
      if (existing) return existing;
      
      const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      sessionStorage.setItem('article_session_id', newSessionId);
      return newSessionId;
    }
    return 'server_session';
  }

  // Track real-time activity
  async trackRealtimeActivity(
    articleId: string,
    activityType: 'viewing' | 'reading' | 'typing_comment',
    metadata?: any
  ) {
    try {
      const { data, error } = await this.supabase.rpc('track_realtime_activity', {
        p_article_id: articleId,
        p_activity_type: activityType,
        p_session_id: this.getSessionId(),
        p_metadata: metadata || {}
      });

      if (error) {
        console.warn('Error tracking realtime activity:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error tracking realtime activity:', error);
      return null;
    }
  }

  // End real-time activity
  async endRealtimeActivity(
    articleId: string,
    activityType: 'viewing' | 'reading' | 'typing_comment'
  ) {
    try {
      const { data, error } = await this.supabase.rpc('end_realtime_activity', {
        p_article_id: articleId,
        p_activity_type: activityType,
        p_session_id: this.getSessionId()
      });

      if (error) {
        console.warn('Error ending realtime activity:', error);
        return false;
      }

      return data;
    } catch (error) {
      console.error('Error ending realtime activity:', error);
      return false;
    }
  }

  // Get active users for an article
  async getArticleActiveUsers(articleId: string, timeoutSeconds: number = 30) {
    try {
      const { data, error } = await this.supabase.rpc('get_article_active_users', {
        p_article_id: articleId,
        p_activity_timeout_seconds: timeoutSeconds
      });

      if (error) {
        console.warn('Error getting article active users:', error);
        return {
          total_active: 0,
          viewing: 0,
          reading: 0,
          typing_comment: 0,
          users: []
        };
      }

      return data;
    } catch (error) {
      console.error('Error getting article active users:', error);
      return {
        total_active: 0,
        viewing: 0,
        reading: 0,
        typing_comment: 0,
        users: []
      };
    }
  }

  // Get global active users summary
  async getGlobalActiveUsers(timeoutSeconds: number = 30) {
    try {
      const { data, error } = await this.supabase.rpc('get_global_active_users', {
        p_activity_timeout_seconds: timeoutSeconds
      });

      if (error) {
        console.warn('Error getting global active users:', error);
        return {
          total_active_users: 0,
          total_active_articles: 0,
          categories: []
        };
      }

      return data;
    } catch (error) {
      console.error('Error getting global active users:', error);
      return {
        total_active_users: 0,
        total_active_articles: 0,
        categories: []
      };
    }
  }

  // Subscribe to real-time activity changes
  subscribeToActivityChanges(articleId: string, callback: (payload: any) => void) {
    return this.supabase
      .channel(`article_activity:${articleId}`)
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'article_realtime_activity',
          filter: `article_id=eq.${articleId}`
        }, 
        callback
      )
      .subscribe();
  }

  // Subscribe to global activity changes
  subscribeToGlobalActivity(callback: (payload: any) => void) {
    return this.supabase
      .channel('global_article_activity')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'article_realtime_activity'
        }, 
        callback
      )
      .subscribe();
  }

  // =======================
  // HELPER METHODS
  // =======================

  // Format views count for display
  formatViewCount(views: number): string {
    if (!views || views === 0) return '0';
    
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    } else if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  }
}

export const articlesService = new ArticlesService();
export type { Article, ArticleInsert, ArticleUpdate }; 