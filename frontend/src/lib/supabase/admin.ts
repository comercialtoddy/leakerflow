import { createClient } from '@/lib/supabase/client';

export interface AuthorApplicationAdmin {
  id: string;
  user_id: string;
  user_email?: string;
  full_name: string;
  email: string;
  bio?: string;
  writing_experience?: string;
  portfolio_links?: string[];
  motivation: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  submitted_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  review_notes?: string;
  rejection_reason?: string;
  reviewer_email?: string;
}

export interface ApplicationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  under_review: number;
}

export class AdminService {
  private supabase = createClient();

  /**
   * Get all author applications for admin review
   */
  async getAuthorApplications(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuthorApplicationAdmin[]> {
    try {
      // Check if user is admin first
      const { data: isAdmin, error: adminError } = await this.supabase.rpc('is_global_admin');
      
      if (adminError || !isAdmin) {
        throw new Error('Unauthorized: Admin access required');
      }

      // Use the existing database function for listing applications
      const { data, error } = await this.supabase.rpc('list_author_applications', {
        p_status: options?.status || null,
        p_limit: options?.limit || 50,
        p_offset: options?.offset || 0
      });

      if (error) {
        console.error('Error fetching applications:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAuthorApplications:', error);
      throw error;
    }
  }

  /**
   * Get application statistics for dashboard
   */
  async getApplicationStats(): Promise<ApplicationStats> {
    try {
      const { data: isAdmin, error: adminError } = await this.supabase.rpc('is_global_admin');
      
      if (adminError || !isAdmin) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { data, error } = await this.supabase
        .from('author_applications')
        .select('status');

      if (error) {
        console.error('Error fetching application stats:', error);
        throw error;
      }

      const stats = (data || []).reduce((acc, app) => {
        acc.total++;
        acc[app.status as keyof ApplicationStats]++;
        return acc;
      }, {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        under_review: 0
      } as ApplicationStats);

      return stats;
    } catch (error) {
      console.error('Error in getApplicationStats:', error);
      return {
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        under_review: 0
      };
    }
  }

  /**
   * Review an author application
   */
  async reviewApplication(
    applicationId: string,
    status: 'approved' | 'rejected' | 'under_review',
    reviewNotes?: string,
    rejectionReason?: string
  ): Promise<boolean> {
    try {
      const { data: isAdmin, error: adminError } = await this.supabase.rpc('is_global_admin');
      
      if (adminError || !isAdmin) {
        throw new Error('Unauthorized: Admin access required');
      }

      const { data, error } = await this.supabase.rpc('review_author_application', {
        p_application_id: applicationId,
        p_status: status,
        p_review_notes: reviewNotes || null,
        p_rejection_reason: rejectionReason || null
      });

      if (error) {
        console.error('Error reviewing application:', error);
        throw error;
      }

      return data === true;
    } catch (error) {
      console.error('Error in reviewApplication:', error);
      throw error;
    }
  }
} 