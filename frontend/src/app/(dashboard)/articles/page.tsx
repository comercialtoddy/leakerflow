'use client';

import { useState, useMemo, useCallback, memo, Suspense } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Edit, 
  Trash2, 
  Eye, 
  BookmarkCheck, 
  Upload,
  FileText,
  TrendingUp,
  Calendar,
  Users,
  BarChart3,
  Loader2,
  Share2,
  Bookmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { useArticles, useDashboardStats, useDeleteArticle, useToggleBookmark } from '@/hooks/react-query/articles/use-articles';
import { useRouter } from 'next/navigation';
import type { Article } from '@/lib/supabase/articles';
import { useDebounce } from '@/hooks/use-debounce';

// Memoized components for better performance
const StatsCard = memo(({ title, value, subtitle, icon: Icon }: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </CardContent>
  </Card>
));

const ArticleCard = memo(({ 
  article, 
  onEdit, 
  onDelete, 
  onToggleBookmark,
  getStatusColor,
  formatViews 
}: {
  article: Article;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleBookmark: (id: string) => void;
  getStatusColor: (status: string) => string;
  formatViews: (views: number) => string;
}) => (
  <Card className="group hover:shadow-lg transition-shadow duration-200">
    <div className="relative">
      <img
        src={article.image_url || '/api/placeholder/400/250'}
        alt={article.title}
        className="w-full h-48 object-cover rounded-t-lg"
        loading="lazy"
      />
      <div className="absolute top-3 left-3 flex gap-2">
        <Badge className={getStatusColor(article.status)}>
          {article.status}
        </Badge>
        <Badge variant="secondary">
          {article.category}
        </Badge>
      </div>
      <div className="absolute top-3 right-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="sm"
              className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(article.id)}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onToggleBookmark(article.id)}>
              <BookmarkCheck className="mr-2 h-4 w-4" />
              {article.bookmarked ? 'Unbookmark' : 'Bookmark'}
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-destructive"
              onClick={() => onDelete(article.id)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    
    <CardContent className="p-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg line-clamp-2 mb-2">
            {article.title}
          </h3>
          <p className="text-muted-foreground text-sm line-clamp-2">
            {article.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap gap-1">
          {article.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {article.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{article.tags.length - 3}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span>{article.author}</span>
            <span>{article.read_time}</span>
          </div>
          {article.status === 'published' && (
            <div className="flex items-center gap-2">
              <Users className="h-3 w-3" />
              <span>{formatViews(article.views)} views</span>
            </div>
          )}
        </div>

        {article.status === 'published' && (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(article.engagement, 100)}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {article.engagement}% engagement
            </span>
          </div>
        )}
      </div>
    </CardContent>
  </Card>
));

const LoadingSkeleton = memo(() => (
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <Card key={i} className="animate-pulse">
        <div className="h-48 bg-muted rounded-t-lg" />
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
            <div className="flex gap-2">
              <div className="h-5 bg-muted rounded w-16" />
              <div className="h-5 bg-muted rounded w-20" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
));

export default function ArticlesDashboard() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // React Query hooks with optimized stale time
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { 
    data: articlesData, 
    isLoading: articlesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage 
  } = useArticles({
    status: selectedStatus === 'all' ? undefined : selectedStatus,
    category: selectedCategory === 'all' ? undefined : selectedCategory,
    search: debouncedSearchQuery || undefined
  });

  const deleteArticleMutation = useDeleteArticle();
  const toggleBookmarkMutation = useToggleBookmark();

  // Memoized computed values
  const articles = useMemo(() => 
    articlesData?.pages.flatMap(page => (page as any)?.articles || []) || [], 
    [articlesData]
  );

  // Memoized callbacks
  const handleEdit = useCallback((articleId: string) => {
    router.push(`/articles/editor?id=${articleId}`);
  }, [router]);

  const handleDelete = useCallback(async (articleId: string) => {
    if (confirm('Are you sure you want to delete this article?')) {
      try {
        await deleteArticleMutation.mutateAsync(articleId);
      } catch (error) {
        console.error('Failed to delete article:', error);
      }
    }
  }, [deleteArticleMutation]);

  const handleToggleBookmark = useCallback(async (articleId: string) => {
    try {
      await toggleBookmarkMutation.mutateAsync(articleId);
    } catch (error) {
      console.error('Failed to toggle bookmark:', error);
    }
  }, [toggleBookmarkMutation]);

  const getStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'draft': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'archived': return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  }, []);

  const formatViews = useCallback((views: number) => {
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  }, []);

  const loadMoreArticles = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Memoized stats cards
  const statsCards = useMemo(() => [
    {
      title: 'Total Articles',
      icon: FileText,
      value: stats?.total_articles || 0,
      subtitle: '+12% from last month'
    },
    {
      title: 'Published',
      icon: Eye,
      value: formatViews(stats?.total_views || 0),
      subtitle: stats?.weekly_growth?.views ? 
        `${stats.weekly_growth.views > 0 ? '+' : ''}${stats.weekly_growth.views.toFixed(1)}% from last week` :
        '+0% from last week'
    },
    {
      title: 'Engagement',
      icon: BarChart3,
      value: `${stats?.total_engagement?.toFixed(1) || 0}%`,
      subtitle: stats?.weekly_growth?.engagement ? 
        `${stats.weekly_growth.engagement > 0 ? '+' : ''}${stats.weekly_growth.engagement.toFixed(1)}% this month` :
        '+0% this month'
    },
    {
      title: 'Total Shares',
      icon: Share2,
      value: stats?.total_shares || 0,
      subtitle: 'Across all articles'
    },
    {
      title: 'Total Saves',
      icon: Bookmark,
      value: stats?.total_saves || 0,
      subtitle: 'Articles saved by users'
    },
    {
      title: 'New Articles',
      icon: Plus,
      value: stats?.weekly_growth?.articles || 0,
      subtitle: 'This week'
    }
  ], [stats, formatViews]);

  if (statsLoading || articlesLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header skeleton */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="h-8 bg-muted rounded w-64 mb-2" />
              <div className="h-4 bg-muted rounded w-96" />
            </div>
            <div className="flex gap-3">
              <div className="h-9 bg-muted rounded w-20" />
              <div className="h-9 bg-muted rounded w-28" />
            </div>
          </div>
          
          {/* Stats skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-muted rounded w-16 mb-2" />
                  <div className="h-3 bg-muted rounded w-32" />
                </CardContent>
              </Card>
            ))}
          </div>

          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Articles Dashboard</h1>
            <p className="text-muted-foreground">
              Manage your Discover content, create new articles, and track performance
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <Link href="/articles/editor">
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Article
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          {statsCards.map((stat, index) => (
            <StatsCard
              key={index}
              title={stat.title}
              value={stat.value}
              subtitle={stat.subtitle}
              icon={stat.icon}
            />
          ))}
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Articles</CardTitle>
            <CardDescription>
              Manage and edit your articles for the Discover platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search articles..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 w-full md:w-80"
                  />
                </div>
                
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="archived">Archived</option>
                </select>

                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 border border-input rounded-md bg-background text-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="AI & Automation">AI & Automation</option>
                  <option value="Productivity">Productivity</option>
                  <option value="Development">Development</option>
                  <option value="Business">Business</option>
                </select>
              </div>

              <Button variant="outline" size="sm">
                <Filter className="mr-2 h-4 w-4" />
                More Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Articles Grid */}
        <Suspense fallback={<LoadingSkeleton />}>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <motion.div
                key={article.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                layout
              >
                <ArticleCard
                  article={article}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onToggleBookmark={handleToggleBookmark}
                  getStatusColor={getStatusColor}
                  formatViews={formatViews}
                />
              </motion.div>
            ))}
          </div>
        </Suspense>

        {/* Load More Button */}
        {hasNextPage && (
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              onClick={loadMoreArticles}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                'Load More Articles'
              )}
            </Button>
          </div>
        )}

        {articles.length === 0 && !articlesLoading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No articles found</h3>
              <p className="text-muted-foreground text-center mb-4">
                Try adjusting your search filters or create your first article.
              </p>
              <Link href="/articles/editor">
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Article
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}