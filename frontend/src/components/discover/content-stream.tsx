import { ContentCard } from './content-card';
import { ContentItem } from '@/types/discover';

interface ContentStreamProps {
  content: ContentItem[];
  onBookmarkToggle: (id: string) => void;
}

export function ContentStream({ content, onBookmarkToggle }: ContentStreamProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
      {content.map((item) => (
        <ContentCard
          key={item.id}
          content={item}
          onBookmarkToggle={() => onBookmarkToggle(item.id)}
        />
      ))}
    </div>
  );
} 