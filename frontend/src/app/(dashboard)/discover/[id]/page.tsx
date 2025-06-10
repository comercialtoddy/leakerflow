'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Bookmark, Clock, ExternalLink, Share2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DiscoverHeader } from '@/components/discover';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useArticle, useToggleBookmark, useIncrementViews } from '@/hooks/react-query/articles/use-articles';
import type { Article } from '@/lib/supabase/articles';

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const articleId = params.id as string;

  // React Query hooks
  const { data: article, isLoading, error } = useArticle(articleId);
  const toggleBookmarkMutation = useToggleBookmark();
  const incrementViewsMutation = useIncrementViews();

  // Increment view count when article loads
  useEffect(() => {
    if (article && articleId) {
      incrementViewsMutation.mutate(articleId);
    }
  }, [article, articleId]);

  const handleBookmarkToggle = async () => {
    if (article) {
      try {
        await toggleBookmarkMutation.mutateAsync(articleId);
      } catch (error) {
        console.error('Failed to toggle bookmark:', error);
      }
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
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          </div>
        </div>
      </>
    );
  }

  if (error || !article) {
    return (
      <>
        <DiscoverHeader />
        <div className="min-h-screen bg-background">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
            <div className="text-center py-20">
              <h1 className="text-2xl font-bold text-foreground mb-4">Article not found</h1>
              <p className="text-muted-foreground mb-4">
                The article you're looking for doesn't exist or has been removed.
              </p>
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

  const timeAgo = formatDistanceToNow(new Date(article.created_at), { addSuffix: true });

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
                <span className="text-sm text-muted-foreground">{article.read_time}</span>
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
                  disabled={toggleBookmarkMutation.isPending}
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
                
                {article.source_url && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => window.open(article.source_url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Source
                  </Button>
                )}
              </div>

              {/* Author info */}
              <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border/50">
                <img 
                  src={article.author_avatar || '/api/placeholder/64/64'} 
                  alt={article.author}
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-foreground">{article.author}</p>
                  <p className="text-sm text-muted-foreground">
                    Published on {new Date(article.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </header>

            {/* Hero image */}
            {article.image_url && (
              <div className="mb-8">
                <img 
                  src={article.image_url} 
                  alt={article.title}
                  className="w-full h-64 md:h-96 object-cover rounded-xl"
                />
              </div>
            )}

            {/* Article content */}
            <div className="prose prose-lg dark:prose-invert max-w-none mb-12">
              <div dangerouslySetInnerHTML={{ __html: article.content }} />
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
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
            )}

            {/* Sources */}
            {article.sources && article.sources.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-3">Sources</h3>
                <div className="space-y-2">
                  {article.sources.map((source, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                      <a 
                        href={source.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {source.title}
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Article stats */}
            <div className="flex items-center gap-6 p-4 bg-card rounded-lg border border-border/50">
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{article.views.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Views</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{Math.round(article.engagement)}%</p>
                <p className="text-sm text-muted-foreground">Engagement</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">{article.read_time}</p>
                <p className="text-sm text-muted-foreground">Read Time</p>
              </div>
            </div>
          </article>
        </div>
      </div>
    </>
  );
} 