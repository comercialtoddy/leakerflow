import { createClient } from '@/lib/supabase/client';

export interface AuthorApplication {
  id: string;
  user_id: string;
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
}

export interface ApplicationFormData {
  fullName: string;
  email: string;
  bio?: string;
  previousExperience?: string;
  portfolioUrl?: string;
  motivation: string;
  expertiseAreas: string[];
  sampleArticles: string[];
  twitterHandle?: string;
  linkedinHandle?: string;
}

export class AuthorApplicationsService {
  private supabase = createClient();

  /**
   * Get the current user's application status
   */
  async getUserApplicationStatus(): Promise<{
    has_application: boolean;
    application_id?: string;
    status?: string;
    submitted_at?: string;
    reviewed_at?: string;
    review_notes?: string;
    rejection_reason?: string;
    can_resubmit?: boolean;
    can_submit?: boolean;
    message?: string;
  }> {
    try {
      const { data, error } = await this.supabase.rpc('get_user_application_status');
      
      if (error) {
        console.error('Error getting user application status:', error);
        throw error;
      }

      return data || { has_application: false, can_submit: true };
    } catch (error) {
      console.error('Error in getUserApplicationStatus:', error);
      return { has_application: false, can_submit: true, message: 'Error checking status' };
    }
  }

  /**
   * Submit a new author application
   */
  async submitApplication(formData: ApplicationFormData): Promise<string> {
    try {
      // Convert form data to match database schema
      const portfolioLinks = [
        formData.portfolioUrl,
        ...formData.sampleArticles,
        formData.twitterHandle ? `https://twitter.com/${formData.twitterHandle.replace('@', '')}` : null,
        formData.linkedinHandle ? `https://linkedin.com/in/${formData.linkedinHandle.replace('linkedin.com/in/', '')}` : null,
      ].filter(Boolean) as string[];

      const writingExperience = [
        formData.previousExperience,
        formData.expertiseAreas.length > 0 ? `Areas of expertise: ${formData.expertiseAreas.join(', ')}` : null
      ].filter(Boolean).join('\n\n');

      const { data: applicationId, error } = await this.supabase.rpc('submit_author_application', {
        p_full_name: formData.fullName,
        p_email: formData.email,
        p_bio: formData.bio || null,
        p_writing_experience: writingExperience || null,
        p_portfolio_links: portfolioLinks.length > 0 ? portfolioLinks : null,
        p_motivation: formData.motivation
      });

      if (error) {
        console.error('Error submitting application:', error);
        throw new Error(error.message || 'Failed to submit application');
      }

      return applicationId;
    } catch (error) {
      console.error('Error in submitApplication:', error);
      throw error instanceof Error ? error : new Error('Failed to submit application');
    }
  }

  /**
   * Get user's application details
   */
  async getUserApplication(): Promise<AuthorApplication | null> {
    try {
      const { data, error } = await this.supabase
        .from('author_applications')
        .select('*')
        .eq('user_id', (await this.supabase.auth.getUser()).data.user?.id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No application found
          return null;
        }
        console.error('Error getting user application:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserApplication:', error);
      return null;
    }
  }

  /**
   * Check if user has author access (approved application)
   */
  async hasAuthorAccess(): Promise<boolean> {
    try {
      const status = await this.getUserApplicationStatus();
      return status.has_application && status.status === 'approved';
    } catch (error) {
      console.error('Error checking author access:', error);
      return false;
    }
  }
} 