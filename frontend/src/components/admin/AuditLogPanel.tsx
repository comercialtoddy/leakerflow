'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  Search,
  Filter,
  Calendar,
  Clock,
  User,
  FileText,
  Eye,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download,
  SortAsc,
  SortDesc,
  Activity,
  AlertCircle,
  CheckCircle,
  XCircle,
  Settings,
  Trash2,
  Edit,
  Archive,
  UserCheck,
  UserX,
  Globe
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
import { adminApi, type AuditLogEntry } from '@/lib/api/admin';

// Mock data for development
const mockAuditLogs: AuditLogEntry[] = [
  {
    id: '1',
    action_by_user_id: 'admin-1',
    action_timestamp: '2024-12-21T10:30:00Z',
    action_type: 'article_deleted',
    target_entity_type: 'article',
    target_entity_id: 'article-123',
    justification: 'Article contained inappropriate content',
    details: {
      article_title: 'Controversial Tech Article',
      author_name: 'John Doe',
      author_email: 'john@example.com'
    },
    ip_address: '192.168.1.100',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    admin_name: 'Admin User',
    admin_email: 'admin@leakerflow.com'
  },
  {
    id: '2',
    action_by_user_id: 'admin-2',
    action_timestamp: '2024-12-21T09:15:00Z',
    action_type: 'application_approved',
    target_entity_type: 'application',
    target_entity_id: 'app-456',
    justification: 'Excellent writing samples and experience',
    details: {
      applicant_name: 'Sarah Chen',
      applicant_email: 'sarah@techwriter.com',
      expertise_areas: ['AI', 'Blockchain', 'Cybersecurity']
    },
    ip_address: '10.0.0.50',
    user_agent: 'Mozilla/5.0 (macOS; Intel Mac OS X 10_15_7)',
    admin_name: 'Senior Admin',
    admin_email: 'senior@leakerflow.com'
  }
];

const mockAdminUsers = [
  { id: 'admin-1', name: 'Admin User', email: 'admin@leakerflow.com' },
  { id: 'admin-2', name: 'Senior Admin', email: 'senior@leakerflow.com' }
];

const actionTypes = [
  'article_deleted',
  'article_updated', 
  'application_approved',
  'application_rejected',
  'user_admin_granted',
  'user_admin_revoked'
];

const entityTypes = ['article', 'application', 'user'];

type SortField = 'action_timestamp' | 'action_type' | 'target_entity_type' | 'admin_name';
type SortOrder = 'asc' | 'desc';

export function AuditLogPanel() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(mockAuditLogs);
  const [adminUsers, setAdminUsers] = useState(mockAdminUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [adminFilter, setAdminFilter] = useState<string>('all');
  const [actionTypeFilter, setActionTypeFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('action_timestamp');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getActionTypeBadge = (actionType: string) => {
    const variants = {
      article_deleted: 'destructive',
      article_updated: 'default',
      application_approved: 'default',
      application_rejected: 'destructive',
      user_admin_granted: 'default',
      user_admin_revoked: 'destructive'
    } as const;

    const icons = {
      article_deleted: Trash2,
      article_updated: Edit,
      application_approved: CheckCircle,
      application_rejected: XCircle,
      user_admin_granted: UserCheck,
      user_admin_revoked: UserX
    };

    const Icon = icons[actionType as keyof typeof icons] || Activity;

    return (
      <Badge variant={variants[actionType as keyof typeof variants] || 'secondary'}>
        <Icon className="w-3 h-3 mr-1" />
        {actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
      </Badge>
    );
  };

  const getEntityTypeBadge = (entityType: string) => {
    const variants = {
      article: 'default',
      application: 'secondary',
      user: 'outline'
    } as const;

    const icons = {
      article: FileText,
      application: User,
      user: User
    };

    const Icon = icons[entityType as keyof typeof icons] || Activity;

    return (
      <Badge variant={variants[entityType as keyof typeof variants] || 'outline'}>
        <Icon className="w-3 h-3 mr-1" />
        {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
      </Badge>
    );
  };

  const filteredAndSortedLogs = useMemo(() => {
    let filtered = auditLogs.filter(log => {
      const searchMatch = 
        (log.admin_name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.admin_email?.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.action_type.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.target_entity_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.justification?.toLowerCase().includes(searchTerm.toLowerCase()));

      const adminMatch = adminFilter === 'all' || log.action_by_user_id === adminFilter;
      const actionMatch = actionTypeFilter === 'all' || log.action_type === actionTypeFilter;
      const entityMatch = entityTypeFilter === 'all' || log.target_entity_type === entityTypeFilter;

      let dateMatch = true;
      if (dateFrom) {
        dateMatch = dateMatch && new Date(log.action_timestamp) >= new Date(dateFrom);
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        dateMatch = dateMatch && new Date(log.action_timestamp) <= toDate;
      }

      return searchMatch && adminMatch && actionMatch && entityMatch && dateMatch;
    });

    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      if (sortField === 'action_timestamp') {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [auditLogs, searchTerm, adminFilter, actionTypeFilter, entityTypeFilter, dateFrom, dateTo, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedLogs.length / itemsPerPage);
  const paginatedLogs = filteredAndSortedLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleViewLog = async (log: AuditLogEntry) => {
    setSelectedLog(log);
    setShowLogDialog(true);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setAdminFilter('all');
    setActionTypeFilter('all');
    setEntityTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setSortField('action_timestamp');
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
              <Shield className="h-8 w-8" />
              Audit Logs
            </h2>
            <p className="text-muted-foreground">
              Monitor and review all administrative actions and system activities
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" disabled={isLoading}>
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
                <p className="text-sm font-medium text-muted-foreground">Total Actions</p>
                <p className="text-2xl font-bold">{auditLogs.length}</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Actions</p>
                <p className="text-2xl font-bold">
                  {auditLogs.filter(log => 
                    new Date(log.action_timestamp).toDateString() === new Date().toDateString()
                  ).length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Article Actions</p>
                <p className="text-2xl font-bold">
                  {auditLogs.filter(log => log.target_entity_type === 'article').length}
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-600 ml-auto" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">User Actions</p>
                <p className="text-2xl font-bold">
                  {auditLogs.filter(log => log.target_entity_type === 'user').length}
                </p>
              </div>
              <User className="h-8 w-8 text-purple-600 ml-auto" />
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
                <Label htmlFor="search">Search Logs</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Admin, action, entity..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-filter">Admin User</Label>
                <Select value={adminFilter} onValueChange={setAdminFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All admins" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Admins</SelectItem>
                    {adminUsers.map(admin => (
                      <SelectItem key={admin.id} value={admin.id}>
                        {admin.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="action-filter">Action Type</Label>
                <Select value={actionTypeFilter} onValueChange={setActionTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    {actionTypes.map(action => (
                      <SelectItem key={action} value={action}>
                        {action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="entity-filter">Entity Type</Label>
                <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All entities" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Entities</SelectItem>
                    {entityTypes.map(entity => (
                      <SelectItem key={entity} value={entity}>
                        {entity.charAt(0).toUpperCase() + entity.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date-from">Date From</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-to">Date To</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear All Filters
              </Button>
              <Badge variant="secondary" className="h-6">
                {filteredAndSortedLogs.length} result{filteredAndSortedLogs.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Audit Logs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Audit Logs ({filteredAndSortedLogs.length})</CardTitle>
            <CardDescription>
              Complete history of administrative actions and system activities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton field="action_timestamp">Timestamp</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="admin_name">Admin User</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="action_type">Action Type</SortButton>
                    </TableHead>
                    <TableHead>
                      <SortButton field="target_entity_type">Entity</SortButton>
                    </TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Justification</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence mode="wait">
                    {paginatedLogs.map((log, index) => (
                      <motion.tr
                        key={log.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3, delay: index * 0.05 }}
                        className="group hover:bg-muted/50"
                      >
                        <TableCell>
                          <div className="flex items-center space-x-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="text-sm font-medium">{formatDate(log.action_timestamp)}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(log.action_timestamp).toLocaleTimeString('en-US', { 
                                  hour: '2-digit', 
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
                              {(log.admin_name || log.action_by_user_id).substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-sm">{log.admin_name || 'Unknown Admin'}</div>
                              <div className="text-xs text-muted-foreground">{log.admin_email || log.action_by_user_id}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getActionTypeBadge(log.action_type)}
                        </TableCell>
                        <TableCell>
                          {getEntityTypeBadge(log.target_entity_type)}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {log.target_entity_id}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-xs truncate text-sm">
                            {log.justification || 'No justification provided'}
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
                              <DropdownMenuItem onClick={() => handleViewLog(log)}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
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
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
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

      {/* Audit Log Details Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Shield className="h-6 w-6" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Complete information about this administrative action
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Action Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Timestamp</span>
                        <span className="text-sm">{formatDateTime(selectedLog.action_timestamp)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Action Type</span>
                        {getActionTypeBadge(selectedLog.action_type)}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Entity Type</span>
                        {getEntityTypeBadge(selectedLog.target_entity_type)}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Entity ID</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {selectedLog.target_entity_id}
                        </code>
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <Label className="text-sm font-medium">Justification</Label>
                      <p className="text-sm text-muted-foreground mt-1 p-3 bg-muted rounded-lg">
                        {selectedLog.justification || 'No justification provided'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Admin & Security</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                        {(selectedLog.admin_name || selectedLog.action_by_user_id).substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{selectedLog.admin_name || 'Unknown Admin'}</h3>
                        <p className="text-muted-foreground text-sm">{selectedLog.admin_email || selectedLog.action_by_user_id}</p>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      {selectedLog.ip_address && (
                        <div className="flex justify-between">
                          <span className="text-sm font-medium text-muted-foreground">IP Address</span>
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {selectedLog.ip_address}
                          </code>
                        </div>
                      )}
                      {selectedLog.user_agent && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">User Agent</Label>
                          <p className="text-xs text-muted-foreground mt-1 break-all">
                            {selectedLog.user_agent}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {selectedLog.details && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Action Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm bg-muted p-4 rounded-lg overflow-auto max-h-64">
                      {JSON.stringify(selectedLog.details, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 