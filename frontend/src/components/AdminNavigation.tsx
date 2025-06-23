'use client';

import React from 'react';
import Link from 'next/link';
import { useAdminUI, useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Users, 
  FileText, 
  UserCheck, 
  BarChart3,
  AlertTriangle,
  Crown,
  Shield
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AdminNavigationProps {
  className?: string;
}

export function AdminNavigation({ className }: AdminNavigationProps) {
  const { showAdminUI, isLoadingAdminStatus, hasAdminError } = useAdminUI();
  const { isAdmin, error } = useAdmin();

  // Show loading state during admin status check
  if (isLoadingAdminStatus) {
    return (
      <div className={className}>
        <Badge variant="outline" className="animate-pulse">
          <Crown className="w-3 h-3 mr-1" />
          Checking...
        </Badge>
      </div>
    );
  }

  // Show error state if admin check failed
  if (hasAdminError) {
    return (
      <div className={className}>
        <Badge variant="destructive" className="opacity-50">
          <AlertTriangle className="w-3 h-3 mr-1" />
          Admin Error
        </Badge>
      </div>
    );
  }

  // Only show admin navigation if user is confirmed admin
  if (!showAdminUI) {
    return null;
  }

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Admin Panel</span>
            <Badge variant="secondary" className="ml-1">
              Global
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <Crown className="w-4 h-4 text-amber-500" />
            Administration
          </DropdownMenuLabel>
          
          <DropdownMenuSeparator />
          
          {/* Dashboard */}
          <DropdownMenuItem asChild>
            <Link href="/admin/dashboard" className="flex items-center gap-2 cursor-pointer">
              <BarChart3 className="w-4 h-4" />
              Dashboard
            </Link>
          </DropdownMenuItem>
          
          {/* Analytics */}
          <DropdownMenuItem asChild>
            <Link href="/admin/analytics" className="flex items-center gap-2 cursor-pointer">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Link>
          </DropdownMenuItem>
          
          {/* User Management */}
          <DropdownMenuItem asChild>
            <Link href="/admin/users" className="flex items-center gap-2 cursor-pointer">
              <Users className="w-4 h-4" />
              User Management
            </Link>
          </DropdownMenuItem>
          
          {/* Content Moderation */}
          <DropdownMenuItem asChild>
            <Link href="/admin/articles" className="flex items-center gap-2 cursor-pointer">
              <FileText className="w-4 h-4" />
              Content Moderation
            </Link>
          </DropdownMenuItem>
          
          {/* Author Applications */}
          <DropdownMenuItem asChild>
            <Link href="/admin/applications" className="flex items-center gap-2 cursor-pointer">
              <UserCheck className="w-4 h-4" />
              Author Applications
            </Link>
          </DropdownMenuItem>
          
          {/* Audit Logs */}
          <DropdownMenuItem asChild>
            <Link href="/admin/audit-logs" className="flex items-center gap-2 cursor-pointer">
              <Shield className="w-4 h-4" />
              Audit Logs
            </Link>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          {/* System Settings */}
          <DropdownMenuItem asChild>
            <Link href="/admin/settings" className="flex items-center gap-2 cursor-pointer">
              <Settings className="w-4 h-4" />
              System Settings
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Simple inline admin badge component for quick status display
export function AdminStatusBadge({ className }: { className?: string }) {
  const { isAdmin, isLoading, isError } = useAdmin();

  if (isLoading) {
    return (
      <Badge variant="outline" className={`animate-pulse ${className}`}>
        <Crown className="w-3 h-3 mr-1" />
        ...
      </Badge>
    );
  }

  if (isError) {
    return (
      <Badge variant="destructive" className={`opacity-50 ${className}`}>
        <AlertTriangle className="w-3 h-3 mr-1" />
        Error
      </Badge>
    );
  }

  if (isAdmin) {
    return (
      <Badge variant="default" className={`bg-amber-500 hover:bg-amber-600 ${className}`}>
        <Crown className="w-3 h-3 mr-1" />
        Global Admin
      </Badge>
    );
  }

  return null;
}

// Hook for conditional admin content
export function AdminOnlyContent({ 
  children, 
  fallback = null 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}) {
  const { showAdminUI } = useAdminUI();
  
  return showAdminUI ? <>{children}</> : <>{fallback}</>;
}

// Hook for conditional admin actions
export function AdminOnlyAction({ 
  children, 
  fallback,
  loadingText = "Checking permissions..." 
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
  loadingText?: string;
}) {
  const { showAdminUI, isLoadingAdminStatus } = useAdminUI();
  
  if (isLoadingAdminStatus) {
    return (
      <div className="text-sm text-muted-foreground">
        {loadingText}
      </div>
    );
  }
  
  return showAdminUI ? <>{children}</> : <>{fallback}</>;
} 