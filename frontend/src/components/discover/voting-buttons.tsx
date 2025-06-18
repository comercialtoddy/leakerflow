'use client';

import React from 'react';
import { ArrowUp, ArrowDown, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VotingButtonsProps {
  upvotes: number;
  downvotes: number;
  userVote: 'upvote' | 'downvote' | null;
  onVote: (voteType: 'upvote' | 'downvote') => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'card' | 'article' | 'inline';
  className?: string;
}

export const VotingButtons = React.memo(function VotingButtons({
  upvotes,
  downvotes,
  userVote,
  onVote,
  size = 'sm',
  variant = 'default',
  className
}: VotingButtonsProps) {
  const handleVote = (e: React.MouseEvent, voteType: 'upvote' | 'downvote') => {
    e.stopPropagation();
    onVote(voteType);
  };

  const voteScore = upvotes - downvotes;

  // Size configurations
  const sizeClasses = {
    sm: {
      button: 'h-6 w-6 p-0',
      icon: 'h-3 w-3',
      text: 'text-xs',
      container: 'p-0.5 gap-0.5'
    },
    md: {
      button: 'h-8 w-8 p-0',
      icon: 'h-4 w-4',
      text: 'text-sm',
      container: 'p-1 gap-1'
    },
    lg: {
      button: 'h-10 w-10 p-0',
      icon: 'h-5 w-5',
      text: 'text-base',
      container: 'p-1.5 gap-1.5'
    }
  };

  const config = sizeClasses[size];

  // Inline variant for article pages - horizontal layout
  if (variant === 'inline') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => handleVote(e, 'upvote')}
          className={cn(
            "gap-1.5 px-3 h-9",
            userVote === 'upvote' 
              ? "text-primary bg-primary/10 hover:bg-primary/20" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ThumbsUp className={cn("h-4 w-4", userVote === 'upvote' && "fill-current")} />
          <span className="font-medium">{upvotes}</span>
        </Button>
        
        <div className="h-5 w-px bg-border" />
        
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => handleVote(e, 'downvote')}
          className={cn(
            "gap-1.5 px-3 h-9",
            userVote === 'downvote' 
              ? "text-destructive bg-destructive/10 hover:bg-destructive/20" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ThumbsDown className={cn("h-4 w-4", userVote === 'downvote' && "fill-current")} />
          <span className="font-medium">{downvotes}</span>
        </Button>
      </div>
    );
  }

  // Card variant - transparent background for overlays
  if (variant === 'card') {
    return (
      <div className={cn(
        "flex items-center rounded-full bg-background/80 backdrop-blur-sm border border-border/50",
        config.container,
        className
      )}>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => handleVote(e, 'upvote')}
          className={cn(
            config.button,
            "rounded-full",
            userVote === 'upvote' 
              ? "text-primary hover:text-primary/80" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowUp className={cn(config.icon, userVote === 'upvote' && "fill-current")} />
          <span className="sr-only">Upvote</span>
        </Button>
        
        <span className={cn("font-medium min-w-[2ch] text-center", config.text)}>
          {voteScore > 0 ? `+${voteScore}` : voteScore}
        </span>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => handleVote(e, 'downvote')}
          className={cn(
            config.button,
            "rounded-full",
            userVote === 'downvote' 
              ? "text-destructive hover:text-destructive/80" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowDown className={cn(config.icon, userVote === 'downvote' && "fill-current")} />
          <span className="sr-only">Downvote</span>
        </Button>
      </div>
    );
  }

  // Default and article variants - vertical layout with full vote counts
  return (
    <div className={cn(
      "flex flex-col items-center rounded-lg",
      variant === 'article' ? "p-2 bg-muted/30 border border-border/50 gap-2" : "p-1 bg-background border border-border gap-1",
      className
    )}>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => handleVote(e, 'upvote')}
        className={cn(
          config.button,
          userVote === 'upvote' 
            ? "text-primary hover:text-primary/80" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowUp className={cn(config.icon, userVote === 'upvote' && "fill-current")} />
        <span className="sr-only">Upvote</span>
      </Button>
      
      <div className="flex flex-col items-center">
        <span className={cn("font-semibold", config.text)}>
          {voteScore > 0 ? `+${voteScore}` : voteScore}
        </span>
        {variant === 'article' && (
          <span className="text-[10px] text-muted-foreground">
            {upvotes} / {downvotes}
          </span>
        )}
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => handleVote(e, 'downvote')}
        className={cn(
          config.button,
          userVote === 'downvote' 
            ? "text-destructive hover:text-destructive/80" 
            : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ArrowDown className={cn(config.icon, userVote === 'downvote' && "fill-current")} />
        <span className="sr-only">Downvote</span>
      </Button>
    </div>
  );
}); 