"use client";

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Clock, FileText, User, Link as LinkIcon, Lightbulb } from 'lucide-react';

// Validation schema using Zod
const schema = z.object({
  fullName: z.string().min(1, 'Full name is required').min(2, 'Full name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  bio: z.string().optional(),
  writingExperience: z.string().optional(),
  portfolioLinks: z.string().optional(),
  motivation: z.string().min(1, 'Motivation is required').min(10, 'Please provide more detail about your motivation')
});

type FormData = z.infer<typeof schema>;

interface ApplicationStatus {
  hasApplication: boolean;
  status?: 'pending' | 'approved' | 'rejected' | 'under_review';
  submittedAt?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  rejectionReason?: string;
  canResubmit?: boolean;
}

export default function AuthorApplicationsPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);

  const { 
    register, 
    handleSubmit, 
    formState: { errors, isValid },
    reset 
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange'
  });

  // Check existing application status on component mount
  React.useEffect(() => {
    checkApplicationStatus();
  }, []);

  const checkApplicationStatus = async () => {
    try {
      // TODO: Replace with actual API call to check user's application status
      // const response = await fetch('/api/author-applications/status');
      // const data = await response.json();
      // setApplicationStatus(data);
      
      // Mock data for now - remove when API is connected
      setApplicationStatus({
        hasApplication: false,
        canResubmit: true
      });
    } catch (error) {
      console.error('Error checking application status:', error);
    }
  };

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    setSubmitStatus(null);
    setErrorMessage('');

    try {
      // Convert portfolio links to array if provided
      const portfolioLinksArray = data.portfolioLinks 
        ? data.portfolioLinks.split('\n').map(link => link.trim()).filter(link => link.length > 0)
        : [];

      const submitData = {
        ...data,
        portfolioLinks: portfolioLinksArray
      };

      // TODO: Replace with actual API call
      // const response = await fetch('/api/author-applications', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(submitData)
      // });

      // if (!response.ok) {
      //   throw new Error('Failed to submit application');
      // }

      // Mock successful submission for now
      console.log('Application submitted:', submitData);
      
      setSubmitStatus('success');
      reset();
      
      // Refresh application status
      setTimeout(() => {
        checkApplicationStatus();
      }, 1000);

    } catch (error: any) {
      setSubmitStatus('error');
      setErrorMessage(error.message || 'Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'rejected':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'under_review':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Clock className="h-5 w-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'under_review':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    }
  };

  // Show existing application status if user has one
  if (applicationStatus?.hasApplication && !applicationStatus?.canResubmit) {
    return (
      <div className="container mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Your Author Application
            </CardTitle>
            <CardDescription>
              You have already submitted an application to become an author.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              {getStatusIcon(applicationStatus.status || 'pending')}
              <Badge className={getStatusColor(applicationStatus.status || 'pending')}>
                {applicationStatus.status?.replace('_', ' ').toUpperCase() || 'PENDING'}
              </Badge>
            </div>
            
            {applicationStatus.submittedAt && (
              <p className="text-sm text-muted-foreground">
                Submitted: {new Date(applicationStatus.submittedAt).toLocaleDateString()}
              </p>
            )}
            
            {applicationStatus.reviewedAt && (
              <p className="text-sm text-muted-foreground">
                Reviewed: {new Date(applicationStatus.reviewedAt).toLocaleDateString()}
              </p>
            )}
            
            {applicationStatus.reviewNotes && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Review Notes:</strong> {applicationStatus.reviewNotes}
                </AlertDescription>
              </Alert>
            )}
            
            {applicationStatus.rejectionReason && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Rejection Reason:</strong> {applicationStatus.rejectionReason}
                </AlertDescription>
              </Alert>
            )}
            
            {applicationStatus.status === 'approved' && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Congratulations! Your application has been approved. You now have access to create and manage articles.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Apply to Become an Author
          </CardTitle>
          <CardDescription>
            Fill out this form to request access to the Articles Dashboard. All fields marked with * are required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitStatus === 'success' && (
            <Alert className="mb-6">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Your application has been submitted successfully! You will be notified once it has been reviewed.
              </AlertDescription>
            </Alert>
          )}

          {submitStatus === 'error' && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {errorMessage}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Full Name *
              </Label>
              <Input
                id="fullName"
                {...register('fullName')}
                placeholder="Enter your full name"
                className={errors.fullName ? 'border-red-500' : ''}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Email Address *
              </Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="Enter your email address"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label htmlFor="bio">
                Bio
              </Label>
              <Textarea
                id="bio"
                {...register('bio')}
                placeholder="Tell us about yourself (optional)"
                rows={3}
              />
              <p className="text-sm text-muted-foreground">
                Brief description of your background and interests
              </p>
            </div>

            {/* Writing Experience */}
            <div className="space-y-2">
              <Label htmlFor="writingExperience">
                Writing Experience
              </Label>
              <Textarea
                id="writingExperience"
                {...register('writingExperience')}
                placeholder="Describe your writing experience (optional)"
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Previous writing experience, publications, or relevant background
              </p>
            </div>

            {/* Portfolio Links */}
            <div className="space-y-2">
              <Label htmlFor="portfolioLinks" className="flex items-center gap-2">
                <LinkIcon className="h-4 w-4" />
                Portfolio Links
              </Label>
              <Textarea
                id="portfolioLinks"
                {...register('portfolioLinks')}
                placeholder="https://your-blog.com&#10;https://medium.com/@yourname&#10;https://github.com/yourname"
                rows={4}
              />
              <p className="text-sm text-muted-foreground">
                Links to your writing portfolio, blog, or published work (one per line)
              </p>
            </div>

            {/* Motivation */}
            <div className="space-y-2">
              <Label htmlFor="motivation" className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Motivation *
              </Label>
              <Textarea
                id="motivation"
                {...register('motivation')}
                placeholder="Why do you want to become an author on our platform?"
                rows={5}
                className={errors.motivation ? 'border-red-500' : ''}
              />
              {errors.motivation && (
                <p className="text-sm text-red-500">{errors.motivation.message}</p>
              )}
              <p className="text-sm text-muted-foreground">
                Explain why you want to write for our platform and what you hope to contribute
              </p>
            </div>

            {/* Submit Button */}
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isSubmitting || !isValid}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Application'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
