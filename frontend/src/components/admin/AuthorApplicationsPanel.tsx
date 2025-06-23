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
import { adminApi } from '@/lib/api/admin';

// Mock data for development - replace with actual API calls
const mockApplications = [
  {
    id: 1,
    fullName: 'Sarah Chen',
    email: 'sarah.chen@techwriter.com',
    status: 'pending',
    submittedAt: '2024-01-15',
    bio: 'Experienced technology journalist with 8+ years covering AI, blockchain, and cybersecurity. Former senior writer at TechCrunch and Wired.',
    expertiseAreas: ['Artificial Intelligence', 'Blockchain', 'Cybersecurity', 'Fintech'],
    portfolioUrl: 'https://sarahchen.dev',
    sampleArticles: [
      'https://techcrunch.com/ai-revolution-2024',
      'https://wired.com/blockchain-security-analysis',
      'https://medium.com/@sarahchen/cybersecurity-trends'
    ],
    motivation: 'I want to contribute to the platform by sharing insights on emerging technologies and helping readers understand complex tech concepts through clear, engaging content.',
    socialMedia: {
      twitter: '@sarahchen_tech',
      linkedin: 'sarah-chen-journalist'
    },
    previousExperience: 'Senior Tech Writer at TechCrunch (2020-2024), Staff Writer at Wired (2018-2020)',
    education: 'MS Computer Science, Stanford University',
    writingSamples: 3,
    averageViews: 25000,
    reviewedBy: null,
    rejectionReason: null
  },
  {
    id: 2,
    fullName: 'Marcus Rodriguez',
    email: 'marcus.r@freelance.com',
    status: 'under_review',
    submittedAt: '2024-01-10',
    bio: 'Freelance technology writer specializing in emerging tech trends, startup coverage, and developer tools.',
    expertiseAreas: ['Startups', 'Developer Tools', 'Cloud Computing', 'Mobile Tech'],
    portfolioUrl: 'https://marcusrodriguez.io',
    sampleArticles: [
      'https://techblog.com/startup-trends-2024',
      'https://devtools.com/cloud-native-development'
    ],
    motivation: 'I have been following tech startups for 5 years and want to share my insights about the startup ecosystem and emerging developer tools.',
    socialMedia: {
      twitter: '@marcus_tech_writer',
      linkedin: 'marcus-rodriguez-tech'
    },
    previousExperience: 'Freelance Tech Writer (2019-present), Contributing Writer at The Next Web',
    education: 'BA Journalism, University of California',
    writingSamples: 2,
    averageViews: 15000,
    reviewedBy: 'admin-1',
    rejectionReason: null
  },
  {
    id: 3,
    fullName: 'Elena Kowalski',
    email: 'elena.k@techanalyst.com',
    status: 'approved',
    submittedAt: '2024-01-05',
    reviewedAt: '2024-01-08',
    bio: 'Technology analyst and content creator focusing on enterprise software, SaaS platforms, and digital transformation.',
    expertiseAreas: ['Enterprise Software', 'SaaS', 'Digital Transformation', 'Business Tech'],
    portfolioUrl: 'https://elenakowalski.com',
    sampleArticles: [
      'https://enterprise-tech.com/saas-evolution',
      'https://digital-transform.com/enterprise-adoption',
      'https://business-tech.com/remote-work-tools'
    ],
    motivation: 'I want to help business leaders understand how to leverage technology for growth and transformation.',
    socialMedia: {
      twitter: '@elena_techanalyst',
      linkedin: 'elena-kowalski-analyst'
    },
    previousExperience: 'Senior Analyst at Gartner (2017-2023), Tech Consultant',
    education: 'MBA Technology Management, MIT Sloan',
    writingSamples: 3,
    averageViews: 30000,
    reviewedBy: 'admin-2',
    rejectionReason: null
  },
  {
    id: 4,
    fullName: 'David Thompson',
    email: 'david.t@contentcreator.com',
    status: 'rejected',
    submittedAt: '2024-01-01',
    reviewedAt: '2024-01-03',
    bio: 'Content creator and blogger covering general technology topics and product reviews.',
    expertiseAreas: ['Product Reviews', 'Consumer Tech', 'Gadgets'],
    portfolioUrl: 'https://davidthompson.blog',
    sampleArticles: [
      'https://techblog.com/iphone-review',
      'https://gadgetreview.com/laptop-comparison'
    ],
    motivation: 'I love technology and want to share my thoughts on the latest gadgets and products.',
    socialMedia: {
      twitter: '@david_tech_blog'
    },
    previousExperience: 'Tech Blogger (2022-present)',
    education: 'High School Diploma',
    writingSamples: 2,
    averageViews: 5000,
    reviewedBy: 'admin-1',
    rejectionReason: 'Content quality does not meet our editorial standards. Writing samples lack depth and technical expertise.'
  },
  {
    id: 5,
    fullName: 'Ashi Patel',
    email: 'ashi.patel@techwriter.in',
    status: 'pending',
    submittedAt: '2024-01-12',
    bio: 'International technology correspondent covering the global tech ecosystem, with expertise in emerging markets and tech policy.',
    expertiseAreas: ['Tech Policy', 'Emerging Markets', 'International Tech', 'Regulations'],
    portfolioUrl: 'https://ashipatel.com',
    sampleArticles: [
      'https://techpolicy.com/india-digital-transformation',
      'https://emerging-markets.com/fintech-adoption',
      'https://global-tech.com/regulatory-landscape'
    ],
    motivation: 'I want to provide a global perspective on technology trends and help readers understand how tech policies affect different markets.',
    socialMedia: {
      twitter: '@ashi_global_tech',
      linkedin: 'ashi-patel-tech-correspondent'
    },
    previousExperience: 'Tech Correspondent at Reuters (2019-2024), Policy Analyst at Tech Freedom',
    education: 'MA International Relations, London School of Economics',
    writingSamples: 3,
    averageViews: 20000,
    reviewedBy: null,
    rejectionReason: null
  }
] as Application[];

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

type SortField = 'fullName' | 'email' | 'submittedAt' | 'status' | 'averageViews' | 'writingSamples';
type SortOrder = 'asc' | 'desc';

export function AuthorApplicationsPanel() {
  // State management
  const [applications] = useState<Application[]>(mockApplications);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [showApplicationDialog, setShowApplicationDialog] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
    let filtered = applications.filter(application => {
      // Text search
      const searchMatch = 
        application.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        application.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        application.expertiseAreas.some(area => area.toLowerCase().includes(searchTerm.toLowerCase()));

      // Status filter
      const statusMatch = statusFilter === 'all' || application.status === statusFilter;

      return searchMatch && statusMatch;
    });

    // Sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle date fields
      if (sortField === 'submittedAt') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [applications, searchTerm, statusFilter, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedApplications.length / itemsPerPage);
  const paginatedApplications = filteredAndSortedApplications.slice(
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

  const handleViewApplication = (application: Application) => {
    setSelectedApplication(application);
    setShowApplicationDialog(true);
  };

  const handleReviewAction = async (action: 'approve' | 'reject', applicationId: number) => {
    setIsLoading(true);
    try {
      let result;
      
      if (action === 'approve') {
        // For approval, we need review notes from the existing rejectionReason state
        // (we'll reuse this field for review notes in both cases)
        const reviewNotes = rejectionReason.trim();
        if (!reviewNotes) {
          console.error('Review notes are required for approval');
          return;
        }
        result = await adminApi.approveApplication(applicationId.toString(), reviewNotes);
      } else {
        // For rejection, review notes are mandatory
        const reviewNotes = rejectionReason.trim();
        if (!reviewNotes) {
          console.error('Review notes are required for rejection');
          return;
        }
        result = await adminApi.rejectApplication(applicationId.toString(), reviewNotes);
      }
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log(`Successfully ${action}ed application:`, result.data);
      
      // Reset form and close dialog
      setReviewAction(null);
      setRejectionReason('');
      setShowApplicationDialog(false);
      
      // In a real implementation, you'd refresh the applications list
      // For now, just show success message
      console.log(`Application ${action}ed successfully!`);
      
    } catch (error) {
      console.error(`Error ${action}ing application:`, error);
      console.log(`Failed to ${action} application: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setSortField('submittedAt');
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
              <UserCheck className="h-8 w-8" />
              Author Applications
            </h2>
            <p className="text-muted-foreground">
              Review and manage pending author applications
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
                <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                <p className="text-2xl font-bold">{applications.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{applications.filter(a => a.status === 'pending').length}</p>
              </div>
              <Clock className="h-8 w-8 text-amber-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold">{applications.filter(a => a.status === 'approved').length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{applications.filter(a => a.status === 'rejected').length}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600 ml-auto" />
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
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="search">Search Applications</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Name, email, expertise..."
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
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="under_review">Under Review</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 flex items-end">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
                <Badge variant="secondary" className="h-6 ml-2">
                  {filteredAndSortedApplications.length} result{filteredAndSortedApplications.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Applications Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Applications ({filteredAndSortedApplications.length})</CardTitle>
            <CardDescription>
              Review and manage author application requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">
                      <SortButton field="fullName">Applicant</SortButton>
                    </TableHead>
                    <TableHead>Expertise Areas</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <SortButton field="writingSamples">Samples</SortButton>
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton field="averageViews">Avg Views</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="submittedAt">Submitted</SortButton>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="wait">
                    {paginatedApplications.map((application, index) => (
                      <motion.tr
                        key={application.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm">
                              {application.fullName.split(' ').map(n => n[0]).join('')}
                            </div>
                            <div>
                              <div className="font-medium">{application.fullName}</div>
                              <div className="text-sm text-muted-foreground flex items-center">
                                <Mail className="h-3 w-3 mr-1" />
                                {application.email}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {application.expertiseAreas.slice(0, 2).map((area, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {area}
                              </Badge>
                            ))}
                            {application.expertiseAreas.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{application.expertiseAreas.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(application.status)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{application.writingSamples}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Eye className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{application.averageViews.toLocaleString()}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{formatDate(application.submittedAt)}</span>
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
                              <DropdownMenuItem onClick={() => handleViewApplication(application)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Review Application
                              </DropdownMenuItem>
                              {(application.status === 'pending' || application.status === 'under_review') && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleReviewAction('approve', application.id)}
                                    className="text-green-600"
                                  >
                                    <ThumbsUp className="mr-2 h-4 w-4" />
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
                                    <ThumbsDown className="mr-2 h-4 w-4" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
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

      {/* Application Review Dialog */}
      <Dialog open={showApplicationDialog} onOpenChange={setShowApplicationDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <UserCheck className="h-6 w-6" />
              Application Review: {selectedApplication?.fullName}
            </DialogTitle>
            <DialogDescription>
              Complete application details and review options
            </DialogDescription>
          </DialogHeader>

          {selectedApplication && (
            <div className="space-y-6">
              {/* Applicant Profile */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Applicant Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center text-white font-bold text-xl">
                        {selectedApplication.fullName.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold">{selectedApplication.fullName}</h3>
                        <p className="text-muted-foreground flex items-center">
                          <Mail className="h-4 w-4 mr-1" />
                          {selectedApplication.email}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          {getStatusBadge(selectedApplication.status)}
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div>
                        <Label className="text-sm font-medium">Bio</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedApplication.bio}</p>
                      </div>
                      
                      <div>
                        <Label className="text-sm font-medium">Education</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedApplication.education}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Previous Experience</Label>
                        <p className="text-sm text-muted-foreground mt-1">{selectedApplication.previousExperience}</p>
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Expertise Areas</Label>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {selectedApplication.expertiseAreas.map((area, idx) => (
                            <Badge key={idx} variant="outline">
                              {area}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      {(selectedApplication.socialMedia.twitter || selectedApplication.socialMedia.linkedin) && (
                        <div>
                          <Label className="text-sm font-medium">Social Media</Label>
                          <div className="space-y-2 mt-2">
                            {selectedApplication.socialMedia.twitter && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground">Twitter:</span>
                                <span className="text-sm">{selectedApplication.socialMedia.twitter}</span>
                              </div>
                            )}
                            {selectedApplication.socialMedia.linkedin && (
                              <div className="flex items-center space-x-2">
                                <span className="text-sm text-muted-foreground">LinkedIn:</span>
                                <span className="text-sm">{selectedApplication.socialMedia.linkedin}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Portfolio & Work</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="text-sm font-medium">Portfolio URL</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={selectedApplication.portfolioUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline flex items-center"
                        >
                          {selectedApplication.portfolioUrl}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Sample Articles</Label>
                      <div className="space-y-2 mt-2">
                        {selectedApplication.sampleArticles.map((article, idx) => (
                          <a 
                            key={idx}
                            href={article} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center"
                          >
                            <FileText className="h-3 w-3 mr-2" />
                            {article}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </a>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 grid-cols-2">
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <FileText className="h-6 w-6 mx-auto text-blue-600 mb-2" />
                        <div className="text-xl font-bold">{selectedApplication.writingSamples}</div>
                        <div className="text-sm text-muted-foreground">Writing Samples</div>
                      </div>
                      <div className="text-center p-4 bg-muted rounded-lg">
                        <Eye className="h-6 w-6 mx-auto text-green-600 mb-2" />
                        <div className="text-xl font-bold">{selectedApplication.averageViews.toLocaleString()}</div>
                        <div className="text-sm text-muted-foreground">Average Views</div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Motivation</Label>
                      <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted rounded-lg">
                        {selectedApplication.motivation}
                      </p>
                    </div>

                    {selectedApplication.rejectionReason && (
                      <div>
                        <Label className="text-sm font-medium text-red-600">Rejection Reason</Label>
                        <p className="text-sm text-muted-foreground mt-1 p-3 bg-red-50 rounded-lg border border-red-200">
                          {selectedApplication.rejectionReason}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Review Actions */}
              {reviewAction && (
                <Card>
                  <CardHeader>
                    <CardTitle className={`text-lg ${reviewAction === 'reject' ? 'text-red-600' : 'text-green-600'}`}>
                      {reviewAction === 'reject' ? 'Rejection Review' : 'Approval Review'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="review-notes" className="text-sm font-medium">
                          Review Notes <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          id="review-notes"
                          placeholder={`Please provide detailed ${reviewAction === 'reject' ? 'rejection' : 'approval'} notes (required)...`}
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          className="min-h-[100px] mt-1"
                        />
                        <p className="text-sm text-muted-foreground mt-1">
                          These notes will be included in the email notification to the applicant.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-2 pt-4 border-t">
                {(selectedApplication.status === 'pending' || selectedApplication.status === 'under_review') && !reviewAction && (
                  <>
                    <Button 
                      onClick={() => setReviewAction('approve')}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={isLoading}
                    >
                      <ThumbsUp className="mr-2 h-4 w-4" />
                      Approve Application
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setReviewAction('reject')}
                      className="text-red-600 hover:text-red-700"
                      disabled={isLoading}
                    >
                      <ThumbsDown className="mr-2 h-4 w-4" />
                      Reject Application
                    </Button>
                  </>
                )}
                
                {reviewAction && (
                  <>
                    <Button 
                      onClick={() => handleReviewAction(reviewAction, selectedApplication.id)}
                      className={reviewAction === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                      variant={reviewAction === 'reject' ? 'destructive' : 'default'}
                      disabled={!rejectionReason.trim() || isLoading}
                    >
                      {isLoading ? (
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      ) : reviewAction === 'approve' ? (
                        <ThumbsUp className="mr-2 h-4 w-4" />
                      ) : (
                        <ThumbsDown className="mr-2 h-4 w-4" />
                      )}
                      {reviewAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => {
                        setReviewAction(null);
                        setRejectionReason('');
                      }}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </>
                )}

                <Button 
                  variant="outline"
                  onClick={() => window.open(selectedApplication.portfolioUrl, '_blank')}
                >
                  <Globe className="mr-2 h-4 w-4" />
                  View Portfolio
                </Button>
                
                <Button 
                  variant="outline"
                  onClick={() => window.open(`mailto:${selectedApplication.email}`, '_blank')}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Send Email
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 