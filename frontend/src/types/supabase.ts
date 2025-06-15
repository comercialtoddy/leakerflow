export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          user_id?: string | null;
        };
      };
      articles: {
        Row: {
          id: string;
          title: string;
          subtitle: string;
          content: string;
          category: string;
          tags: string[];
          author: string;
          status: 'draft' | 'published' | 'archived' | 'scheduled';
          media_items: any[];
          sources: any[];
          sections: any[];
          read_time: string;
          image_url: string | null;
          views: number;
          engagement: number;
          bookmarked: boolean;
          publish_date: string | null;
          created_at: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          subtitle: string;
          content: string;
          category: string;
          tags?: string[];
          author: string;
          status?: 'draft' | 'published' | 'archived' | 'scheduled';
          media_items?: any[];
          sources?: any[];
          sections?: any[];
          read_time: string;
          image_url?: string | null;
          views?: number;
          engagement?: number;
          bookmarked?: boolean;
          publish_date?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          id?: string;
          title?: string;
          subtitle?: string;
          content?: string;
          category?: string;
          tags?: string[];
          author?: string;
          status?: 'draft' | 'published' | 'archived' | 'scheduled';
          media_items?: any[];
          sources?: any[];
          sections?: any[];
          read_time?: string;
          image_url?: string | null;
          views?: number;
          engagement?: number;
          bookmarked?: boolean;
          publish_date?: string | null;
          created_at?: string;
          updated_at?: string;
          user_id?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      increment_article_views: {
        Args: {
          article_id: string;
        };
        Returns: void;
      };
      toggle_article_bookmark: {
        Args: {
          article_id: string;
        };
        Returns: boolean;
      };
      cleanup_old_articles: {
        Args: {};
        Returns: void;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
} 