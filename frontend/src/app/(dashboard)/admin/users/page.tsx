'use client';

import { motion } from 'motion/react';
import { 
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAdminUI } from '@/contexts/AdminContext';
import { AuthorManagementPanel } from '@/components/admin/AuthorManagementPanel';

export default function UserManagementPage() {
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
        </motion.div>

        <AuthorManagementPanel />
      </div>
    </div>
  );
} 