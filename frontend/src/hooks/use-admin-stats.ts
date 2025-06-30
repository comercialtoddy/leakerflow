import { useState, useEffect } from 'react';
import { AdminService, type ApplicationStats } from '@/lib/supabase/admin';

export function useAdminStats() {
  const [stats, setStats] = useState<ApplicationStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    under_review: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const adminService = new AdminService();
        const statsData = await adminService.getApplicationStats();
        setStats(statsData);
      } catch (err) {
        console.error('Error loading admin stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to load stats');
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  return { stats, isLoading, error };
} 