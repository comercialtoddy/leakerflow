'use client';

import { Users, Clock, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAdminStats } from '@/hooks/use-admin-stats';

export function ApplicationStatsCards() {
  const { stats, isLoading, error } = useAdminStats();

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-destructive">
              <p className="text-sm">Error loading stats</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Applications */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              stats.total
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            All author applications
          </p>
        </CardContent>
      </Card>

      {/* Pending Review */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-amber-600">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              stats.pending + stats.under_review
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Awaiting admin review
          </p>
        </CardContent>
      </Card>

      {/* Approved */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Approved</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              stats.approved
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Authors approved
          </p>
        </CardContent>
      </Card>

      {/* Rejected */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rejected</CardTitle>
          <XCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              stats.rejected
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Applications rejected
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 