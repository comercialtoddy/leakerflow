'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  FileText, 
  Eye, 
  Edit, 
  Trash2,
  Filter,
  Search,
  MoreHorizontal,
  Flag,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { adminApi } from '@/lib/api/admin';

interface FilterState {
  search: string;
  status: string;
  category: string;
  author: string;
  dateFrom: string;
  dateTo: string;
  minReports: string;
  maxReports: string;
}

interface SortConfig {
  key: string | null;
  direction: 'asc' | 'desc';
}

interface ArticleModerationPanelProps {
  onArticleAction?: (articleId: string, action: string) => void;
}

export function ArticleModerationPanel({ onArticleAction }: ArticleModerationPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [articles, setArticles] = useState<any[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; articleId: string; articleTitle: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  
  // Bulk selection state
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<string>('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    category: 'all',
    author: '',
    dateFrom: '',
    dateTo: '',
    minReports: '',
    maxReports: ''
  });

  // Fetch articles when filters change
  useEffect(() => {
    const loadArticles = async () => {
      setIsLoading(true);
      try {
        const response = await adminApi.getArticles({
          skip: (currentPage - 1) * pageSize,
          limit: pageSize,
          status: filters.status !== 'all' ? filters.status : undefined,
          search: filters.search || undefined,
          category: filters.category !== 'all' ? filters.category : undefined
        });
        
        if (response.data) {
          setArticles(response.data.articles);
          setTotalArticles(response.data.total);
        } else if (response.error) {
          console.error('API Error:', response.error);
          setArticles([]);
          setTotalArticles(0);
        }
      } catch (error) {
        console.error('Failed to load articles:', error);
        setArticles([]);
        setTotalArticles(0);
      } finally {
        setIsLoading(false);
      }
    };

    loadArticles();
  }, [filters.search, filters.status, filters.category, currentPage, pageSize]);

  // Note: Filtering and sorting are now handled by the backend API
  // The articles state contains the already filtered and paginated results

  // Pagination (since we're getting paginated data from the API, we don't need to filter/sort here)
  const totalPages = Math.ceil(totalArticles / pageSize);
  const paginatedArticles = articles; // Already paginated from API

  const handleSort = (key: string) => {
    setSortConfig(current => ({
      key: key as any,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
    }));
    // Reset to first page when sorting changes
    setCurrentPage(1);
  };

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters(current => ({ ...current, [key]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: 'all',
      category: 'all',
      author: '',
      dateFrom: '',
      dateTo: '',
      minReports: '',
      maxReports: ''
    });
    setCurrentPage(1);
  };

  const handleArticleAction = useCallback(async (articleId: string, action: string) => {
    const article = articles.find(a => a.id === articleId);
    if (!article) return;

    // For destructive actions, show confirmation dialog
    if (action === 'delete' || action === 'archive' || action === 'unpublish') {
      setConfirmAction({ type: action, articleId, articleTitle: article.title });
      setShowConfirmDialog(true);
      return;
    }

    // Handle non-destructive actions directly
    await executeArticleAction(action, articleId);
  }, [articles]);

  const executeArticleAction = useCallback(async (action: string, articleId: string) => {
    setIsLoading(true);
    
    try {
      let result;
      
      switch (action) {
        case 'delete':
          result = await adminApi.deleteArticle(articleId);
          if (result.error) {
            throw new Error(result.error);
          }
          // Remove from local state
          setArticles(prev => prev.filter(article => article.id !== articleId));
          break;
          
        case 'archive':
          result = await adminApi.archiveArticle(articleId);
          if (result.error) {
            throw new Error(result.error);
          }
          // Update local state
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, status: 'archived' } 
              : article
          ));
          break;
          
        case 'publish':
          result = await adminApi.publishArticle(articleId);
          if (result.error) {
            throw new Error(result.error);
          }
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, status: 'published' } 
              : article
          ));
          break;
          
        case 'unpublish':
          result = await adminApi.unpublishArticle(articleId);
          if (result.error) {
            throw new Error(result.error);
          }
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, status: 'draft' } 
              : article
          ));
          break;
          
        case 'draft':
          result = await adminApi.updateArticle(articleId, { status: 'draft' });
          if (result.error) {
            throw new Error(result.error);
          }
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, status: 'draft' } 
              : article
          ));
          break;
          
        case 'visibility_public':
          result = await adminApi.changeArticleVisibility(articleId, 'public');
          if (result.error) {
            throw new Error(result.error);
          }
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, visibility: 'public' } 
              : article
          ));
          break;
          
        case 'visibility_account':
          result = await adminApi.changeArticleVisibility(articleId, 'account');
          if (result.error) {
            throw new Error(result.error);
          }
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, visibility: 'account' } 
              : article
          ));
          break;
          
        case 'visibility_private':
          result = await adminApi.changeArticleVisibility(articleId, 'private');
          if (result.error) {
            throw new Error(result.error);
          }
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, visibility: 'private' } 
              : article
          ));
          break;
          
        case 'delete_reports':
          // TODO: Implement delete reports functionality
          console.log('Delete reports action not implemented yet');
          break;
          
        case 'undelete':
          result = await adminApi.updateArticle(articleId, { status: 'published' });
          if (result.error) {
            throw new Error(result.error);
          }
          setArticles(prev => prev.map(article => 
            article.id === articleId 
              ? { ...article, status: 'published' } 
              : article
          ));
          break;
          
        default:
          console.log(`Action ${action} not implemented yet`);
      }
      
      // Notify parent component if callback provided
      if (onArticleAction) {
        onArticleAction(articleId, action);
      }
      
      // Close dialog if open
      if (showDetailsDialog) {
        setShowDetailsDialog(false);
        setSelectedArticle(null);
      }
      
    } catch (error) {
      console.error(`Failed to ${action} article:`, error);
      // You could show a toast notification here
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  }, [onArticleAction, showDetailsDialog]);

  // Bulk selection handlers
  const handleSelectArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticles);
    if (checked) {
      newSelected.add(articleId);
    } else {
      newSelected.delete(articleId);
    }
    setSelectedArticles(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(paginatedArticles.map(article => article.id));
      setSelectedArticles(allIds);
    } else {
      setSelectedArticles(new Set());
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedArticles.size === 0) return;
    
    setBulkAction(action);
    setShowBulkConfirm(true);
  };

  const confirmBulkAction = async () => {
    setIsLoading(true);
    
    try {
      // Execute bulk actions with real API calls
      const promises = Array.from(selectedArticles).map(async (articleId) => {
        switch (bulkAction) {
          case 'delete':
            return await adminApi.deleteArticle(articleId);
          case 'archive':
            return await adminApi.archiveArticle(articleId);
          case 'publish':
            return await adminApi.publishArticle(articleId);
          default:
            throw new Error(`Unknown bulk action: ${bulkAction}`);
        }
      });
      
      await Promise.all(promises);
      
      // Update local state based on action
      setArticles(prev => {
        if (bulkAction === 'delete') {
          return prev.filter(article => !selectedArticles.has(article.id));
        } else if (bulkAction === 'archive') {
          return prev.map(article => 
            selectedArticles.has(article.id)
              ? { ...article, status: 'archived' }
              : article
          );
        } else if (bulkAction === 'publish') {
          return prev.map(article => 
            selectedArticles.has(article.id)
              ? { ...article, status: 'published' }
              : article
          );
        }
        return prev;
      });
      
      // Clear selections and close dialog
      setSelectedArticles(new Set());
      setShowBulkConfirm(false);
      setBulkAction('');
      
      // Notify parent component if callback provided
      if (onArticleAction) {
        selectedArticles.forEach(articleId => {
          onArticleAction(articleId, bulkAction);
        });
      }
      
    } catch (error) {
      console.error('Bulk action failed:', error);
      // You could show a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      published: 'default',
      draft: 'secondary',
      archived: 'outline',
      pending_approval: 'secondary'
    } as const;

    const colors = {
      published: 'bg-green-100 text-green-800 hover:bg-green-200',
      draft: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200',
      archived: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
      pending_approval: 'bg-orange-100 text-orange-800 hover:bg-orange-200'
    } as const;

    const displayText = status === 'pending_approval' ? 'Pending Approval' : status.charAt(0).toUpperCase() + status.slice(1);

    return (
      <Badge className={colors[status as keyof typeof colors] || colors.draft}>
        {displayText}
      </Badge>
    );
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      official: 'bg-blue-100 text-blue-800',
      rumor: 'bg-orange-100 text-orange-800',
      community: 'bg-purple-100 text-purple-800',
      trends: 'bg-pink-100 text-pink-800'
    } as const;

    return (
      <Badge variant="outline" className={colors[category as keyof typeof colors] || colors.community}>
        {category.charAt(0).toUpperCase() + category.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Primary filters row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search articles, authors..."
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange('status', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="pending_approval">Pending Approval</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Category</label>
              <Select value={filters.category} onValueChange={(value) => handleFilterChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="official">Official</SelectItem>
                  <SelectItem value="rumor">Rumor</SelectItem>
                  <SelectItem value="community">Community</SelectItem>
                  <SelectItem value="trends">Trends</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Author</label>
              <Input
                placeholder="Filter by author..."
                value={filters.author}
                onChange={(e) => handleFilterChange('author', e.target.value)}
              />
            </div>
          </div>

          {/* Secondary filters row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Date From</label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Date To</label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Min Reports</label>
              <Input
                type="number"
                placeholder="0"
                min="0"
                value={filters.minReports}
                onChange={(e) => handleFilterChange('minReports', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Max Reports</label>
              <Input
                type="number"
                placeholder="No limit"
                min="0"
                value={filters.maxReports}
                onChange={(e) => handleFilterChange('maxReports', e.target.value)}
              />
            </div>
          </div>

          {/* Actions row */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
              <Button variant="outline" onClick={() => setIsLoading(true)}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {totalArticles} articles found
              </span>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Articles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Articles ({totalArticles})
            </span>
            <div className="flex items-center gap-2">
              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">per page</span>
            </div>
          </CardTitle>
          
          {/* Bulk Actions */}
          {selectedArticles.size > 0 && (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {selectedArticles.size} article{selectedArticles.size !== 1 ? 's' : ''} selected
                </span>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setSelectedArticles(new Set())}
                >
                  Clear Selection
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleBulkAction('publish')}
                  disabled={isLoading}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Publish Selected
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleBulkAction('archive')}
                  disabled={isLoading}
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Archive Selected
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: pageSize }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedArticles.size === paginatedArticles.length && paginatedArticles.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border border-input bg-background"
                      />
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center gap-1">
                        Article
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('author')}
                    >
                      <div className="flex items-center gap-1">
                        Author
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center gap-1">
                        Created
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('views')}
                    >
                      <div className="flex items-center gap-1">
                        Views
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('reports_count')}
                    >
                      <div className="flex items-center gap-1">
                        Reports
                        <ArrowUpDown className="h-4 w-4" />
                      </div>
                    </TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedArticles.map((article) => (
                    <TableRow key={article.id} className="hover:bg-muted/50">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedArticles.has(article.id)}
                          onChange={(e) => handleSelectArticle(article.id, e.target.checked)}
                          className="rounded border border-input bg-background"
                        />
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div>
                          <div className="font-medium truncate">{article.title}</div>
                          <div className="text-sm text-muted-foreground truncate">
                            {article.account_name}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{article.author}</div>
                          <div className="text-sm text-muted-foreground">{article.author_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(article.status)}
                      </TableCell>
                      <TableCell>
                        {getCategoryBadge(article.category)}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDate(article.created_at)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                          {formatNumber(article.views)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {article.reports_count > 0 && (
                            <Flag className="h-4 w-4 text-orange-500" />
                          )}
                          <span className={article.reports_count > 0 ? 'text-orange-600 font-medium' : ''}>
                            {article.reports_count}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedArticle(article);
                                setShowDetailsDialog(true);
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedArticle(article);
                                setShowEditDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Article
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            
                            {/* Status Change Options */}
                            {article.status !== 'published' && (
                              <DropdownMenuItem onClick={() => handleArticleAction(article.id, 'publish')}>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Publish
                              </DropdownMenuItem>
                            )}
                            {article.status !== 'draft' && (
                              <DropdownMenuItem onClick={() => handleArticleAction(article.id, 'draft')}>
                                <Edit className="h-4 w-4 mr-2" />
                                Move to Draft
                              </DropdownMenuItem>
                            )}
                            {article.status !== 'archived' && (
                              <DropdownMenuItem 
                                onClick={() => handleArticleAction(article.id, 'archive')}
                                className="text-yellow-600 focus:text-yellow-700"
                              >
                                <Clock className="h-4 w-4 mr-2" />
                                Archive
                              </DropdownMenuItem>
                            )}
                            
                            <DropdownMenuSeparator />
                            
                            {/* Visibility Change Options */}
                            <DropdownMenuItem onClick={() => handleArticleAction(article.id, 'visibility_public')}>
                              <Eye className="h-4 w-4 mr-2" />
                              Make Public
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleArticleAction(article.id, 'visibility_account')}>
                              <User className="h-4 w-4 mr-2" />
                              Make Account Only
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleArticleAction(article.id, 'visibility_private')}>
                              <Eye className="h-4 w-4 mr-2" />
                              Make Private
                            </DropdownMenuItem>
                            
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleArticleAction(article.id, 'delete')}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Article
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalArticles)} of {totalArticles} articles
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-8 h-8 p-0"
                          >
                            {page}
                          </Button>
                        );
                      })}
                      {totalPages > 5 && (
                        <>
                          <span className="text-muted-foreground">...</span>
                          <Button
                            variant={currentPage === totalPages ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(totalPages)}
                            className="w-8 h-8 p-0"
                          >
                            {totalPages}
                          </Button>
                        </>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {articles.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No articles found</h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your filters or search terms.
                  </p>
                  <Button variant="outline" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Article Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Article Details</DialogTitle>
            <DialogDescription>
              Review article information and take moderation actions.
            </DialogDescription>
          </DialogHeader>
          
          {selectedArticle && (
            <div className="space-y-6">
              {/* Article Header */}
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold">{selectedArticle.title}</h2>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(selectedArticle.status)}
                      {getCategoryBadge(selectedArticle.category)}
                      {selectedArticle.reports_count > 0 && (
                        <Badge variant="destructive">
                          <Flag className="h-3 w-3 mr-1" />
                          {selectedArticle.reports_count} reports
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                {/* Author Info */}
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <User className="h-8 w-8 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{selectedArticle.author}</div>
                    <div className="text-sm text-muted-foreground">{selectedArticle.author_email}</div>
                    <div className="text-sm text-muted-foreground">Account: {selectedArticle.account_name}</div>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{formatNumber(selectedArticle.views)}</div>
                    <div className="text-sm text-muted-foreground">Views</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{selectedArticle.engagement}%</div>
                    <div className="text-sm text-muted-foreground">Engagement</div>
                  </div>
                  <div className="text-center p-3 bg-muted/50 rounded-lg">
                    <div className="text-2xl font-bold">{selectedArticle.reports_count}</div>
                    <div className="text-sm text-muted-foreground">Reports</div>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="font-medium">Created</div>
                    <div className="text-muted-foreground">{formatDate(selectedArticle.created_at)}</div>
                  </div>
                  <div>
                    <div className="font-medium">Last Updated</div>
                    <div className="text-muted-foreground">{formatDate(selectedArticle.updated_at)}</div>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <div className="font-medium mb-2">Tags</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedArticle.tags.map((tag) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Close
                </Button>
                <Button variant="outline">
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                {selectedArticle.status === 'published' ? (
                  <Button 
                    variant="outline" 
                    onClick={() => handleArticleAction(selectedArticle.id, 'unpublish')}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Unpublish
                  </Button>
                ) : (
                  <Button 
                    onClick={() => handleArticleAction(selectedArticle.id, 'publish')}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Publish
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  onClick={() => handleArticleAction(selectedArticle.id, 'delete')}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Individual Action Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'delete' ? 'Delete Article' : 
               confirmAction?.type === 'archive' ? 'Archive Article' : 
               confirmAction?.type === 'unpublish' ? 'Unpublish Article' : 'Confirm Action'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'delete' && 
                `Are you sure you want to permanently delete "${confirmAction?.articleTitle}"? This action cannot be undone and will remove all article data.`
              }
              {confirmAction?.type === 'archive' && 
                `Are you sure you want to archive "${confirmAction?.articleTitle}"? The article will be moved to archived status and hidden from public view.`
              }
              {confirmAction?.type === 'unpublish' && 
                `Are you sure you want to unpublish "${confirmAction?.articleTitle}"? The article will be changed to draft status and removed from public view.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && executeArticleAction(confirmAction.type, confirmAction.articleId)}
              disabled={isLoading}
              className={confirmAction?.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 
                        confirmAction?.type === 'archive' ? 'bg-yellow-600 hover:bg-yellow-700' :
                        confirmAction?.type === 'unpublish' ? 'bg-orange-600 hover:bg-orange-700' : ''}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : confirmAction?.type === 'delete' ? (
                <Trash2 className="h-4 w-4 mr-2" />
              ) : confirmAction?.type === 'archive' ? (
                <Clock className="h-4 w-4 mr-2" />
              ) : confirmAction?.type === 'unpublish' ? (
                <XCircle className="h-4 w-4 mr-2" />
              ) : null}
              {confirmAction?.type === 'delete' ? 'Delete' : 
               confirmAction?.type === 'archive' ? 'Archive' : 
               confirmAction?.type === 'unpublish' ? 'Unpublish' : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Action Confirmation Dialog */}
      <Dialog open={showBulkConfirm} onOpenChange={setShowBulkConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Bulk Action</DialogTitle>
            <DialogDescription>
              Are you sure you want to {bulkAction} {selectedArticles.size} selected article{selectedArticles.size !== 1 ? 's' : ''}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setShowBulkConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant={bulkAction === 'delete' ? 'destructive' : 'default'}
              onClick={confirmBulkAction}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : `${bulkAction.charAt(0).toUpperCase() + bulkAction.slice(1)} Articles`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Article Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Article</DialogTitle>
            <DialogDescription>
              Modify article details and settings.
            </DialogDescription>
          </DialogHeader>
          
          {selectedArticle && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title</label>
                  <Input defaultValue={selectedArticle.title} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Author</label>
                  <Input defaultValue={selectedArticle.author} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select defaultValue={selectedArticle.status}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select defaultValue={selectedArticle.category}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="official">Official</SelectItem>
                      <SelectItem value="rumor">Rumor</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                      <SelectItem value="trends">Trends</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Visibility</label>
                  <Select defaultValue="public">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">Public</SelectItem>
                      <SelectItem value="account">Account Only</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Tags</label>
                <Input defaultValue={selectedArticle.tags.join(', ')} placeholder="Comma-separated tags" />
              </div>
              
              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  // In real implementation, save the changes via API
                  handleArticleAction(selectedArticle.id, 'update');
                  setShowEditDialog(false);
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 