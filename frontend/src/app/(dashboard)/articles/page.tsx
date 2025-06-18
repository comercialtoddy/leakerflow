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
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Clock,
  Activity,
  Target,
  Zap,
  ArrowUp,
  ArrowDown
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
import { 
  useArticles, 
  useEnhancedDashboardStats, 
  useDeleteArticle, 
  useSaveArticle,
  useTopPerformingArticles,
  useCategoryAnalytics,
  useAnalyticsTimeSeries
} from '@/hooks/react-query/articles/use-articles';
import { useRouter } from 'next/navigation';
import type { Article } from '@/lib/supabase/articles';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

// Enhanced StatsCard component with growth indicators
const StatsCard = memo(({ title, value, subtitle, icon: Icon, growth, trendUp, className }: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: any;
  growth?: number;
  trendUp?: boolean;
  className?: string;
}) => (
  <Card className={cn("relative overflow-hidden", className)}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-xs text-muted-foreground">{subtitle}</p>
        {growth !== undefined && growth !== 0 && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium",
            trendUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
          )}>
            {trendUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(growth)}%
          </div>
        )}
      </div>
    </CardContent>
  </Card>
));

const ArticleCard = memo(({ 
  article, 
  onEdit, 
  onDelete, 
  onToggleSave,
  getStatusColor,
  formatViews 
}: {
  article: Article;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleSave: (id: string) => void;
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
            <DropdownMenuItem onClick={() => onToggleSave(article.id)}>
              <BookmarkCheck className="mr-2 h-4 w-4" />
              {article.saved || article.bookmarked ? 'Unsave' : 'Save'}
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

// Simple Sparkline component for showing trends
const Sparkline = memo(({ data, width = 100, height = 40, color = "currentColor" }: {
  data: { date: string; value: number }[];
  width?: number;
  height?: number;
  color?: string;
}) => {
  if (!data || data.length === 0) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((d.value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        className="opacity-60"
      />
      {data.map((d, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((d.value - min) / range) * height;
        return (
          <circle
            key={i}
            cx={x}
            cy={y}
            r="2"
            fill={color}
            className="opacity-80"
          />
        );
      })}
    </svg>
  );
});

export default function ArticlesDashboard() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Debounce search query for better performance
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // React Query hooks with optimized stale time
  const { data: stats, isLoading: statsLoading } = useEnhancedDashboardStats(30);
  const { data: topArticles } = useTopPerformingArticles('views', 5);
  const { data: categoryStats } = useCategoryAnalytics();
  const { data: viewsTimeSeries } = useAnalyticsTimeSeries(undefined, 7, 'views');

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
  const saveArticleMutation = useSaveArticle();

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

  const handleToggleSave = useCallback(async (articleId: string) => {
    try {
      await saveArticleMutation.mutateAsync(articleId);
    } catch (error) {
      console.error('Failed to save article:', error);
    }
  }, [saveArticleMutation]);

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

  // Memoized stats cards with enhanced data
  const statsCards = useMemo(() => {
    if (!stats) return [];

    const overview = stats.overview || {};
    const metrics = stats.metrics || {};
    const growth = stats.growth || {};
    const recentActivity = stats.recent_activity || {};

    return [
      {
        title: 'Total Articles',
        icon: FileText,
        value: overview.total_articles || 0,
        subtitle: `${overview.published_articles || 0} published`,
        growth: growth.articles,
        trendUp: (growth.articles || 0) > 0
      },
      {
        title: 'Total Views',
        icon: Eye,
        value: formatViews(metrics.total_views || 0),
        subtitle: `${formatViews(metrics.unique_views || 0)} unique`,
        growth: growth.views,
        trendUp: (growth.views || 0) > 0
      },
      {
        title: 'Engagement Rate',
        icon: Activity,
        value: `${metrics.avg_engagement?.toFixed(1) || 0}%`,
        subtitle: `${metrics.avg_read_time?.toFixed(0) || 0}s avg read`,
        growth: growth.engagement,
        trendUp: (growth.engagement || 0) > 0
      },
      {
        title: 'Total Shares',
        icon: Share2,
        value: metrics.total_shares || 0,
        subtitle: `${recentActivity.shares_24h || 0} today`,
        growth: growth.shares,
        trendUp: (growth.shares || 0) > 0
      },
      {
        title: 'Total Saves',
        icon: Bookmark,
        value: metrics.total_saves || 0,
        subtitle: `${recentActivity.saves_24h || 0} today`,
        growth: growth.saves,
        trendUp: (growth.saves || 0) > 0
      },
      {
        title: 'Vote Score',
        icon: ThumbsUp,
        value: (metrics.total_upvotes || 0) - (metrics.total_downvotes || 0),
        subtitle: `${metrics.total_upvotes || 0} up, ${metrics.total_downvotes || 0} down`,
        className: overview.trending_articles > 0 ? "border-orange-200 dark:border-orange-900" : undefined
      }
    ];
  }, [stats, formatViews]);

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
              growth={stat.growth}
              trendUp={stat.trendUp}
              className={stat.className}
            />
          ))}
        </div>

        {/* Analytics Overview Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Top Performing Articles */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Top Articles
              </CardTitle>
              <CardDescription>Best performing content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {topArticles?.slice(0, 3).map((article, index) => (
                  <div key={article.id} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1 space-y-1">
                      <Link 
                        href={`/articles/editor?id=${article.id}`}
                        className="text-sm font-medium hover:underline line-clamp-1"
                      >
                        {article.title}
                      </Link>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {formatViews(article.total_views)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Activity className="h-3 w-3" />
                          {article.engagement?.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {!topArticles || topArticles.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No data available yet
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Category Performance */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Category Performance
              </CardTitle>
              <CardDescription>Articles by category</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {categoryStats?.slice(0, 4).map((category) => (
                  <div key={category.category} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{category.category}</span>
                      <span className="text-muted-foreground">{category.article_count} articles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${Math.min((category.total_views / (categoryStats[0]?.total_views || 1)) * 100, 100)}%` 
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-16 text-right">
                        {formatViews(category.total_views)}
                      </span>
                    </div>
                  </div>
                ))}
                {!categoryStats || categoryStats.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No category data available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Insights */}
          <Card className="col-span-1">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Quick Insights
                  </CardTitle>
                  <CardDescription>Key metrics at a glance</CardDescription>
                </div>
                {viewsTimeSeries && viewsTimeSeries.length > 0 && (
                  <div className="text-primary">
                    <Sparkline 
                      data={viewsTimeSeries} 
                      width={80} 
                      height={30}
                      color="hsl(var(--primary))"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.overview?.trending_articles > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Trending Content</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.overview.trending_articles} articles are trending now
                      </p>
                    </div>
                  </div>
                )}
                
                {stats?.metrics?.avg_bounce_rate > 50 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">High Bounce Rate</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.metrics.avg_bounce_rate.toFixed(1)}% readers leave quickly
                      </p>
                    </div>
                  </div>
                )}
                
                {stats?.recent_activity?.active_articles_24h > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Recent Activity</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.recent_activity.active_articles_24h} articles active today
                      </p>
                    </div>
                  </div>
                )}
                
                {stats?.overview?.draft_articles > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Drafts Pending</p>
                      <p className="text-xs text-muted-foreground">
                        {stats.overview.draft_articles} drafts waiting to be published
                      </p>
                    </div>
                  </div>
                )}
                
                {(!stats?.overview?.trending_articles && !stats?.recent_activity?.active_articles_24h) && (
                  <div className="text-center py-2">
                    <p className="text-sm text-muted-foreground">
                      Start publishing articles to see insights
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
                  onToggleSave={handleToggleSave}
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