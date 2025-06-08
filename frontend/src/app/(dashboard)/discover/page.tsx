'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ContentHero, 
  ContentStream, 
  DiscoverHeader 
} from '@/components/discover';
import type { ContentItem } from '@/types/discover';

// Mock data structure - in real app this would come from your API
const INITIAL_HERO_CONTENT: ContentItem = {
  id: 'hero-1',
  title: 'Revolutionary AI Project Management is Transforming How Teams Work',
  subtitle: 'Discover how cutting-edge artificial intelligence is reshaping project workflows, automating routine tasks, and enabling teams to focus on strategic innovation in 2024.',
  imageUrl: '/api/placeholder/800/400',
  source: 'Project X Research',
  category: 'AI & Automation',
  readTime: '5 min read',
  publishedAt: '2024-01-15T10:30:00Z',
  bookmarked: false,
};

const INITIAL_STREAM_CONTENT: ContentItem[] = [
  {
    id: 'stream-1',
    title: 'The Future of Collaborative Workspaces in Remote Teams',
    subtitle: 'New research reveals how hybrid teams are leveraging digital tools to maintain productivity and connection across distributed workforces.',
    imageUrl: '/api/placeholder/400/250',
    source: 'Workplace Evolution',
    category: 'Productivity',
    readTime: '3 min read',
    publishedAt: '2024-01-14T14:20:00Z',
    bookmarked: true,
  },
  {
    id: 'stream-2',
    title: 'Breaking: Major Security Update for Cloud Infrastructure',
    subtitle: 'Industry leaders announce new protocols that could affect how businesses manage their cloud-based operations and data security.',
    imageUrl: '/api/placeholder/400/250',
    source: 'Tech Security Weekly',
    category: 'Development',
    readTime: '4 min read',
    publishedAt: '2024-01-14T09:15:00Z',
    bookmarked: false,
  },
  {
    id: 'stream-3',
    title: 'Sustainable Business Practices Show Record Growth',
    subtitle: 'Companies implementing green technologies and sustainable workflows report significant improvements in both efficiency and market position.',
    imageUrl: '/api/placeholder/400/250',
    source: 'Business Innovation',
    category: 'Business',
    readTime: '6 min read',
    publishedAt: '2024-01-13T16:45:00Z',
    bookmarked: false,
  },
];

const generateMockItem = (index: number): ContentItem => {
  const isHero = index % 4 === 0;
  return {
    id: `item-${Date.now()}-${index}`,
    title: `Dynamically Loaded Content Title ${index}`,
    subtitle: `This is a subtitle for the dynamically loaded content item #${index}. It's fresh off the press.`,
    imageUrl: `/api/placeholder/${isHero ? '800/400' : '400/250'}?seed=${index}`,
    source: 'Infinite Scroll News',
    category: 'Dynamic Content',
    readTime: `${Math.floor(Math.random() * 5) + 2} min read`,
    publishedAt: new Date().toISOString(),
    bookmarked: false,
  };
};

// Chunking utility to group content into hero + stream items
const chunkContent = (content: ContentItem[]) => {
  return content.reduce<ContentItem[][]>((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / 4);
    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = [];
    }
    resultArray[chunkIndex].push(item);
    return resultArray;
  }, []);
};

export default function DiscoverPage() {
  const [content, setContent] = useState<ContentItem[]>([
    INITIAL_HERO_CONTENT, 
    ...INITIAL_STREAM_CONTENT
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const handleBookmarkToggle = (contentId: string) => {
    setContent(prev => 
      prev.map(item => 
        item.id === contentId 
          ? { ...item, bookmarked: !item.bookmarked }
          : item
      )
    );
  };

  const fetchMoreContent = useCallback(async () => {
    if (isLoading) return;
    setIsLoading(true);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newItems = Array.from({ length: 4 }).map((_, i) =>
      generateMockItem(content.length + i)
    );

    setContent(prev => [...prev, ...newItems]);
    setIsLoading(false);
  }, [isLoading, content.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !isLoading) {
          fetchMoreContent();
        }
      },
      { threshold: 1.0 }
    );

    const currentSentinel = sentinelRef.current;
    if (currentSentinel) {
      observer.observe(currentSentinel);
    }

    return () => {
      if (currentSentinel) {
        observer.unobserve(currentSentinel);
      }
    };
  }, [fetchMoreContent, isLoading]);

  const chunked = chunkContent(content);

  return (
    <>
      <DiscoverHeader />
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <main className="pb-16 pt-12 transform scale-75 origin-top">
            <div className="space-y-6">
              {chunked.map((chunk, index) => (
                <section key={`chunk-${index}`} className="space-y-6">
                  {chunk[0] && (
                     <ContentHero
                      content={chunk[0]}
                      onBookmarkToggle={() => handleBookmarkToggle(chunk[0].id)}
                    />
                  )}
                  {chunk.length > 1 && (
                    <ContentStream
                      content={chunk.slice(1)}
                      onBookmarkToggle={handleBookmarkToggle}
                    />
                  )}
                </section>
              ))}
            </div>
            
            <div ref={sentinelRef} className="h-10" />

            {isLoading && (
              <div className="flex justify-center items-center py-6">
                <div className="w-8 h-8 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
              </div>
            )}
          </main>
        </div>
      </div>
    </>
  );
} 