import React from 'react';
import { Bookmark, Clock, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ContentItem } from '@/types/discover';
import { useRouter } from 'next/navigation';
import { VotingButtons } from './voting-buttons';

interface ContentCardProps {
  content: ContentItem;
  onBookmarkToggle: () => void;
  onVote?: (voteType: 'upvote' | 'downvote') => void;
}

export const ContentCard = React.memo(function ContentCard({ 
  content, 
  onBookmarkToggle, 
  onVote 
}: ContentCardProps) {
  const router = useRouter();
  const timeAgo = formatDistanceToNow(new Date(content.publishedAt), { addSuffix: true });

  const handleCardClick = () => {
    router.push(`/discover/${content.id}`);
  };

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onBookmarkToggle();
  };

  const handleVote = (voteType: 'upvote' | 'downvote') => {
    onVote?.(voteType);
  };

  return (
    <article 
      className="group cursor-pointer transform transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
      onClick={handleCardClick}
    >
      <div className="bg-card rounded-lg overflow-hidden border border-border/50 hover:border-primary/20 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2)] h-full flex flex-col">
        {/* Principle 3: The Image - Primary visual element */}
        <div className="relative aspect-[2/1] overflow-hidden">
          <img
            src={content.imageUrl}
            alt={content.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
          {/* Category badge - smaller than hero version */}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="bg-background/80 backdrop-blur text-xs">
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

        {/* Content area - flexible to fill remaining space */}
        <div className="p-2 flex flex-col flex-1">
          {/* Principle 3: The Headline - Limited to 2-3 lines */}
          <h3 className="text-lg font-semibold text-foreground mb-2 leading-tight line-clamp-2 group-hover:text-primary transition-colors duration-200">
            {content.title}
          </h3>

          {/* Principle 3: The Snippet - Brief context, 2-3 lines max */}
          <p className="text-muted-foreground text-xs leading-relaxed mb-2 line-clamp-2 flex-1">
            {content.subtitle}
          </p>

          {/* Principle 3: The Source - Trust building, smallest text */}
          <div className="flex items-center justify-between mt-auto">
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground text-xs">{content.source}</span>
              <span>•</span>
              <div className="flex items-center space-x-1">
                <Clock className="h-3 w-3" />
                <span>{content.readTime}</span>
              </div>
              <span>•</span>
              <span>{timeAgo}</span>
            </div>

            {/* Subtle read indicator - appears on hover */}
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
          </div>
        </div>
      </div>
    </article>
  );
}); 