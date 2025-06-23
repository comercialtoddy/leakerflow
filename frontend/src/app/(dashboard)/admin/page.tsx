'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Shield, 
  Users, 
  FileText, 
  UserCheck, 
  BarChart3, 
  Settings,
  Crown,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import Link from 'next/link';
import { useAdminUI } from '@/contexts/AdminContext';

// Mock admin stats for now (this will be replaced with real API calls later)
const mockAdminStats = {
  total_articles: 147,
  total_applications: 23,
  total_users: 1284,
  total_accounts: 456,
  pending_applications: 8,
  approved_applications: 12,
  rejected_applications: 3,
  recent_activity: [
    { id: 1, type: 'application', action: 'New author application', time: '2 minutes ago' },
    { id: 2, type: 'article', action: 'Article published', time: '15 minutes ago' },
    { id: 3, type: 'user', action: 'New user registration', time: '1 hour ago' },
    { id: 4, type: 'moderation', action: 'Article flagged for review', time: '2 hours ago' },
  ]
};

function AdminAccessDenied() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Access Denied</CardTitle>
          <CardDescription>
            You don't have permission to access the admin dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Only global administrators can access this area. If you believe this is an error, please contact support.
          </p>
          <Link href="/dashboard">
            <Button variant="outline" className="w-full">
              Return to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminLoadingState() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <h3 className="text-lg font-medium mb-2">Verifying Access</h3>
          <p className="text-muted-foreground text-center">
            Checking admin permissions...
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function AdminDashboardContent() {
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');

  // Navigation items for the admin dashboard
  const adminNavigation = [
    {
      title: 'Content Moderation',
      description: 'Review and manage all articles across the platform',
      href: '/admin/articles',
      icon: FileText,
      count: mockAdminStats.total_articles,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900/20'
    },
    {
      title: 'Author Applications',
      description: 'Review and approve author applications',
      href: '/admin/applications',
      icon: UserCheck,
      count: mockAdminStats.pending_applications,
      color: 'text-amber-600',
      bgColor: 'bg-amber-100 dark:bg-amber-900/20',
      badge: mockAdminStats.pending_applications > 0 ? 'Pending' : null
    },
    {
      title: 'User Management',
      description: 'Manage users and administrative privileges',
      href: '/admin/users',
      icon: Users,
      count: mockAdminStats.total_users,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900/20'
    },
    {
      title: 'Analytics Dashboard',
      description: 'View comprehensive platform metrics and trends',
      href: '/admin/analytics',
      icon: BarChart3,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-100 dark:bg-cyan-900/20'
    },
    {
      title: 'Audit Logs',
      description: 'Monitor and review all administrative actions',
      href: '/admin/audit-logs',
      icon: Activity,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/20'
    },
    {
      title: 'System Settings',
      description: 'Configure platform settings and preferences',
      href: '/admin/settings',
      icon: Settings,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900/20'
    }
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
                <p className="text-muted-foreground">
                  Global administrator panel for Leaker-Flow
                </p>
              </div>
            </div>
            <Badge variant="default" className="bg-amber-500 hover:bg-amber-600">
              <Crown className="w-3 h-3 mr-1" />
              Global Administrator
            </Badge>
          </div>
          <div className="flex gap-3">
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value)}
              className="px-3 py-2 border border-input rounded-md bg-background text-sm"
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
            </select>
            <Button variant="outline">
              <BarChart3 className="mr-2 h-4 w-4" />
              Full Analytics
            </Button>
          </div>
        </motion.div>

        {/* Quick Stats */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockAdminStats.total_articles}</div>
              <p className="text-xs text-muted-foreground">
                Across all accounts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Applications</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{mockAdminStats.pending_applications}</div>
              <p className="text-xs text-muted-foreground">
                Need review
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockAdminStats.total_users}</div>
              <p className="text-xs text-muted-foreground">
                Registered accounts
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mockAdminStats.total_accounts}</div>
              <p className="text-xs text-muted-foreground">
                Multi-tenant accounts
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Admin Navigation Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"
        >
          {adminNavigation.map((item, index) => (
            <Link key={item.href} href={item.href}>
              <Card className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-2 hover:border-primary/20">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-full ${item.bgColor} flex items-center justify-center`}>
                        <item.icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">
                          {item.title}
                        </CardTitle>
                        <CardDescription className="text-sm">
                          {item.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="text-right">
                      {item.count !== undefined && (
                        <div className="text-2xl font-bold text-muted-foreground">
                          {item.count}
                        </div>
                      )}
                      {item.badge && (
                        <Badge variant="secondary" className="mt-1">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </motion.div>

        {/* Recent Activity */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid gap-6 lg:grid-cols-2"
        >
          {/* Application Status Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
              <CardDescription>
                Author application review status
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-sm">Pending Review</span>
                </div>
                <Badge variant="secondary">{mockAdminStats.pending_applications}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Approved</span>
                </div>
                <Badge variant="outline">{mockAdminStats.approved_applications}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">Rejected</span>
                </div>
                <Badge variant="outline">{mockAdminStats.rejected_applications}</Badge>
              </div>
              {mockAdminStats.pending_applications > 0 && (
                <div className="pt-4 border-t">
                  <Link href="/admin/applications">
                    <Button size="sm" className="w-full">
                      Review Applications
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest platform activity and moderation events
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {mockAdminStats.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 text-sm">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="font-medium">{activity.action}</p>
                    <p className="text-muted-foreground text-xs">{activity.time}</p>
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t">
                <Link href="/admin/audit-logs">
                  <Button variant="outline" size="sm" className="w-full">
                    View All Activity
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { showAdminUI, isLoadingAdminStatus, hasAdminError } = useAdminUI();

  // Show loading state while checking admin status
  if (isLoadingAdminStatus) {
    return <AdminLoadingState />;
  }

  // Show access denied if not admin or error occurred
  if (!showAdminUI || hasAdminError) {
    return <AdminAccessDenied />;
  }

  // Show admin dashboard for confirmed admins
  return <AdminDashboardContent />;
} 