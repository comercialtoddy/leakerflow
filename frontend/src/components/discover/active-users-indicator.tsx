import React from 'react';
import { Users, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useGlobalActiveUsers, useGlobalActivitySubscription } from '@/hooks/react-query/articles/use-articles';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ActiveUsersIndicatorProps {
  className?: string;
}

export const ActiveUsersIndicator = React.memo(function ActiveUsersIndicator({
  className
}: ActiveUsersIndicatorProps) {
  const { data: activeUsers } = useGlobalActiveUsers();
  useGlobalActivitySubscription();

  const totalActive = activeUsers?.total_active_users || 0;
  const activeArticles = activeUsers?.total_active_articles || 0;

  if (totalActive === 0) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800",
            "text-green-700 dark:text-green-300 text-sm",
            "animate-in fade-in slide-in-from-top-2 duration-300",
            className
          )}>
            <div className="relative">
              <Activity className="h-4 w-4" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            </div>
            <span className="font-medium">{totalActive}</span>
            <span className="text-xs text-green-600 dark:text-green-400">
              {totalActive === 1 ? 'user' : 'users'} active
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">Real-time Activity</p>
            <p className="text-xs text-muted-foreground">
              {totalActive} {totalActive === 1 ? 'user is' : 'users are'} reading {activeArticles} {activeArticles === 1 ? 'article' : 'articles'}
            </p>
            {activeUsers?.categories && activeUsers.categories.length > 0 && (
              <div className="pt-1 space-y-0.5">
                {activeUsers.categories.slice(0, 3).map((cat: any) => (
                  <p key={cat.category} className="text-xs text-muted-foreground">
                    {cat.category}: {cat.active_users} {cat.active_users === 1 ? 'user' : 'users'}
                  </p>
                ))}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

interface ArticleActiveUsersProps {
  articleId: string;
  className?: string;
}

export const ArticleActiveUsers = React.memo(function ArticleActiveUsers({
  articleId,
  className
}: ArticleActiveUsersProps) {
  const { data: activeUsers } = useGlobalActiveUsers();
  
  const viewing = activeUsers?.viewing || 0;
  const reading = activeUsers?.reading || 0;
  const total = activeUsers?.total_active || 0;

  if (total === 0) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center gap-2 text-sm text-muted-foreground",
      className
    )}>
      <Users className="h-4 w-4" />
      <span>{total} {total === 1 ? 'person' : 'people'} viewing</span>
      {reading > 0 && (
        <>
          <span>•</span>
          <span>{reading} reading</span>
        </>
      )}
    </div>
  );
}); 