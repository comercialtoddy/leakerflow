'use client';

import { motion } from 'motion/react';
import { 
  Settings,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Card,
  CardContent,
} from '@/components/ui/card';
import Link from 'next/link';
import { useAdminUI } from '@/contexts/AdminContext';

export default function SystemSettingsPage() {
  const { showAdminUI, isLoadingAdminStatus } = useAdminUI();

  if (isLoadingAdminStatus) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div>Loading...</div>
      </div>
    );
  }

  if (!showAdminUI) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div>Access Denied</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <Link href="/admin">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
          <p className="text-muted-foreground">
            Configure platform settings and preferences
          </p>
        </motion.div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-24">
            <Settings className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">System Settings Panel</h3>
            <p className="text-muted-foreground text-center max-w-md">
              This feature will allow administrators to configure platform-wide settings, email templates, security policies, and other system preferences.
            </p>
            <Button className="mt-6" disabled>
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 