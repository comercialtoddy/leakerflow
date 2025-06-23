'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  Filter,
  Calendar,
  Clock,
  Mail,
  FileText,
  TrendingUp,
  Activity,
  User,
  MoreHorizontal,
  Eye,
  Edit,
  Shield,
  Ban,
  Trash2,
  UserCheck,
  UserX,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  SortAsc,
  SortDesc,
  CalendarIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  Settings
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
import { adminApi, type AuthorActivityItem } from '@/lib/api/admin';

// Mock data for development - replace with actual API calls
const mockAuthors = [
  {
    id: 1,
    fullName: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    username: 'sarahchen',
    status: 'active',
    registrationDate: '2024-01-15',
    lastActiveDate: '2024-12-20',
    lastPublishedDate: '2024-12-18',
    articlesPublished: 42,
    totalViews: 125420,
    totalVotes: 3856,
    averageVotesPerArticle: 91.8,
    accountType: 'verified',
    bio: 'Tech journalist specializing in AI and blockchain technologies.',
    socialMedia: {
      twitter: '@sarahchen_tech',
      linkedin: 'sarah-chen-journalist'
    },
    warnings: 0,
    suspensions: 0,
    role: 'author'
  },
  {
    id: 2,
    fullName: 'Marcus Rodriguez',
    email: 'marcus.r@techblog.com',
    username: 'marcusr',
    status: 'active',
    registrationDate: '2024-02-03',
    lastActiveDate: '2024-12-19',
    lastPublishedDate: '2024-12-15',
    articlesPublished: 38,
    totalViews: 98340,
    totalVotes: 2947,
    averageVotesPerArticle: 77.6,
    accountType: 'premium',
    bio: 'Senior technology correspondent with 10+ years experience.',
    socialMedia: {
      twitter: '@marcus_tech_news',
      linkedin: 'marcus-rodriguez-tech'
    },
    warnings: 1,
    suspensions: 0,
    role: 'author'
  },
  {
    id: 3,
    fullName: 'Elena Kowalski',
    email: 'elena.k@newsnetwork.com',
    username: 'elenatech',
    status: 'suspended',
    registrationDate: '2024-01-20',
    lastActiveDate: '2024-12-10',
    lastPublishedDate: '2024-12-08',
    articlesPublished: 29,
    totalViews: 76530,
    totalVotes: 2134,
    averageVotesPerArticle: 73.6,
    accountType: 'basic',
    bio: 'Freelance technology writer covering cybersecurity and privacy.',
    socialMedia: {
      twitter: '@elena_cybertech'
    },
    warnings: 3,
    suspensions: 1,
    role: 'author',
    suspensionReason: 'Multiple policy violations regarding article accuracy'
  },
  {
    id: 4,
    fullName: 'David Thompson',
    email: 'david.thompson@innovate.media',
    username: 'dthompson',
    status: 'active',
    registrationDate: '2024-03-12',
    lastActiveDate: '2024-12-21',
    lastPublishedDate: '2024-12-20',
    articlesPublished: 56,
    totalViews: 142890,
    totalVotes: 4532,
    averageVotesPerArticle: 80.9,
    accountType: 'verified',
    bio: 'Innovation reporter focusing on emerging technologies and startups.',
    socialMedia: {
      twitter: '@david_innovation',
      linkedin: 'david-thompson-innovation'
    },
    warnings: 0,
    suspensions: 0,
    role: 'author'
  },
  {
    id: 5,
    fullName: 'Ashi Patel',
    email: 'ashi.patel@globaltech.news',
    username: 'ashipatel',
    status: 'active',
    registrationDate: '2024-04-08',
    lastActiveDate: '2024-11-15',
    lastPublishedDate: '2024-10-28',
    articlesPublished: 23,
    totalViews: 54320,
    totalVotes: 1456,
    averageVotesPerArticle: 63.3,
    accountType: 'basic',
    bio: 'International technology correspondent based in Mumbai.',
    socialMedia: {
      twitter: '@ashi_global_tech'
    },
    warnings: 0,
    suspensions: 0,
    role: 'author'
  },
  {
    id: 6,
    fullName: 'James Wilson',
    email: 'j.wilson@techreview.org',
    username: 'jwilson',
    status: 'inactive',
    registrationDate: '2024-02-14',
    lastActiveDate: '2024-08-22',
    lastPublishedDate: '2024-08-15',
    articlesPublished: 19,
    totalViews: 41230,
    totalVotes: 1089,
    averageVotesPerArticle: 57.3,
    accountType: 'basic',
    bio: 'Technology reviewer specializing in consumer electronics.',
    socialMedia: {
      linkedin: 'james-wilson-tech-review'
    },
    warnings: 0,
    suspensions: 0,
    role: 'author'
  }
] as Author[];

// Mock activity history data
const mockActivityHistory = {
  1: [
    { id: 1, action: 'Published Article', details: 'AI Revolution in 2024', timestamp: '2024-12-20T10:30:00Z' },
    { id: 2, action: 'Profile Updated', details: 'Updated bio and social media links', timestamp: '2024-12-19T15:45:00Z' },
    { id: 3, action: 'Article Edited', details: 'Blockchain Security Analysis', timestamp: '2024-12-18T09:15:00Z' },
    { id: 4, action: 'Comment Posted', details: 'Replied to user feedback', timestamp: '2024-12-17T14:20:00Z' },
    { id: 5, action: 'Account Created', details: 'Joined the platform', timestamp: '2024-01-15T08:00:00Z' }
  ],
  2: [
    { id: 1, action: 'Published Article', details: 'Startup Trends 2024', timestamp: '2024-12-15T11:30:00Z' },
    { id: 2, action: 'Warning Issued', details: 'Article flagged for review', timestamp: '2024-12-10T16:45:00Z' },
    { id: 3, action: 'Profile Updated', details: 'Updated contact information', timestamp: '2024-12-05T13:15:00Z' }
  ]
} as Record<number, Array<{ id: number; action: string; details: string; timestamp: string }>>;

interface Author {
  id: number;
  fullName: string;
  email: string;
  username: string;
  status: 'active' | 'suspended' | 'inactive';
  registrationDate: string;
  lastActiveDate: string;
  lastPublishedDate: string;
  articlesPublished: number;
  totalViews: number;
  totalVotes: number;
  averageVotesPerArticle: number;
  accountType: 'basic' | 'premium' | 'verified';
  bio: string;
  socialMedia: {
    twitter?: string;
    linkedin?: string;
  };
  warnings: number;
  suspensions: number;
  role: string;
  suspensionReason?: string;
}

type SortField = 'fullName' | 'email' | 'articlesPublished' | 'totalViews' | 'averageVotesPerArticle' | 'registrationDate' | 'lastActiveDate' | 'lastPublishedDate';
type SortOrder = 'asc' | 'desc';

export function AuthorManagementPanel() {
  // State management
  const [authors] = useState<Author[]>(mockAuthors);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all');
  const [activityFilter, setActivityFilter] = useState<string>('all');
  const [registrationDateFrom, setRegistrationDateFrom] = useState('');
  const [registrationDateTo, setRegistrationDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastActiveDate');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);
  const [showAuthorDialog, setShowAuthorDialog] = useState(false);
  const [showActivityHistory, setShowActivityHistory] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: string; authorId: number; authorName: string } | null>(null);
  const [activityHistory, setActivityHistory] = useState<Array<{ id: number; action: string; details: string; timestamp: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'default',
      suspended: 'destructive',
      inactive: 'secondary'
    } as const;

    const icons = {
      active: CheckCircle,
      suspended: XCircle,
      inactive: AlertCircle
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <Badge variant={variants[status as keyof typeof variants]}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getAccountTypeBadge = (type: string) => {
    const variants = {
      basic: 'outline',
      premium: 'secondary',
      verified: 'default'
    } as const;

    return (
      <Badge variant={variants[type as keyof typeof variants]}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  const isInactive = (lastActiveDate: string) => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    return new Date(lastActiveDate) < threeMonthsAgo;
  };

  // Filtering and sorting logic
  const filteredAndSortedAuthors = useMemo(() => {
    let filtered = authors.filter(author => {
      // Text search
      const searchMatch = 
        author.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        author.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        author.username.toLowerCase().includes(searchTerm.toLowerCase());

      // Status filter
      const statusMatch = statusFilter === 'all' || author.status === statusFilter;

      // Account type filter
      const accountTypeMatch = accountTypeFilter === 'all' || author.accountType === accountTypeFilter;

      // Activity filter
      let activityMatch = true;
      if (activityFilter === 'inactive_3_months') {
        activityMatch = isInactive(author.lastActiveDate);
      } else if (activityFilter === 'active_recent') {
        activityMatch = !isInactive(author.lastActiveDate);
      } else if (activityFilter === 'no_articles_6_months') {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        activityMatch = new Date(author.lastPublishedDate) < sixMonthsAgo;
      }

      // Date range filter
      let dateMatch = true;
      if (registrationDateFrom) {
        dateMatch = dateMatch && new Date(author.registrationDate) >= new Date(registrationDateFrom);
      }
      if (registrationDateTo) {
        dateMatch = dateMatch && new Date(author.registrationDate) <= new Date(registrationDateTo);
      }

      return searchMatch && statusMatch && accountTypeMatch && activityMatch && dateMatch;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField.includes('Date')) {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [authors, searchTerm, statusFilter, accountTypeFilter, activityFilter, registrationDateFrom, registrationDateTo, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedAuthors.length / itemsPerPage);
  const paginatedAuthors = filteredAndSortedAuthors.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handler functions
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleViewAuthor = (author: Author) => {
    setSelectedAuthor(author);
    setShowAuthorDialog(true);
  };

  const handleAuthorAction = async (action: string, authorId: number) => {
    const author = authors.find(a => a.id === authorId);
    if (!author) return;

    // For destructive actions, show confirmation dialog
    if (action === 'suspend' || action === 'delete') {
      setConfirmAction({ type: action, authorId, authorName: author.fullName });
      setShowConfirmDialog(true);
      return;
    }

    // Handle non-destructive actions directly
    if (action === 'view_activity') {
      await loadActivityHistory(authorId);
      return;
    }

    // Execute the action
    await executeAuthorAction(action, authorId);
  };

  const executeAuthorAction = async (action: string, authorId: number) => {
    setIsLoading(true);
    try {
      let result;
      
      switch (action) {
        case 'suspend':
          result = await adminApi.suspendAuthor(authorId);
          break;
        case 'activate':
          result = await adminApi.activateAuthor(authorId);
          break;
        case 'delete':
          result = await adminApi.deleteAuthor(authorId);
          break;
        case 'edit':
          // Navigate to edit page or open edit modal
          console.log(`Edit author ${authorId}`);
          return;
        case 'message':
          // Open email client or message modal
          const author = authors.find(a => a.id === authorId);
          if (author) {
            window.open(`mailto:${author.email}`, '_blank');
          }
          return;
        default:
          console.log(`Unknown action: ${action}`);
          return;
      }

      if (result.error) {
        throw new Error(result.error);
      }

      console.log(`Successfully ${action}ed author:`, result.data);
      
      // Show success message
      console.log(`Author ${action}ed successfully`);
      
      // Refresh the authors list or update local state
      // In a real implementation, you'd update the authors state or refetch
      
    } catch (error) {
      console.error(`Error ${action}ing author:`, error);
      // Show error message
      console.log(`Failed to ${action} author: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      setShowConfirmDialog(false);
      setConfirmAction(null);
    }
  };

  const loadActivityHistory = async (authorId: number) => {
    setIsLoading(true);
    try {
      // Try to load from API first
      const result = await adminApi.getAuthorActivityHistory(authorId);
      
      if (result.error) {
        // Fallback to mock data if API fails
        console.log('API failed, using mock data:', result.error);
        const history = mockActivityHistory[authorId] || [];
        setActivityHistory(history);
      } else {
        setActivityHistory(result.data || []);
      }
      
      setShowActivityHistory(true);
    } catch (error) {
      console.error('Error loading activity history:', error);
      // Fallback to mock data
      const history = mockActivityHistory[authorId] || [];
      setActivityHistory(history);
      setShowActivityHistory(true);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setAccountTypeFilter('all');
    setActivityFilter('all');
    setRegistrationDateFrom('');
    setRegistrationDateTo('');
    setSortField('lastActiveDate');
    setSortOrder('desc');
    setCurrentPage(1);
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 text-left justify-start font-medium hover:bg-muted/50"
      onClick={() => handleSort(field)}
    >
      {children}
      {sortField === field && (
        sortOrder === 'asc' ? 
        <SortAsc className="ml-2 h-4 w-4" /> : 
        <SortDesc className="ml-2 h-4 w-4" />
      )}
    </Button>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Users className="h-8 w-8" />
              Author Management
            </h2>
            <p className="text-muted-foreground">
              Manage authors, view statistics, and monitor platform activity
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsLoading(true)}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Statistics Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Authors</p>
                <p className="text-2xl font-bold">{authors.length}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Authors</p>
                <p className="text-2xl font-bold">{authors.filter(a => a.status === 'active').length}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Suspended</p>
                <p className="text-2xl font-bold">{authors.filter(a => a.status === 'suspended').length}</p>
              </div>
              <UserX className="h-8 w-8 text-red-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Articles</p>
                <p className="text-2xl font-bold">{authors.reduce((sum, a) => sum + a.articlesPublished, 0)}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters & Search
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search Authors</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Name, email, username..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account-type-filter">Account Type</Label>
                <Select value={accountTypeFilter} onValueChange={setAccountTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="activity-filter">Activity</Label>
                <Select value={activityFilter} onValueChange={setActivityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="active_recent">Recently Active</SelectItem>
                    <SelectItem value="inactive_3_months">Inactive 3+ Months</SelectItem>
                    <SelectItem value="no_articles_6_months">No Articles 6+ Months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="reg-date-from">Registration Date From</Label>
                <Input
                  id="reg-date-from"
                  type="date"
                  value={registrationDateFrom}
                  onChange={(e) => setRegistrationDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reg-date-to">Registration Date To</Label>
                <Input
                  id="reg-date-to"
                  type="date"
                  value={registrationDateTo}
                  onChange={(e) => setRegistrationDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All Filters
              </Button>
              <Badge variant="secondary" className="h-6">
                {filteredAndSortedAuthors.length} result{filteredAndSortedAuthors.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Authors Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Authors ({filteredAndSortedAuthors.length})</CardTitle>
            <CardDescription>
              Manage and monitor all platform authors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">
                      <SortButton field="fullName">Author</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="email">Contact</SortButton>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <SortButton field="articlesPublished">Articles</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton field="averageVotesPerArticle">Avg Votes</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="lastActiveDate">Last Active</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="registrationDate">Registered</SortButton>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="wait">
                    {paginatedAuthors.map((author, index) => (
                      <motion.tr
                        key={author.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                              {author.fullName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="font-medium">{author.fullName}</div>
                              <div className="text-sm text-muted-foreground">@{author.username}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{author.email}</span>
                          </div>
                          <div className="flex items-center space-x-1 mt-1">
                            {getAccountTypeBadge(author.accountType)}
                            {author.warnings > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {author.warnings} warning{author.warnings > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(author.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{author.articlesPublished}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {author.totalViews.toLocaleString()} views
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <TrendingUp className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{author.averageVotesPerArticle.toFixed(1)}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {author.totalVotes} total votes
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Activity className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDate(author.lastActiveDate)}</span>
                          </div>
                          {isInactive(author.lastActiveDate) && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Inactive 3+ months
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDate(author.registrationDate)}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleViewAuthor(author)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAuthorAction('edit', author.id)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Profile
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAuthorAction('view_activity', author.id)}>
                                <Activity className="mr-2 h-4 w-4" />
                                View Activity History
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {author.status === 'active' ? (
                                <DropdownMenuItem 
                                  onClick={() => handleAuthorAction('suspend', author.id)}
                                  className="text-orange-600"
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Suspend Author
                                </DropdownMenuItem>
                              ) : author.status === 'suspended' ? (
                                <DropdownMenuItem 
                                  onClick={() => handleAuthorAction('activate', author.id)}
                                  className="text-green-600"
                                >
                                  <Shield className="mr-2 h-4 w-4" />
                                  Reactivate Author
                                </DropdownMenuItem>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleAuthorAction('delete', author.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Author
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="flex items-center space-x-2">
                <Label htmlFor="page-size">Rows per page:</Label>
                <Select
                  value={itemsPerPage.toString()}
                  onValueChange={(value) => {
                    setItemsPerPage(Number(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-6 lg:space-x-8">
                <div className="flex w-[100px] items-center justify-center text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Author Details Dialog */}
      <Dialog open={showAuthorDialog} onOpenChange={setShowAuthorDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <User className="h-6 w-6" />
              Author Details
            </DialogTitle>
            <DialogDescription>
              Complete information about {selectedAuthor?.fullName}
            </DialogDescription>
          </DialogHeader>

          {selectedAuthor && (
            <div className="space-y-6">
              {/* Author Profile */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Profile Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl">
                        {selectedAuthor.fullName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{selectedAuthor.fullName}</h3>
                        <p className="text-muted-foreground">@{selectedAuthor.username}</p>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(selectedAuthor.status)}
                          {getAccountTypeBadge(selectedAuthor.accountType)}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{selectedAuthor.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Registered {formatDate(selectedAuthor.registrationDate)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Activity className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Last active {formatDate(selectedAuthor.lastActiveDate)}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Last published {formatDate(selectedAuthor.lastPublishedDate)}</span>
                      </div>
                    </div>

                    {selectedAuthor.bio && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-sm font-medium">Bio</Label>
                          <p className="text-sm text-muted-foreground mt-1">{selectedAuthor.bio}</p>
                        </div>
                      </>
                    )}

                    {(selectedAuthor.socialMedia.twitter || selectedAuthor.socialMedia.linkedin) && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-sm font-medium">Social Media</Label>
                          <div className="space-y-2 mt-2">
                            {selectedAuthor.socialMedia.twitter && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground">Twitter:</span>
                                <span className="text-sm">{selectedAuthor.socialMedia.twitter}</span>
                              </div>
                            )}
                            {selectedAuthor.socialMedia.linkedin && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground">LinkedIn:</span>
                                <span className="text-sm">{selectedAuthor.socialMedia.linkedin}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Statistics & Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 grid-cols-2">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <FileText className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                        <div className="text-2xl font-bold">{selectedAuthor.articlesPublished}</div>
                        <div className="text-sm text-muted-foreground">Articles Published</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <Eye className="h-8 w-8 mx-auto text-green-600 mb-2" />
                        <div className="text-2xl font-bold">{selectedAuthor.totalViews.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Total Views</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <TrendingUp className="h-8 w-8 mx-auto text-purple-600 mb-2" />
                        <div className="text-2xl font-bold">{selectedAuthor.totalVotes.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Total Votes</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <Activity className="h-8 w-8 mx-auto text-orange-600 mb-2" />
                        <div className="text-2xl font-bold">{selectedAuthor.averageVotesPerArticle.toFixed(1)}</div>
                        <div className="text-sm text-muted-foreground">Avg Votes/Article</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Warnings</span>
                        <Badge variant={selectedAuthor.warnings > 0 ? "destructive" : "outline"}>
                          {selectedAuthor.warnings}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Suspensions</span>
                        <Badge variant={selectedAuthor.suspensions > 0 ? "destructive" : "outline"}>
                          {selectedAuthor.suspensions}
                        </Badge>
                      </div>
                      {selectedAuthor.suspensionReason && (
                        <div>
                          <Label className="text-sm font-medium text-red-600">Suspension Reason</Label>
                          <p className="text-sm text-muted-foreground mt-1">{selectedAuthor.suspensionReason}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => handleAuthorAction('edit', selectedAuthor.id)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Profile
                </Button>
                <Button variant="outline" onClick={() => handleAuthorAction('view_articles', selectedAuthor.id)}>
                  <FileText className="mr-2 h-4 w-4" />
                  View Articles
                </Button>
                <Button variant="outline" onClick={() => handleAuthorAction('message', selectedAuthor.id)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Send Message
                </Button>
                <Button variant="outline" onClick={() => handleAuthorAction('view_activity', selectedAuthor.id)}>
                  <Activity className="mr-2 h-4 w-4" />
                  View Activity History
                </Button>
                {selectedAuthor.status === 'active' ? (
                  <Button 
                    variant="outline" 
                    onClick={() => handleAuthorAction('suspend', selectedAuthor.id)}
                    className="text-orange-600 hover:text-orange-700"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Suspend Author
                  </Button>
                ) : selectedAuthor.status === 'suspended' ? (
                  <Button 
                    variant="outline" 
                    onClick={() => handleAuthorAction('activate', selectedAuthor.id)}
                    className="text-green-600 hover:text-green-700"
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Reactivate Author
                  </Button>
                ) : null}
                <Button 
                  variant="destructive" 
                  onClick={() => handleAuthorAction('delete', selectedAuthor.id)}
                  className="ml-auto"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Author
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'suspend' ? 'Suspend Author' : 'Delete Author'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'suspend' 
                ? `Are you sure you want to suspend ${confirmAction?.authorName}? They will not be able to publish new articles until reactivated.`
                : `Are you sure you want to permanently delete ${confirmAction?.authorName}? This action cannot be undone and will remove all their data.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmAction && executeAuthorAction(confirmAction.type, confirmAction.authorId)}
              disabled={isLoading}
              className={confirmAction?.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : confirmAction?.type === 'suspend' ? (
                <Ban className="h-4 w-4 mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              {confirmAction?.type === 'suspend' ? 'Suspend' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity History Dialog */}
      <Dialog open={showActivityHistory} onOpenChange={setShowActivityHistory}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Activity className="h-6 w-6" />
              Activity History
            </DialogTitle>
            <DialogDescription>
              Recent activity for this author
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {activityHistory.length > 0 ? (
              <div className="space-y-3">
                {activityHistory.map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{activity.action}</h4>
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(activity.timestamp)}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{activity.details}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No activity history available</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 