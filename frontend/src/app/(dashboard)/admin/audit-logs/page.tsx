'use client';

import { useAdminUI } from '@/contexts/AdminContext';
import { AuditLogPanel } from '@/components/admin/AuditLogPanel';
import { motion } from 'motion/react';
import { Shield, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
            You don't have permission to access the audit logs.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Only global administrators can access audit logs. If you believe this is an error, please contact support.
          </p>
          <Link href="/admin">
            <Button variant="outline" className="w-full">
              Return to Admin Dashboard
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

function AuditLogPageContent() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-background p-6"
    >
      <div className="max-w-7xl mx-auto">
        <AuditLogPanel />
      </div>
    </motion.div>
  );
}

export default function AuditLogPage() {
  const { showAdminUI, isLoadingAdminStatus, hasAdminError } = useAdminUI();

  // Show loading state while checking admin status
  if (isLoadingAdminStatus) {
    return <AdminLoadingState />;
  }

  // Show access denied if not admin or error occurred
  if (!showAdminUI || hasAdminError) {
    return <AdminAccessDenied />;
  }

  // Show audit log panel for confirmed admins
  return <AuditLogPageContent />;
} 