'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAccounts } from '@/hooks/use-accounts';
import type { Database } from '@/types/supabase';

type Account = Database['public']['Tables']['accounts']['Row'];

interface ArticleAccountContextValue {
  currentAccount: Account | null;
  setCurrentAccount: (account: Account) => void;
  isPersonalAccount: boolean;
  canPublishArticles: boolean;
  isLoading: boolean;
}

const ArticleAccountContext = createContext<ArticleAccountContextValue>({
  currentAccount: null,
  setCurrentAccount: () => {},
  isPersonalAccount: true,
  canPublishArticles: true,
  isLoading: true,
});

export function ArticleAccountProvider({ children }: { children: ReactNode }) {
  const { accounts, personalAccount, currentUserRole, isLoading: accountsLoading } = useAccounts();
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  
  // Initialize with personal account when available
  useEffect(() => {
    if (!currentAccount && personalAccount && !accountsLoading) {
      setCurrentAccount(personalAccount);
    }
  }, [personalAccount, currentAccount, accountsLoading]);
  
  // Check if user can publish articles in current account
  const canPublishArticles = currentUserRole === 'owner' || currentUserRole === 'admin';
  
  const value = {
    currentAccount,
    setCurrentAccount,
    isPersonalAccount: currentAccount?.personal_account || false,
    canPublishArticles,
    isLoading: accountsLoading || (!currentAccount && !accountsLoading),
  };
  
  return (
    <ArticleAccountContext.Provider value={value}>
      {children}
    </ArticleAccountContext.Provider>
  );
}

export const useArticleAccount = () => {
  const context = useContext(ArticleAccountContext);
  if (!context) {
    throw new Error('useArticleAccount must be used within ArticleAccountProvider');
  }
  return context;
}; 