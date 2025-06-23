'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowLeft,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useAdminUI } from '@/contexts/AdminContext';
import { ArticleModerationPanel } from '@/components/admin/ArticleModerationPanel';

export default function ArticleModerationPage() {
  const { showAdminUI, isLoadingAdminStatus } = useAdminUI();

  const handleArticleAction = (articleId: string, action: string) => {
    console.log(`Article ${articleId} action: ${action}`);
    // TODO: Implement actual API calls for article actions
    // This will be connected to the backend in future tasks
  };

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
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
          <h1 className="text-3xl font-bold tracking-tight">Article Moderation</h1>
          <p className="text-muted-foreground">
            Review and moderate all articles across the platform
          </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <ArticleModerationPanel onArticleAction={handleArticleAction} />
        </motion.div>
      </div>
    </div>
  );
} 