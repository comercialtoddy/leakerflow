import { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useAdminUI } from '@/contexts/AdminContext';

export type AuthorStatus = 'checking' | 'approved' | 'pending' | 'rejected' | 'none';

interface AuthorApplication {
  id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  reviewed_by?: string;
  review_notes?: string;
}

export function useAuthorStatus() {
  const { user } = useAuth();
  const { showAdminUI, isLoadingAdminStatus } = useAdminUI();
  const [authorStatus, setAuthorStatus] = useState<AuthorStatus>('checking');
  const [application, setApplication] = useState<AuthorApplication | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthorStatus = async () => {
      if (!user) {
        setAuthorStatus('none');
        setIsLoading(false);
        return;
      }

      // Wait for admin status to load
      if (isLoadingAdminStatus) {
        return;
      }

      // If user is admin, grant immediate access
      if (showAdminUI) {
        setAuthorStatus('approved');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Check localStorage first for cached status
        const cachedStatus = localStorage.getItem(`author_status_${user.id}`);
        const cachedApplication = localStorage.getItem(`author_application_${user.id}`);
        
        if (cachedStatus && cachedApplication) {
          const parsedApplication = JSON.parse(cachedApplication);
          setApplication(parsedApplication);
          setAuthorStatus(cachedStatus as AuthorStatus);
          setIsLoading(false);
          
          // Still check backend but don't block UI
          checkBackendStatus();
        } else {
          // No cache, check backend immediately
          await checkBackendStatus();
        }
      } catch (error) {
        console.error('Error checking author status:', error);
        setAuthorStatus('none');
        setIsLoading(false);
      }
    };

    const checkBackendStatus = async () => {
      try {
        // TODO: Replace with actual API call to your backend
        // For now, simulate API call with localStorage persistence
        
        const existingApplication = localStorage.getItem(`author_application_${user!.id}`);
        
        if (existingApplication) {
          const app = JSON.parse(existingApplication);
          setApplication(app);
          
          // Map application status to author status
          const statusMapping: Record<string, AuthorStatus> = {
            'approved': 'approved',
            'pending': 'pending',
            'rejected': 'rejected'
          };
          
          const newStatus = statusMapping[app.status] || 'none';
          setAuthorStatus(newStatus);
          
          // Cache the status
          localStorage.setItem(`author_status_${user!.id}`, newStatus);
        } else {
          setAuthorStatus('none');
          localStorage.setItem(`author_status_${user!.id}`, 'none');
        }
      } catch (error) {
        console.error('Backend status check failed:', error);
        setAuthorStatus('none');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuthorStatus();
  }, [user, showAdminUI, isLoadingAdminStatus]);

  const submitApplication = async (applicationData: any) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // TODO: Replace with actual API call
      // For now, simulate submission with localStorage
      
      const newApplication: AuthorApplication = {
        id: `app_${Date.now()}`,
        user_id: user.id,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Store in localStorage (replace with actual API call)
      localStorage.setItem(`author_application_${user.id}`, JSON.stringify(newApplication));
      localStorage.setItem(`author_status_${user.id}`, 'pending');
      
      setApplication(newApplication);
      setAuthorStatus('pending');
      
      return newApplication;
    } catch (error) {
      console.error('Failed to submit application:', error);
      throw error;
    }
  };

  const refreshStatus = async () => {
    if (!user) return;
    
    setIsLoading(true);
    
    try {
      const existingApplication = localStorage.getItem(`author_application_${user.id}`);
      
      if (existingApplication) {
        const app = JSON.parse(existingApplication);
        setApplication(app);
        
        const statusMapping: Record<string, AuthorStatus> = {
          'approved': 'approved',
          'pending': 'pending',
          'rejected': 'rejected'
        };
        
        const newStatus = statusMapping[app.status] || 'none';
        setAuthorStatus(newStatus);
        localStorage.setItem(`author_status_${user.id}`, newStatus);
      } else {
        setAuthorStatus('none');
        localStorage.setItem(`author_status_${user.id}`, 'none');
      }
    } catch (error) {
      console.error('Failed to refresh status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    authorStatus,
    application,
    isLoading,
    submitApplication,
    refreshStatus,
    // Helper flags
    isApproved: authorStatus === 'approved',
    isPending: authorStatus === 'pending',
    isRejected: authorStatus === 'rejected',
    needsApplication: authorStatus === 'none' || authorStatus === 'rejected',
    hasAccess: authorStatus === 'approved' || showAdminUI
  };
} 