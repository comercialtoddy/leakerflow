import React from 'react';
import { ContentCard } from './content-card';
import { ContentItem } from '@/types/discover';

interface ContentStreamProps {
  content: ContentItem[];
  onBookmarkToggle: (id: string) => void;
  onVote?: (articleId: string, voteType: 'upvote' | 'downvote') => void;
}

export const ContentStream = React.memo(function ContentStream({ 
  content, 
  onBookmarkToggle, 
  onVote 
}: ContentStreamProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {content.map((item) => (
        <ContentCard
          key={item.id}
          content={item}
          onBookmarkToggle={() => onBookmarkToggle(item.id)}
          onVote={onVote ? (voteType) => onVote(item.id, voteType) : undefined}
        />
      ))}
    </div>
  );
}); 