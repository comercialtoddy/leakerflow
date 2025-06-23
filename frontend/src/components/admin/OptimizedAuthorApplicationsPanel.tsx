'use client';

import React, { useState, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  Filter,
  Calendar,
  Clock,
  Mail,
  FileText,
  Eye,
  CheckCircle,
  XCircle,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  SortAsc,
  SortDesc,
  UserCheck,
  UserX,
  AlertCircle,
  ExternalLink,
  Globe,
  MessageSquare,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react';

// Optimized imports
import { VirtualTable } from '@/components/ui/virtual-table';
import { LazyComponent, PanelSkeleton, StatsSkeleton } from '@/components/ui/lazy-loading';
import {
  useFilterAndSort,
  usePagination,
  useComponentPerformance,
  useOptimizedHandlers,
  useDebouncedSearch
} from '@/hooks/usePerformanceOptimizations';

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
import { adminApi } from '@/lib/api/admin';

// Optimized interfaces
interface Application {
  id: number;
  fullName: string;
  email: string;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  bio: string;
  expertiseAreas: string[];
  portfolioUrl: string;
  sampleArticles: string[];
  motivation: string;
  socialMedia: {
    twitter?: string;
    linkedin?: string;
  };
  previousExperience: string;
  education: string;
  writingSamples: number;
  averageViews: number;
  reviewedBy?: string;
  rejectionReason?: string;
}

type SortField = keyof Application;

// Mock data - optimized version
const mockApplications: Application[] = [
  {
    id: 1,
    fullName: 'Sarah Chen',
    email: 'sarah.chen@techwriter.com',
    status: 'pending',
    submittedAt: '2024-01-15',
    bio: 'Experienced technology journalist with 8+ years covering AI, blockchain, and cybersecurity.',
    expertiseAreas: ['Artificial Intelligence', 'Blockchain', 'Cybersecurity', 'Fintech'],
    portfolioUrl: 'https://sarahchen.dev',
    sampleArticles: [
      'https://techcrunch.com/ai-revolution-2024',
      'https://wired.com/blockchain-security-analysis',
      'https://medium.com/@sarahchen/cybersecurity-trends'
    ],
    motivation: 'I want to contribute to the platform by sharing insights on emerging technologies.',
    socialMedia: {
      twitter: '@sarahchen_tech',
      linkedin: 'sarah-chen-journalist'
    },
    previousExperience: 'Senior Tech Writer at TechCrunch (2020-2024), Staff Writer at Wired (2018-2020)',
    education: 'MS Computer Science, Stanford University',
    writingSamples: 3,
    averageViews: 25000,
    reviewedBy: undefined,
    rejectionReason: undefined
  },
  {
    id: 2,
    fullName: 'Marcus Rodriguez',
    email: 'marcus.r@freelance.com',
    status: 'under_review',
    submittedAt: '2024-01-10',
    bio: 'Freelance technology writer specializing in emerging tech trends.',
    expertiseAreas: ['Startups', 'Developer Tools', 'Cloud Computing', 'Mobile Tech'],
    portfolioUrl: 'https://marcusrodriguez.io',
    sampleArticles: [
      'https://techblog.com/startup-trends-2024',
      'https://devtools.com/cloud-native-development'
    ],
    motivation: 'I want to share my insights about the startup ecosystem.',
    socialMedia: {
      twitter: '@marcus_tech_writer',
      linkedin: 'marcus-rodriguez-tech'
    },
    previousExperience: 'Freelance Tech Writer (2019-present)',
    education: 'BA Journalism, University of California',
    writingSamples: 2,
    averageViews: 15000,
    reviewedBy: 'admin-1',
    rejectionReason: undefined
  }
];

// Memoized status badge component
const StatusBadge = memo(({ status }: { status: string }) => {
  const config = useMemo(() => {
    const variants = {
      pending: { variant: 'secondary' as const, color: 'text-amber-600', icon: Clock },
      under_review: { variant: 'default' as const, color: 'text-blue-600', icon: AlertCircle },
      approved: { variant: 'default' as const, color: 'text-green-600', icon: CheckCircle },
      rejected: { variant: 'destructive' as const, color: 'text-red-600', icon: XCircle }
    };
    return variants[status as keyof typeof variants];
  }, [status]);

  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.color}>
      <Icon className="w-3 h-3 mr-1" />
      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
    </Badge>
  );
});

StatusBadge.displayName = 'StatusBadge';

// Memoized stats card component
const StatsCard = memo(({ 
  title, 
  value, 
  icon: Icon, 
  className = '' 
}: { 
  title: string; 
  value: number; 
  icon: React.ComponentType<any>; 
  className?: string; 
}) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
        <Icon className={`h-8 w-8 ml-auto ${className}`} />
      </div>
    </CardContent>
  </Card>
));

StatsCard.displayName = 'StatsCard';

// Main optimized component
export const OptimizedAuthorApplicationsPanel = memo(() => {
  // Performance monitoring
  useComponentPerformance('OptimizedAuthorApplicationsPanel');
  
  // State management
  const [applications] = useState<Application[]>(mockApplications);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortConfig, setSortConfig] = useState<{ key: SortField; direction: 'asc' | 'desc' } | null>({
    key: 'submittedAt',
    direction: 'desc'
  });
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Debounced search
  const debouncedSearchTerm = useDebouncedSearch(searchTerm, 300);

  // Optimized handlers
  const { createAsyncHandler } = useOptimizedHandlers();

  // Filtered and sorted data
  const filteredApplications = useFilterAndSort(
    applications,
    { status: statusFilter },
    sortConfig,
    debouncedSearchTerm,
    ['fullName', 'email', 'expertiseAreas']
  );

  // Statistics computation
  const stats = useMemo(() => ({
    total: applications.length,
    pending: applications.filter(a => a.status === 'pending').length,
    approved: applications.filter(a => a.status === 'approved').length,
    rejected: applications.filter(a => a.status === 'rejected').length
  }), [applications]);

  // Event handlers
  const handleSort = useCallback((field: SortField) => {
    setSortConfig(current => ({
      key: field,
      direction: current?.key === field && current.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const handleViewApplication = useCallback((application: Application) => {
    setSelectedApplication(application);
    setShowApplicationDialog(true);
  }, []);

  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortConfig({ key: 'submittedAt', direction: 'desc' });
  }, []);

  // Table columns configuration
  const columns = useMemo(() => [
    {
      key: 'fullName' as keyof Application,
      header: 'Name',
      sortable: true,
      render: (value: string, item: Application) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-muted-foreground">{item.email}</div>
        </div>
      )
    },
    {
      key: 'status' as keyof Application,
      header: 'Status',
      sortable: true,
      render: (value: string) => <StatusBadge status={value} />
    },
    {
      key: 'submittedAt' as keyof Application,
      header: 'Submitted',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString()
    },
    {
      key: 'expertiseAreas' as keyof Application,
      header: 'Expertise',
      render: (value: string[]) => (
        <div className="flex gap-1 flex-wrap">
          {value.slice(0, 2).map(area => (
            <Badge key={area} variant="outline" className="text-xs">
              {area}
            </Badge>
          ))}
          {value.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{value.length - 2}
            </Badge>
          )}
        </div>
      )
    },
    {
      key: 'averageViews' as keyof Application,
      header: 'Avg Views',
      sortable: true,
      render: (value: number) => value.toLocaleString()
    }
  ], []);

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
              <UserCheck className="h-8 w-8" />
              Author Applications (Optimized)
            </h2>
            <p className="text-muted-foreground">
              Review and manage pending author applications with enhanced performance
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setIsLoading(!isLoading)}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Statistics - Lazy loaded */}
      <LazyComponent fallback={<StatsSkeleton />}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <StatsCard
            title="Total Applications"
            value={stats.total}
            icon={FileText}
          />
          <StatsCard
            title="Pending Review"
            value={stats.pending}
            icon={Clock}
            className="text-amber-600"
          />
          <StatsCard
            title="Approved"
            value={stats.approved}
            icon={CheckCircle}
            className="text-green-600"
          />
          <StatsCard
            title="Rejected"
            value={stats.rejected}
            icon={XCircle}
            className="text-red-600"
          />
        </motion.div>
      </LazyComponent>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Search by name, email, or expertise... (debounced 300ms)"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Virtual Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <VirtualTable
          data={filteredApplications}
          columns={columns}
          rowHeight={80}
          containerHeight={600}
          sortField={sortConfig?.key}
          sortDirection={sortConfig?.direction}
          onSort={handleSort}
          getRowId={(item) => item.id}
          loading={isLoading}
          emptyMessage="No applications found"
          onRowClick={handleViewApplication}
        />
      </motion.div>

      {/* Application Details Dialog */}
      <Dialog open={showApplicationDialog} onOpenChange={setShowApplicationDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Review the complete application information
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">Full Name</Label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.fullName}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Email</Label>
                  <p className="text-sm text-muted-foreground">{selectedApplication.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <div className="mt-1">
                    <StatusBadge status={selectedApplication.status} />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Submitted</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedApplication.submittedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium">Bio</Label>
                <p className="text-sm text-muted-foreground mt-1">{selectedApplication.bio}</p>
              </div>
              <div>
                <Label className="text-sm font-medium">Motivation</Label>
                <p className="text-sm text-muted-foreground mt-1">{selectedApplication.motivation}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

OptimizedAuthorApplicationsPanel.displayName = 'OptimizedAuthorApplicationsPanel'; 