'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BarChart3,
  TrendingUp,
  Users,
  FileText,
  Clock,
  Eye,
  ThumbsUp,
  UserCheck,
  Activity,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  PieChart,
  LineChart,
  Globe,
  Bookmark,
  MessageSquare,
  Star,
  Target,
  Zap,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminApi, type AnalyticsOverview, type TrendsAnalytics, type CategoryDistribution, type TopAuthor, type ApplicationsAnalytics, type EngagementAnalytics } from '@/lib/api/admin';
import { ArticlesTrendChart, CategoryDistributionChart, ApplicationsBarChart } from './charts';

type TimeRange = '7d' | '30d' | '90d' | '1y';

interface AnalyticsData {
  overview: AnalyticsOverview | null;
  trends: TrendsAnalytics | null;
  categories: CategoryDistribution[] | null;
  topAuthors: TopAuthor[] | null;
  applications: ApplicationsAnalytics | null;
  engagement: EngagementAnalytics | null;
}

export function AdminAnalyticsPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<AnalyticsData>({
    overview: null,
    trends: null,
    categories: null,
    topAuthors: null,
    applications: null,
    engagement: null
  });
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const formatNumber = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
  };

  const formatPercentage = (num: number | undefined | null) => {
    if (num === undefined || num === null || isNaN(num)) {
      return '0.0%';
    }
    return num.toFixed(1) + '%';
  };

  const getChangeIcon = (change: number | undefined | null) => {
    if (change === undefined || change === null || isNaN(change)) {
      return <Minus className="w-4 h-4 text-gray-400" />;
    }
    if (change > 0) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (change < 0) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getChangeColor = (change: number | undefined | null) => {
    if (change === undefined || change === null || isNaN(change)) {
      return 'text-gray-400';
    }
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-400';
  };

  const fetchAnalyticsData = async () => {
    setIsLoading(true);
    try {
      const [overviewResult, trendsResult, categoriesResult, topAuthorsResult, applicationsResult, engagementResult] = await Promise.all([
        adminApi.getAnalyticsOverview(timeRange),
        adminApi.getAnalyticsTrends(timeRange),
        adminApi.getAnalyticsCategories(),
        adminApi.getAnalyticsTopAuthors(10),
        adminApi.getAnalyticsApplications(),
        adminApi.getAnalyticsEngagement()
      ]);

      setData({
        overview: overviewResult.data || null,
        trends: trendsResult.data || null,
        categories: categoriesResult.data?.categories || null,
        topAuthors: topAuthorsResult.data?.authors || null,
        applications: applicationsResult.data || null,
        engagement: engagementResult.data || null
      });

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const handleExportData = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setIsLoading(true);
      
      const sections = ['overview', 'categories'];
      if (data.topAuthors?.length) sections.push('authors');
      if (data.applications) sections.push('applications');
      if (data.engagement) sections.push('engagement');
      
      await adminApi.exportAnalyticsReport({
        format,
        timeRange,
        includeSections: sections
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      // TODO: Show error toast/notification
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshData = async () => {
    await fetchAnalyticsData();
  };

  const filteredCategories = data.categories?.filter(category => 
    selectedCategory === 'all' || category.name.toLowerCase() === selectedCategory
  ) || [];

  return (
    <div className="space-y-6">
      {/* Time Range & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="time-range">Time Range</Label>
                    <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">Last 7 days</SelectItem>
                        <SelectItem value="30d">Last 30 days</SelectItem>
                        <SelectItem value="90d">Last 90 days</SelectItem>
                        <SelectItem value="1y">Last year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {data.categories?.map(category => (
                          <SelectItem key={category.name} value={category.name.toLowerCase()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Badge variant="outline" className="text-sm">
                  <Calendar className="w-4 h-4 mr-1" />
                  Updated {lastUpdated.toLocaleTimeString()}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleExportData('csv')} disabled={isLoading}>
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleExportData('json')} disabled={isLoading}>
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button variant="outline" size="sm" onClick={handleRefreshData} disabled={isLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Overview KPI Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Articles</p>
                <p className="text-2xl font-bold">
                  {data.overview ? formatNumber(data.overview.total_articles) : '-'}
                </p>
                <div className="flex items-center mt-1">
                  {getChangeIcon(12.5)}
                  <span className={`text-sm ml-1 ${getChangeColor(12.5)}`}>
                    +12.5% from last month
                  </span>
                </div>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Views</p>
                <p className="text-2xl font-bold">
                  {data.overview ? formatNumber(data.overview.total_views) : '-'}
                </p>
                <div className="flex items-center mt-1">
                  {getChangeIcon(8.2)}
                  <span className={`text-sm ml-1 ${getChangeColor(8.2)}`}>
                    +8.2% from last month
                  </span>
                </div>
              </div>
              <Eye className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Authors</p>
                <p className="text-2xl font-bold">
                  {data.overview ? formatNumber(data.overview.total_authors) : '-'}
                </p>
                <div className="flex items-center mt-1">
                  {getChangeIcon(4.1)}
                  <span className={`text-sm ml-1 ${getChangeColor(4.1)}`}>
                    +4.1% from last month
                  </span>
                </div>
              </div>
              <Users className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approval Rate</p>
                <p className="text-2xl font-bold">
                  {data.overview ? formatPercentage(data.overview.application_approval_rate) : '-'}
                </p>
                <div className="flex items-center mt-1">
                  {getChangeIcon(-2.3)}
                  <span className={`text-sm ml-1 ${getChangeColor(-2.3)}`}>
                    -2.3% from last month
                  </span>
                </div>
              </div>
              <UserCheck className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts and Visualizations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="grid gap-6 lg:grid-cols-2"
      >
        {/* Articles Trend Chart */}
        {data.trends?.articles_per_day && (
          <ArticlesTrendChart 
            data={data.trends.articles_per_day}
          />
        )}

        {/* Category Distribution Chart */}
        {data.categories && (
          <CategoryDistributionChart 
            data={selectedCategory === 'all' ? data.categories : filteredCategories}
          />
        )}
      </motion.div>

      {/* Applications Bar Chart */}
      {data.applications?.monthly_submissions && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
        >
          <ApplicationsBarChart 
            data={data.applications.monthly_submissions}
          />
        </motion.div>
      )}

      {/* Additional Metrics */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid gap-6 lg:grid-cols-3"
      >
        {/* Top Authors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Top Authors
            </CardTitle>
            <CardDescription>
              Most active authors by article count and engagement
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.topAuthors?.slice(0, 5).map((author, index) => (
                <div key={author.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{author.name || 'Anonymous'}</p>
                      <p className="text-xs text-muted-foreground">{author.articles} articles</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatNumber(author.views)}</p>
                    <p className="text-xs text-muted-foreground">views</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Application Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Application Insights
            </CardTitle>
            <CardDescription>
              Author application submission and approval metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Applications</span>
                <span className="font-medium">{data.applications?.total_applications || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Pending Review</span>
                <span className="font-medium text-orange-600">{data.applications?.pending_applications || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Approved</span>
                <span className="font-medium text-green-600">{data.applications?.approved_applications || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Rejected</span>
                <span className="font-medium text-red-600">{data.applications?.rejected_applications || '-'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Review Time</span>
                <span className="font-medium">{data.applications?.average_review_time || '-'} days</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Engagement Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Engagement Metrics
            </CardTitle>
            <CardDescription>
              User interaction and engagement statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Bookmarks</span>
                <span className="font-medium">{data.engagement ? formatNumber(data.engagement.total_bookmarks) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Avg Time on Page</span>
                <span className="font-medium">{data.engagement?.average_time_on_page || '-'} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Bounce Rate</span>
                <span className="font-medium">{data.engagement ? formatPercentage(data.engagement.bounce_rate) : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Return Visitors</span>
                <span className="font-medium text-green-600">{data.engagement ? formatPercentage(data.engagement.return_visitors) : '-'}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Social Shares</span>
                <span className="font-medium">{data.engagement ? formatNumber(data.engagement.social_shares) : '-'}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Export & Summary */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export & Reports
            </CardTitle>
            <CardDescription>
              Generate and download comprehensive analytics reports
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button variant="outline" onClick={() => handleExportData('csv')} disabled={isLoading}>
                <FileText className="h-4 w-4 mr-2" />
                Export as CSV
              </Button>
              <Button variant="outline" onClick={() => handleExportData('json')} disabled={isLoading}>
                <Download className="h-4 w-4 mr-2" />
                Export as JSON
              </Button>
              <Button variant="outline" onClick={() => console.log('Schedule Report')} disabled>
                <Clock className="h-4 w-4 mr-2" />
                Schedule Report (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
} 