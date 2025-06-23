interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

interface AuthorActivityItem {
  id: number;
  action: string;
  details: string;
  timestamp: string;
}

interface AuditLogEntry {
  id: string;
  action_by_user_id: string;
  action_timestamp: string;
  action_type: string;
  target_entity_type: string;
  target_entity_id: string;
  justification?: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  admin_name?: string;
  admin_email?: string;
}

// Analytics interfaces
interface AnalyticsOverview {
  total_articles: number;
  total_authors: number;
  total_users: number;
  total_views: number;
  articles_this_month: number;
  new_authors_this_month: number;
  application_approval_rate: number;
  average_engagement_rate: number;
}

interface TrendDataPoint {
  date: string;
  count: number;
}

interface ViewTrendDataPoint {
  date: string;
  views: number;
}

interface VoteTrendDataPoint {
  date: string;
  votes: number;
}

interface TrendsAnalytics {
  articles_per_day: TrendDataPoint[];
  views_per_day: ViewTrendDataPoint[];
  votes_per_day: VoteTrendDataPoint[];
}

interface CategoryDistribution {
  name: string;
  count: number;
  percentage: number;
}

interface TopAuthor {
  id: string;
  name?: string;
  email: string;
  articles: number;
  views: number;
  votes: number;
}

interface MonthlySubmission {
  month: string;
  count: number;
}

interface ApplicationsAnalytics {
  total_applications: number;
  pending_applications: number;
  approved_applications: number;
  rejected_applications: number;
  average_review_time: number;
  monthly_submissions: MonthlySubmission[];
}

interface EngagementAnalytics {
  total_bookmarks: number;
  average_time_on_page: number;
  bounce_rate: number;
  return_visitors: number;
  social_shares: number;
  comment_engagement: number;
}

class AdminApiClient {
  private baseUrl = '/api/admin';

  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data };
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      return { 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      };
    }
  }

  // Author management methods
  async suspendAuthor(authorId: number): Promise<ApiResponse> {
    return this.makeRequest(`/authors/${authorId}/suspend`, {
      method: 'POST',
    });
  }

  async activateAuthor(authorId: number): Promise<ApiResponse> {
    return this.makeRequest(`/authors/${authorId}/activate`, {
      method: 'POST',
    });
  }

  async deleteAuthor(authorId: number): Promise<ApiResponse> {
    return this.makeRequest(`/authors/${authorId}`, {
      method: 'DELETE',
    });
  }

  async getAuthorActivityHistory(authorId: number): Promise<ApiResponse<AuthorActivityItem[]>> {
    return this.makeRequest<AuthorActivityItem[]>(`/authors/${authorId}/activity-history`);
  }

  async getAuthors(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<ApiResponse<{ authors: any[]; total: number; page: number; limit: number }>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/authors?${queryString}` : '/authors';
    
    return this.makeRequest(endpoint);
  }

  // Application review methods
  async approveApplication(applicationId: string, reviewNotes: string): Promise<ApiResponse> {
    return this.makeRequest(`/applications/${applicationId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ review_notes: reviewNotes }),
    });
  }

  async rejectApplication(
    applicationId: string, 
    reviewNotes: string, 
    rejectionReason?: string
  ): Promise<ApiResponse> {
    return this.makeRequest(`/applications/${applicationId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ 
        review_notes: reviewNotes,
        rejection_reason: rejectionReason 
      }),
    });
  }

  async getApplications(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<ApiResponse<any[]>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/applications?${queryString}` : '/applications';
    
    return this.makeRequest(endpoint);
  }

  // Audit log methods
  async getAuditLogs(params?: {
    page?: number;
    limit?: number;
    action_by_user_id?: string;
    action_type?: string;
    target_entity_type?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<ApiResponse<{ logs: AuditLogEntry[]; total: number; page: number; limit: number }>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.append(key, value.toString());
        }
      });
    }
    
    const queryString = searchParams.toString();
    const endpoint = queryString ? `/audit-logs?${queryString}` : '/audit-logs';
    
    return this.makeRequest(endpoint);
  }

  async getAuditLogDetails(logId: string): Promise<ApiResponse<AuditLogEntry>> {
    return this.makeRequest(`/audit-logs/${logId}`);
  }

  async getAdminUsers(): Promise<ApiResponse<{ id: string; name: string; email: string }[]>> {
    return this.makeRequest('/admin-users');
  }

  // Analytics methods
  async getAnalyticsOverview(timeRange: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<ApiResponse<AnalyticsOverview>> {
    return this.makeRequest(`/analytics/overview?time_range=${timeRange}`);
  }

  async getAnalyticsTrends(timeRange: '7d' | '30d' | '90d' | '1y' = '30d'): Promise<ApiResponse<TrendsAnalytics>> {
    return this.makeRequest(`/analytics/trends?time_range=${timeRange}`);
  }

  async getAnalyticsCategories(): Promise<ApiResponse<{ categories: CategoryDistribution[] }>> {
    return this.makeRequest('/analytics/categories');
  }

  async getAnalyticsTopAuthors(limit: number = 10): Promise<ApiResponse<{ authors: TopAuthor[] }>> {
    return this.makeRequest(`/analytics/top-authors?limit=${limit}`);
  }

  async getAnalyticsApplications(): Promise<ApiResponse<ApplicationsAnalytics>> {
    return this.makeRequest('/analytics/applications');
  }

  async getAnalyticsEngagement(): Promise<ApiResponse<EngagementAnalytics>> {
    return this.makeRequest('/analytics/engagement');
  }

  async exportAnalyticsReport(params?: {
    format?: 'csv' | 'json';
    timeRange?: '7d' | '30d' | '90d' | '1y';
    includeSections?: string[];
  }): Promise<void> {
    try {
      const searchParams = new URLSearchParams();
      
      if (params?.format) {
        searchParams.append('format', params.format);
      }
      
      if (params?.timeRange) {
        searchParams.append('time_range', params.timeRange);
      }
      
      if (params?.includeSections && params.includeSections.length > 0) {
        searchParams.append('include_sections', params.includeSections.join(','));
      }
      
      const queryString = searchParams.toString();
      const endpoint = queryString ? `/analytics/export?${queryString}` : '/analytics/export';
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Accept': params?.format === 'json' ? 'application/json' : 'text/csv',
        },
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'analytics_report';
      
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename=([^;]+)/);
        if (filenameMatch) {
          filename = filenameMatch[1].replace(/"/g, '');
        }
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export error:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to export analytics report');
    }
  }
}

export const adminApi = new AdminApiClient();
export type { 
  AuthorActivityItem, 
  ApiResponse, 
  AuditLogEntry,
  AnalyticsOverview,
  TrendsAnalytics,
  CategoryDistribution,
  TopAuthor,
  ApplicationsAnalytics,
  EngagementAnalytics,
  TrendDataPoint,
  ViewTrendDataPoint,
  VoteTrendDataPoint,
  MonthlySubmission
}; 