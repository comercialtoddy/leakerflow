'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Clock, ExternalLink, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DiscoverHeader } from '@/components/discover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import type { ContentItem } from '@/types/discover';

// Extended article content type
interface ArticleContent extends ContentItem {
  content: string;
  tags: string[];
  author: {
    name: string;
    avatar: string;
    bio: string;
  };
  relatedArticles: ContentItem[];
}

// Mock full article data - in real app this would come from your API
const generateMockArticle = (id: string): ArticleContent => {
  return {
    id,
    title: 'Revolutionary AI Project Management is Transforming How Teams Work',
    subtitle: 'Discover how cutting-edge artificial intelligence is reshaping project workflows, automating routine tasks, and enabling teams to focus on strategic innovation in 2024.',
    imageUrl: '/api/placeholder/1200/600',
    source: 'Project X Research',
    category: 'AI & Automation',
    readTime: '8 min read',
    publishedAt: '2024-01-15T10:30:00Z',
    bookmarked: false,
    content: `
      <h2>The AI Revolution in Project Management</h2>
      <p>Artificial Intelligence is fundamentally changing how teams approach project management. From automated task allocation to predictive analytics, AI-powered tools are helping organizations achieve unprecedented levels of efficiency and collaboration.</p>
      
      <h3>Key Benefits of AI-Driven Project Management</h3>
      <ul>
        <li><strong>Automated Task Prioritization:</strong> AI algorithms can analyze project dependencies and deadlines to automatically prioritize tasks for team members.</li>
        <li><strong>Predictive Analytics:</strong> Machine learning models can forecast project completion times and identify potential bottlenecks before they occur.</li>
        <li><strong>Intelligent Resource Allocation:</strong> AI can optimize team assignments based on skills, availability, and workload distribution.</li>
        <li><strong>Real-time Insights:</strong> Advanced analytics provide managers with actionable insights into team performance and project health.</li>
      </ul>
      
      <h3>Implementation Strategies</h3>
      <p>Successfully implementing AI in project management requires a strategic approach. Organizations should start with pilot projects to test AI capabilities and gradually expand their use as teams become more comfortable with the technology.</p>
      
      <blockquote>
        "The integration of AI into our project management workflow has increased our team productivity by 40% while reducing project delivery times by an average of 3 weeks." - Sarah Chen, Director of Operations at TechCorp
      </blockquote>
      
      <h3>Future Outlook</h3>
      <p>As AI technology continues to evolve, we can expect even more sophisticated project management capabilities. Natural language processing will enable more intuitive interfaces, while advanced machine learning will provide increasingly accurate predictions and recommendations.</p>
      
      <p>The organizations that embrace these AI-powered tools today will be best positioned to thrive in tomorrow's competitive landscape.</p>
    `,
    tags: ['AI', 'Project Management', 'Automation', 'Productivity', 'Technology'],
    author: {
      name: 'Alex Rivera',
      avatar: '/api/placeholder/64/64',
      bio: 'Senior Technology Analyst specializing in AI applications in business workflows. 10+ years experience in project management and digital transformation.'
    },
    relatedArticles: [
      {
        id: 'related-1',
        title: 'The Future of Remote Team Collaboration',
        subtitle: 'How distributed teams are leveraging new technologies to stay connected and productive.',
        imageUrl: '/api/placeholder/300/200',
        source: 'Remote Work Insights',
        category: 'Productivity',
        readTime: '5 min read',
        publishedAt: '2024-01-14T14:20:00Z',
        bookmarked: false,
      },
      {
        id: 'related-2',
        title: 'Machine Learning in Business Operations',
        subtitle: 'Practical applications of ML algorithms in streamlining business processes.',
        imageUrl: '/api/placeholder/300/200',
        source: 'Business Tech Weekly',
        category: 'AI & Automation',
        readTime: '6 min read',
        publishedAt: '2024-01-13T16:45:00Z',
        bookmarked: false,
      }
    ]
  };
};

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const [article, setArticle] = useState<ArticleContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const articleId = params.id as string;

  useEffect(() => {
    // Simulate API call
    const fetchArticle = async () => {
      setIsLoading(true);
      // In real app, you'd fetch from your API: await fetch(`/api/articles/${articleId}`)
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockArticle = generateMockArticle(articleId);
      setArticle(mockArticle);
      setIsLoading(false);
    };

    if (articleId) {
      fetchArticle();
    }
  }, [articleId]);

  const handleBookmarkToggle = () => {
    if (article) {
      setArticle(prev => prev ? { ...prev, bookmarked: !prev.bookmarked } : null);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: article?.title,
          text: article?.subtitle,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback to clipboard
      navigator.clipboard.writeText(window.location.href);
    }
  };

  if (isLoading) {
    return (
      <>
        <DiscoverHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!article) {
    return (
      <>
        <DiscoverHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
            <div className="text-center py-20">
              <h1 className="text-2xl font-bold text-foreground mb-4">Article not found</h1>
              <Button onClick={() => router.back()} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go back
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const timeAgo = formatDistanceToNow(new Date(article.publishedAt), { addSuffix: true });

  return (
    <>
      <DiscoverHeader />
      <div className="min-h-screen bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
          <article className="pb-16">
            {/* Back button */}
            <div className="mb-6">
              <Button 
                onClick={() => router.back()} 
                variant="ghost" 
                className="text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Discover
              </Button>
            </div>

            {/* Article header */}
            <header className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="secondary">{article.category}</Badge>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{article.readTime}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{timeAgo}</span>
              </div>
              
              <h1 className="text-4xl font-bold text-foreground mb-4 leading-tight">
                {article.title}
              </h1>
              
              <p className="text-xl text-muted-foreground leading-relaxed mb-6">
                {article.subtitle}
              </p>

              {/* Action buttons */}
              <div className="flex items-center gap-3 mb-8">
                <Button
                  onClick={handleBookmarkToggle}
                  variant="outline"
                  size="sm"
                  className={cn(
                    article.bookmarked 
                      ? "text-primary border-primary/20 bg-primary/5" 
                      : "text-muted-foreground"
                  )}
                >
                  <Bookmark 
                    className={cn(
                      "h-4 w-4 mr-2",
                      article.bookmarked && "fill-current"
                    )} 
                  />
                  {article.bookmarked ? 'Bookmarked' : 'Bookmark'}
                </Button>
                
                <Button onClick={handleShare} variant="outline" size="sm">
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </Button>
                
                <Button variant="outline" size="sm">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Source
                </Button>
              </div>

              {/* Author info */}
              <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border/50">
                <img 
                  src={article.author.avatar} 
                  alt={article.author.name}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-foreground">{article.author.name}</p>
                  <p className="text-sm text-muted-foreground">{article.author.bio}</p>
                </div>
              </div>
            </header>

            {/* Hero image */}
            <div className="mb-8">
              <img 
                src={article.imageUrl} 
                alt={article.title}
                className="w-full h-64 md:h-96 object-cover rounded-xl"
              />
            </div>

            {/* Article content */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
              <div dangerouslySetInnerHTML={{ __html: article.content }} />
            </div>

            {/* Tags */}
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-foreground mb-3">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Related articles */}
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">Related Articles</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {article.relatedArticles.map((related) => (
                  <div 
                    key={related.id}
                    className="group cursor-pointer bg-card rounded-lg overflow-hidden border border-border/50 hover:border-primary/20 hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.2)] transition-all duration-200"
                    onClick={() => router.push(`/discover/${related.id}`)}
                  >
                    <img 
                      src={related.imageUrl} 
                      alt={related.title}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-4">
                      <h4 className="font-semibold text-foreground mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                        {related.title}
                      </h4>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                        {related.subtitle}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <span>{related.source}</span>
                        <span className="mx-1">•</span>
                        <Clock className="h-3 w-3 mr-1" />
                        <span>{related.readTime}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  );
} 