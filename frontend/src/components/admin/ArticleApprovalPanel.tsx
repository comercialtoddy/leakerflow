'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Eye, 
  Clock, 
  AlertCircle,
  Loader2,
  User
} from 'lucide-react';
import { adminApi } from '@/lib/api/admin';

interface PendingArticle {
  id: string;
  title: string;
  subtitle: string;
  author: string;
  category: string;
  submitted_for_approval_at: string;
  created_at: string;
  created_by_user_id: string;
  content: string;
}

export function ArticleApprovalPanel() {
  const queryClient = useQueryClient();
  const [selectedArticle, setSelectedArticle] = useState<PendingArticle | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  // Fetch pending articles
  const { 
    data: pendingArticles = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['admin', 'pending-articles'],
    queryFn: async () => {
      const response = await adminApi.getPendingArticles();
      if (response.error) {
        throw new Error(response.error);
      }
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Approve article mutation
  const approveMutation = useMutation({
    mutationFn: (articleId: string) => adminApi.approveArticle(articleId),
    onSuccess: (response) => {
      if (response.error) {
        toast.error(`Failed to approve article: ${response.error}`);
      } else {
        toast.success('Article approved and published successfully!');
        queryClient.invalidateQueries({ queryKey: ['admin', 'pending-articles'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'articles'] });
      }
    },
    onError: (error) => {
      toast.error(`Error approving article: ${error.message}`);
    },
  });

  // Reject article mutation
  const rejectMutation = useMutation({
    mutationFn: ({ articleId, reason }: { articleId: string; reason?: string }) => 
      adminApi.rejectArticle(articleId, reason),
    onSuccess: (response) => {
      if (response.error) {
        toast.error(`Failed to reject article: ${response.error}`);
      } else {
        toast.success('Article rejected and returned to draft');
        queryClient.invalidateQueries({ queryKey: ['admin', 'pending-articles'] });
        setIsRejectDialogOpen(false);
        setRejectionReason('');
        setSelectedArticle(null);
      }
    },
    onError: (error) => {
      toast.error(`Error rejecting article: ${error.message}`);
    },
  });

  const handleApprove = (articleId: string) => {
    approveMutation.mutate(articleId);
  };

  const handleReject = () => {
    if (selectedArticle) {
      rejectMutation.mutate({ 
        articleId: selectedArticle.id, 
        reason: rejectionReason.trim() || undefined 
      });
    }
  };

  const openRejectDialog = (article: PendingArticle) => {
    setSelectedArticle(article);
    setRejectionReason('');
    setIsRejectDialogOpen(true);
  };

  const openPreview = (article: PendingArticle) => {
    setSelectedArticle(article);
    setIsPreviewOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Article Approvals
          </CardTitle>
          <CardDescription>
            Articles submitted by authors waiting for admin approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading pending articles...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Error Loading Pending Articles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Failed to load pending articles. {error.message}
          </p>
          <Button 
            onClick={() => refetch()} 
            variant="outline" 
            className="mt-4"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Article Approvals
            {pendingArticles.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingArticles.length}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Articles submitted by authors waiting for admin approval
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingArticles.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium">No pending articles</h3>
              <p className="text-muted-foreground">
                All articles have been reviewed. Great job!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Author</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingArticles.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium">{article.title}</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {article.subtitle}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {article.author}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {article.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(article.submitted_for_approval_at), { 
                            addSuffix: true 
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openPreview(article)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleApprove(article.id)}
                            disabled={approveMutation.isPending}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => openRejectDialog(article)}
                            disabled={rejectMutation.isPending}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Article Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Article Preview</DialogTitle>
            <DialogDescription>
              Review the article before approving or rejecting
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 max-h-[80vh] overflow-y-auto">
            {selectedArticle && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {selectedArticle.category}
                    </Badge>
                    <Badge variant="outline">
                      Pending Approval
                    </Badge>
                  </div>
                  
                  <h1 className="text-3xl font-bold leading-tight">
                    {selectedArticle.title}
                  </h1>
                  
                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {selectedArticle.subtitle}
                  </p>
                  
                  <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                    <User className="h-8 w-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{selectedArticle.author}</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted {formatDistanceToNow(new Date(selectedArticle.submitted_for_approval_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="prose prose-lg dark:prose-invert max-w-none">
                  <div 
                    dangerouslySetInnerHTML={{ 
                      __html: selectedArticle.content
                        .replace(/\n\n/g, '</p><p>')
                        .replace(/\n/g, '<br>')
                        .replace(/^/, '<p>')
                        .replace(/$/, '</p>')
                        .replace(/<p><\/p>/g, '')
                    }} 
                  />
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={() => {
                      handleApprove(selectedArticle.id);
                      setIsPreviewOpen(false);
                    }}
                    disabled={approveMutation.isPending}
                    className="flex-1"
                  >
                    {approveMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve & Publish
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setIsPreviewOpen(false);
                      openRejectDialog(selectedArticle);
                    }}
                    disabled={rejectMutation.isPending}
                    className="flex-1"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Article</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this article (optional). The article will be returned to draft status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="rejection-reason">Reason for rejection (optional)</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this article is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setIsRejectDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
                className="flex-1"
              >
                {rejectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Reject Article'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 