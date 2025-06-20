'use client';

import { useState, useMemo, useCallback, memo } from 'react';
import { motion } from 'motion/react';
import { 
  FileText,
  TrendingUp,
  BarChart3,
  Eye,
  Share2,
  Bookmark,
  ThumbsUp,
  Activity,
  Zap,
  ArrowUp,
  ArrowDown,
  Loader2
} from 'lucide-react';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { 
  useEnhancedDashboardStats, 
  useTopPerformingArticles,
  useCategoryAnalytics,
  useAnalyticsTimeSeries
} from '@/hooks/react-query/articles/use-articles';
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

export default function AnalyticsDashboard() {
  // React Query hooks with optimized stale time
  const { data: stats, isLoading: statsLoading } = useEnhancedDashboardStats(30);
  const { data: topArticles } = useTopPerformingArticles('views', 5);
  const { data: categoryStats } = useCategoryAnalytics();
  const { data: viewsTimeSeries } = useAnalyticsTimeSeries(undefined, 7, 'views');

  const formatViews = useCallback((views: number) => {
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  }, []);

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

  if (statsLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header skeleton */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="h-8 bg-muted rounded w-64 mb-2" />
              <div className="h-4 bg-muted rounded w-96" />
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

          {/* Analytics skeleton */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse col-span-1">
                <CardHeader className="pb-2">
                  <div className="h-5 bg-muted rounded w-32" />
                  <div className="h-3 bg-muted rounded w-24" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted rounded w-full" />
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
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
            <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
            <p className="text-muted-foreground">
              Track performance, engagement, and insights for your published articles
            </p>
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

        {/* Additional Analytics Sections can be added here */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Performance Trends */}
          <Card>
            <CardHeader>
              <CardTitle>Performance Trends</CardTitle>
              <CardDescription>View activity patterns over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Detailed charts coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Engagement Metrics */}
          <Card>
            <CardHeader>
              <CardTitle>Engagement Breakdown</CardTitle>
              <CardDescription>Detailed interaction metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Advanced analytics coming soon</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 