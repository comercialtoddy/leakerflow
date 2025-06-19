'use client';

import { useAccounts } from '@/hooks/use-accounts';
import { useArticleAccount } from '@/contexts/ArticleAccountContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, Users } from 'lucide-react';

export function ArticleAccountSelector() {
  const { accounts, isLoading } = useAccounts();
  const { currentAccount, setCurrentAccount } = useArticleAccount();
  
  if (isLoading || !accounts) {
    return (
      <div className="h-10 w-[200px] bg-gray-100 animate-pulse rounded-md" />
    );
  }
  
  return (
    <Select
      value={currentAccount?.id}
      onValueChange={(accountId) => {
        const account = accounts.find(a => a.id === accountId);
        if (account) {
          setCurrentAccount(account);
        }
      }}
    >
      <SelectTrigger className="w-[200px]">
        <SelectValue>
          {currentAccount ? (
            <div className="flex items-center gap-2">
              {currentAccount.personal_account ? (
                <User className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              <span className="truncate">
                {currentAccount.personal_account ? 'Personal' : currentAccount.name}
              </span>
            </div>
          ) : (
            'Select account'
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                {account.image_url && (
                  <AvatarImage src={account.image_url} alt={account.name} />
                )}
                <AvatarFallback>
                  {account.personal_account ? (
                    <User className="h-3 w-3" />
                  ) : (
                    <Users className="h-3 w-3" />
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">
                {account.personal_account ? 'Personal Account' : account.name}
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
} 