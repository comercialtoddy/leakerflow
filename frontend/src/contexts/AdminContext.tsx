'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';

interface AdminContextValue {
  isAdmin: boolean | null;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

const AdminContext = createContext<AdminContextValue>({
  isAdmin: null,
  isLoading: true,
  isError: false,
  error: null,
  refetch: () => {},
});

export function AdminProvider({ children }: { children: ReactNode }) {
  const supabase = createClient();
  
  const {
    data: isAdmin,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<boolean, Error>({
    queryKey: ['adminStatus'],
    queryFn: async () => {
      // Check if user is authenticated first
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Error getting authenticated user:', authError);
        throw authError;
      }
      
      // If no user is authenticated, they're not an admin
      if (!user) {
        return false;
      }
      
      // Call the is_global_admin RPC function
      const { data, error } = await supabase.rpc('is_global_admin');
      
      if (error) {
        console.error('Error checking admin status:', error);
        throw error;
      }
      
      return data as boolean;
    },
    staleTime: 5 * 60 * 1000, // Data considered fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Data stays in cache for 10 minutes (replaces cacheTime)
    retry: (failureCount, error) => {
      // Don't retry if it's an auth error
      if (error?.message?.includes('auth') || error?.message?.includes('unauthorized')) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Only run the query if we're in the browser
    enabled: typeof window !== 'undefined',
  });

  const value: AdminContextValue = {
    isAdmin: isAdmin ?? null,
    isLoading,
    isError,
    error,
    refetch,
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
}

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

// Convenience hook for checking if user is admin (returns false if loading or error)
export const useIsAdmin = (): boolean => {
  const { isAdmin, isLoading, isError } = useAdmin();
  return !isLoading && !isError && isAdmin === true;
};

// Hook for components that need to show admin UI conditionally
export const useAdminUI = () => {
  const { isAdmin, isLoading, isError } = useAdmin();
  
  return {
    showAdminUI: !isLoading && !isError && isAdmin === true,
    isLoadingAdminStatus: isLoading,
    hasAdminError: isError,
  };
}; 