import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VotingButtonsProps {
  upvotes: number;
  downvotes: number;
  userVote: 'upvote' | 'downvote' | null;
  onVote: (voteType: 'upvote' | 'downvote') => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'card' | 'inline' | 'article';
  disabled?: boolean;
}

export const VotingButtons = React.memo(function VotingButtons({
  upvotes = 0,
  downvotes = 0,
  userVote,
  onVote,
  size = 'sm',
  variant = 'card',
  disabled = false
}: VotingButtonsProps) {
  const voteScore = upvotes - downvotes;
  
  const handleUpvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onVote('upvote');
    }
  };

  const handleDownvote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onVote('downvote');
    }
  };

  // Size configurations
  const sizeConfig = {
    sm: {
      container: 'gap-0.5',
      button: 'h-6 w-6 p-0',
      icon: 'h-3 w-3',
      text: 'text-xs'
    },
    md: {
      container: 'gap-1',
      button: 'h-7 w-7 p-0',
      icon: 'h-3.5 w-3.5',
      text: 'text-sm'
    },
    lg: {
      container: 'gap-1',
      button: 'h-8 w-8 p-0',
      icon: 'h-4 w-4',
      text: 'text-sm'
    }
  };

  // Variant configurations
  const variantConfig = {
    card: 'bg-background/80 backdrop-blur border border-border/50',
    inline: 'bg-transparent',
    article: 'bg-background border border-border'
  };

  const config = sizeConfig[size];

  return (
    <div className={cn(
      "flex flex-col items-center rounded-lg p-1",
      variantConfig[variant],
      config.container
    )}>
      {/* Upvote Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleUpvote}
        disabled={disabled}
        className={cn(
          config.button,
          "transition-all duration-200 hover:scale-110",
          userVote === 'upvote' 
            ? "text-orange-500 hover:text-orange-600 bg-orange-50 dark:bg-orange-950" 
            : "text-muted-foreground hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-950/50"
        )}
      >
        <ChevronUp 
          className={cn(
            config.icon,
            "transition-all duration-200",
            userVote === 'upvote' && "fill-current"
          )} 
        />
        <span className="sr-only">Upvote</span>
      </Button>

      {/* Vote Score */}
      <span className={cn(
        "font-medium transition-colors duration-200 min-w-[20px] text-center",
        config.text,
        voteScore > 0 
          ? "text-orange-600 dark:text-orange-400" 
          : voteScore < 0 
            ? "text-blue-600 dark:text-blue-400"
            : "text-muted-foreground"
      )}>
        {voteScore > 0 ? `+${voteScore}` : voteScore}
      </span>

      {/* Downvote Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownvote}
        disabled={disabled}
        className={cn(
          config.button,
          "transition-all duration-200 hover:scale-110",
          userVote === 'downvote' 
            ? "text-blue-500 hover:text-blue-600 bg-blue-50 dark:bg-blue-950" 
            : "text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/50"
        )}
      >
        <ChevronDown 
          className={cn(
            config.icon,
            "transition-all duration-200",
            userVote === 'downvote' && "fill-current"
          )} 
        />
        <span className="sr-only">Downvote</span>
      </Button>
    </div>
  );
}); 