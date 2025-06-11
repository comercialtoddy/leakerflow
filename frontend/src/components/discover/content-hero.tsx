import React from 'react';
import { Bookmark, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ContentItem } from '@/types/discover';
import { useRouter } from 'next/navigation';
import { VotingButtons } from './voting-buttons';

interface ContentHeroProps {
  content: ContentItem;
  onBookmarkToggle: () => void;
  onVote?: (voteType: 'upvote' | 'downvote') => void;
}

export const ContentHero = React.memo(function ContentHero({ 
  content, 
  onBookmarkToggle, 
  onVote 
}: ContentHeroProps) {
  const router = useRouter();
  const timeAgo = formatDistanceToNow(new Date(content.publishedAt), { addSuffix: true });

  const handleCardClick = () => {
    router.push(`/discover/${content.id}`);
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmarkToggle();
  };

  const handleReadMoreClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/discover/${content.id}`);
  };

  const handleVote = (voteType: 'upvote' | 'downvote') => {
    onVote?.(voteType);
  };

  return (
    <article 
      className="group cursor-pointer transform transition-all duration-300 hover:scale-[1.02] hover:shadow-xl"
      onClick={handleCardClick}
    >
      <div className="bg-card rounded-xl overflow-hidden border border-border/50 hover:border-primary/20 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2)]">
        {/* Principle 3: The Image - Primary element, largest part */}
        <div className="relative aspect-[4/1] overflow-hidden">
          <img
            src={content.imageUrl}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
          {/* Category badge overlay */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur text-foreground text-xs">
              {content.category}
            </Badge>
          </div>
          {/* Bookmark action */}
          <div className="absolute top-2 right-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBookmarkClick}
              className={cn(
                "bg-background/80 backdrop-blur hover:bg-background/90 transition-all duration-200 h-6 w-6 p-0",
                content.bookmarked 
                  ? "text-primary hover:text-primary/80" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Bookmark 
                className={cn(
                  "h-3 w-3 transition-all duration-200",
                  content.bookmarked && "fill-current"
                )} 
              />
              <span className="sr-only">
                {content.bookmarked ? 'Remove bookmark' : 'Bookmark'}
              </span>
            </Button>
          </div>

          {/* Voting buttons - positioned in bottom right */}
          {onVote && (
            <div className="absolute bottom-2 right-2">
              <VotingButtons
                upvotes={content.upvotes || 0}
                downvotes={content.downvotes || 0}
                userVote={content.user_vote || null}
                onVote={handleVote}
                size="sm"
                variant="card"
              />
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="p-2">
          {/* Principle 3: The Headline - Clean, bold, attention-grabbing */}
          <h2 className="text-xl font-bold text-foreground mb-2 leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {content.title}
          </h2>

          {/* Principle 3: The Snippet - Context and intrigue */}
          <p className="text-muted-foreground text-sm leading-relaxed mb-3 line-clamp-2">
            {content.subtitle}
          </p>

          {/* Principle 3: The Source/Metadata - Trust and context */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{content.source}</span>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{content.readTime}</span>
              </div>
              <span>{timeAgo}</span>
            </div>

            {/* Read more indicator */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-6 px-2"
              onClick={handleReadMoreClick}
            >
              <span className="text-xs font-medium">Read more</span>
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}); 