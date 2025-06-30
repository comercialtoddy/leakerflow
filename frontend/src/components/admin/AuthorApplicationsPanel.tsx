'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  User,
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
  ThumbsDown,
  Loader2
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
import { AdminService, type AuthorApplicationAdmin, type ApplicationStats } from '@/lib/supabase/admin';
import { toast } from 'sonner';

// Type definitions
type SortField = 'submitted_at' | 'full_name' | 'status';
type SortOrder = 'asc' | 'desc';

export function AuthorApplicationsPanel() {
  // State management
  const [applications, setApplications] = useState<AuthorApplicationAdmin[]>([]);
  const [stats, setStats] = useState<ApplicationStats>({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    under_review: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const adminService = new AdminService();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('submitted_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedApplication, setSelectedApplication] = useState<AuthorApplicationAdmin | null>(null);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

  // Load applications on mount
  useEffect(() => {
    loadApplications();
    loadStats();
  }, [statusFilter]);

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const data = await adminService.getAuthorApplications({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50
      });
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await adminService.getApplicationStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      pending: 'secondary',
      under_review: 'default',
      approved: 'default',
      rejected: 'destructive'
    } as const;

    const colors = {
      pending: 'text-amber-600',
      under_review: 'text-blue-600',
      approved: 'text-green-600',
      rejected: 'text-red-600'
    };

    const icons = {
      pending: Clock,
      under_review: AlertCircle,
      approved: CheckCircle,
      rejected: XCircle
    };

    const Icon = icons[status as keyof typeof icons];

    return (
      <Badge variant={variants[status as keyof typeof variants]} className={colors[status as keyof typeof colors]}>
        <Icon className="w-3 h-3 mr-1" />
        {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
      </Badge>
    );
  };

  // Filtering and sorting logic
  const filteredAndSortedApplications = useMemo(() => {
    let filtered = applications.filter(app => {
      const matchesSearch = !searchTerm || 
        app.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (app.bio && app.bio.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort applications
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      if (sortField === 'submitted_at') {
        aValue = new Date(a.submitted_at).getTime();
        bValue = new Date(b.submitted_at).getTime();
      } else if (sortField === 'full_name') {
        aValue = a.full_name.toLowerCase();
        bValue = b.full_name.toLowerCase();
      } else if (sortField === 'status') {
        aValue = a.status;
        bValue = b.status;
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [applications, searchTerm, statusFilter, sortField, sortOrder]);

  // Pagination logic
  const paginatedApplications = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedApplications.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedApplications, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedApplications.length / itemsPerPage);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
  };

  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleViewApplication = (application: AuthorApplicationAdmin) => {
    setSelectedApplication(application);
    setShowApplicationDialog(true);
  };

  const handleCloseDialog = () => {
    setShowApplicationDialog(false);
    setSelectedApplication(null);
    setReviewAction(null);
    setRejectionReason('');
    setReviewNotes('');
  };

  const handleReviewAction = async (action: 'approve' | 'reject') => {
    if (!selectedApplication) return;

    if (action === 'reject' && !rejectionReason.trim()) {
      toast.error('Please provide a rejection reason');
      return;
    }

    try {
      setIsReviewing(true);
      
      const success = await adminService.reviewApplication(
        selectedApplication.id,
        action === 'approve' ? 'approved' : 'rejected',
        reviewNotes.trim() || undefined,
        action === 'reject' ? rejectionReason.trim() : undefined
      );

      if (success) {
        toast.success(`Application ${action}d successfully`);
        handleCloseDialog();
        await loadApplications();
        await loadStats();
      } else {
        toast.error(`Failed to ${action} application`);
      }
    } catch (error) {
      console.error(`Error ${action}ing application:`, error);
      toast.error(`Failed to ${action} application`);
    } finally {
      setIsReviewing(false);
    }
  };

  const handleRefresh = async () => {
    await loadApplications();
    await loadStats();
    toast.success('Applications refreshed');
  };

  const handleExport = () => {
    const csvContent = [
      ['Name', 'Email', 'Status', 'Bio', 'Motivation', 'Submitted At'],
      ...filteredAndSortedApplications.map(app => [
        app.full_name,
        app.email,
        app.status,
        app.bio || '',
        app.motivation,
        formatDate(app.submitted_at)
      ])
    ].map(row => row.map(field => `"${field}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'author-applications.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Helper component for sortable headers
  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead 
      className="cursor-pointer select-none hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-2">
        {children}
        {sortField === field && (
          sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
        )}
      </div>
    </TableHead>
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const extractExpertiseFromWritingExperience = (writingExperience?: string) => {
    if (!writingExperience) return [];
    
    // Try to extract expertise areas from writing experience
    const expertiseMatch = writingExperience.match(/Areas of expertise:\s*(.+?)(?:\n|$)/i);
    if (expertiseMatch) {
      return expertiseMatch[1].split(',').map(area => area.trim()).slice(0, 3);
    }
    
    // Fallback: extract technology-related keywords
    const keywords = ['AI', 'Blockchain', 'Cybersecurity', 'Cloud', 'Mobile', 'Web', 'Data', 'Machine Learning'];
    const found = keywords.filter(keyword => 
      writingExperience.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, 3);
    
    return found.length > 0 ? found : ['Technology'];
  };

  const getPortfolioLinks = (portfolioLinks?: string[]) => {
    return portfolioLinks || [];
  };

  const getSampleCount = (portfolioLinks?: string[]) => {
    return portfolioLinks ? portfolioLinks.length : 0;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Author Applications</h2>
          <p className="text-muted-foreground">
            Review and manage author application requests
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search applications..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10 w-full sm:w-80"
                />
              </div>
              <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="w-4 h-4" />
              {filteredAndSortedApplications.length} of {applications.length} applications
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Applications ({filteredAndSortedApplications.length})
          </CardTitle>
          <CardDescription>
            Review and manage author application requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Expertise Areas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead>Avg Views</TableHead>
                  <SortableHeader field="submitted_at">Submitted</SortableHeader>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <AnimatePresence>
                  {paginatedApplications.map((application) => {
                    const expertiseAreas = extractExpertiseFromWritingExperience(application.writing_experience);
                    const portfolioLinks = getPortfolioLinks(application.portfolio_links);
                    const sampleCount = getSampleCount(application.portfolio_links);
                    
                    return (
                      <motion.tr
                        key={application.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.2 }}
                        className="group hover:bg-muted/50 transition-colors"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                              {getInitials(application.full_name)}
                            </div>
                            <div>
                              <div className="font-medium">{application.full_name}</div>
                              <div className="text-sm text-muted-foreground">{application.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-48">
                            {expertiseAreas.map((area, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                {area}
                              </Badge>
                            ))}
                            {expertiseAreas.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{expertiseAreas.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(application.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-muted-foreground" />
                            {sampleCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Eye className="w-4 h-4 text-muted-foreground" />
                            N/A
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {formatDate(application.submitted_at)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => handleViewApplication(application)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              {application.status === 'pending' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedApplication(application);
                                      setReviewAction('approve');
                                      handleReviewAction('approve');
                                    }}
                                    className="text-green-600"
                                  >
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedApplication(application);
                                      setReviewAction('reject');
                                      setShowApplicationDialog(true);
                                    }}
                                    className="text-red-600"
                                  >
                                    <UserX className="mr-2 h-4 w-4" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2">
                <Label>Items per page:</Label>
                <Select 
                  value={itemsPerPage.toString()} 
                  onValueChange={(value) => {
                    setItemsPerPage(parseInt(value));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
                
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Application Details Dialog */}
      <Dialog open={showApplicationDialog} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Application Details
            </DialogTitle>
            <DialogDescription>
              Review the complete author application for {selectedApplication?.full_name}
            </DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-6">
              {/* Application Header */}
              <div className="flex items-start justify-between p-6 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium">
                    {getInitials(selectedApplication.full_name)}
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold">{selectedApplication.full_name}</h3>
                    <p className="text-muted-foreground">{selectedApplication.email}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {getStatusBadge(selectedApplication.status)}
                      <span className="text-sm text-muted-foreground">
                        Applied {formatDate(selectedApplication.submitted_at)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Personal Information */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Personal Information
                </h4>
                <div className="grid gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Bio</Label>
                    <p className="mt-1 text-sm">{selectedApplication.bio || 'No bio provided'}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Writing Experience</Label>
                    <p className="mt-1 text-sm">{selectedApplication.writing_experience || 'No experience provided'}</p>
                  </div>
                </div>
              </div>

              {/* Expertise Areas */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Areas of Expertise
                </h4>
                <div className="flex flex-wrap gap-2">
                  {extractExpertiseFromWritingExperience(selectedApplication.writing_experience).map((area, index) => (
                    <Badge key={index} variant="secondary">
                      {area}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Social Media */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <Globe className="w-5 h-5" />
                  Social Media & Links
                </h4>
                <div className="grid gap-3">
                  {getPortfolioLinks(selectedApplication.portfolio_links).length > 0 ? (
                    getPortfolioLinks(selectedApplication.portfolio_links).map((link, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline"
                        >
                          {link}
                        </a>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No portfolio links provided</p>
                  )}
                </div>
              </div>

              {/* Writing Samples */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Writing Samples
                </h4>
                <div className="grid gap-3">
                  {getPortfolioLinks(selectedApplication.portfolio_links).length > 0 ? (
                    getPortfolioLinks(selectedApplication.portfolio_links).map((link, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">Sample {index + 1}</p>
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline"
                            >
                              {link}
                            </a>
                          </div>
                          <ExternalLink className="w-4 h-4 text-muted-foreground ml-2" />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No writing samples provided</p>
                  )}
                </div>
              </div>

              {/* Application Statistics */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Writing Samples</span>
                  </div>
                  <p className="text-2xl font-bold">{getSampleCount(selectedApplication.portfolio_links)}</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Average Views</span>
                  </div>
                  <p className="text-2xl font-bold">N/A</p>
                </div>
              </div>

              {/* Motivation */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Motivation
                </h4>
                <div className="p-4 bg-muted/30 rounded-lg">
                  <p className="text-sm">{selectedApplication.motivation}</p>
                </div>
              </div>

              {/* Rejection Reason (if rejected) */}
              {selectedApplication.status === 'rejected' && selectedApplication.rejection_reason && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold flex items-center gap-2 text-red-600">
                    <XCircle className="w-5 h-5" />
                    Rejection Reason
                  </h4>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-800">{selectedApplication.rejection_reason}</p>
                  </div>
                </div>
              )}

              {/* Review Actions */}
              {selectedApplication.status === 'pending' && (
                <div className="space-y-4 pt-6 border-t">
                  <h4 className="text-lg font-semibold">Review Application</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="reviewNotes">Review Notes (Optional)</Label>
                      <Textarea
                        id="reviewNotes"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Add any notes about this application..."
                        className="mt-1"
                      />
                    </div>

                    {reviewAction === 'reject' && (
                      <div>
                        <Label htmlFor="rejectionReason">Rejection Reason *</Label>
                        <Textarea
                          id="rejectionReason"
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Explain why this application is being rejected..."
                          className="mt-1"
                          required
                        />
                      </div>
                    )}

                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleReviewAction('approve')}
                        disabled={isReviewing}
                        className="flex-1"
                      >
                        {isReviewing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <ThumbsUp className="w-4 h-4 mr-2" />
                        )}
                        Approve Application
                      </Button>
                      
                      <Button
                        variant="destructive"
                        onClick={() => setReviewAction('reject')}
                        disabled={isReviewing}
                        className="flex-1"
                      >
                        <ThumbsDown className="w-4 h-4 mr-2" />
                        Reject Application
                      </Button>
                    </div>

                    {reviewAction === 'reject' && (
                      <Button
                        variant="destructive"
                        onClick={() => handleReviewAction('reject')}
                        disabled={isReviewing || !rejectionReason.trim()}
                        className="w-full"
                      >
                        {isReviewing ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <XCircle className="w-4 h-4 mr-2" />
                        )}
                        Confirm Rejection
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 