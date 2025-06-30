'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { 
  User, 
  Mail, 
  FileText, 
  Link2, 
  MessageSquare, 
  Send,
  Plus,
  X,
  Loader2,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { 
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAuth } from '@/components/AuthProvider';
import { useAuthorStatus } from '@/hooks/use-author-status';
import { type ApplicationFormData } from '@/lib/supabase/author-applications';
import { toast } from 'sonner';

export function AuthorApplicationForm() {
  const { user } = useAuth();
  const { submitApplication, isPending } = useAuthorStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [newExpertise, setNewExpertise] = useState('');
  const [newSampleUrl, setNewSampleUrl] = useState('');

  const [formData, setFormData] = useState<ApplicationFormData>({
    fullName: user?.user_metadata?.full_name || '',
    email: user?.email || '',
    bio: '',
    portfolioUrl: '',
    motivation: '',
    previousExperience: '',
    expertiseAreas: [],
    sampleArticles: [],
    twitterHandle: '',
    linkedinHandle: ''
  });

  const handleInputChange = (field: keyof ApplicationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addExpertiseArea = () => {
    if (newExpertise.trim() && !formData.expertiseAreas.includes(newExpertise.trim())) {
      setFormData(prev => ({
        ...prev,
        expertiseAreas: [...prev.expertiseAreas, newExpertise.trim()]
      }));
      setNewExpertise('');
    }
  };

  const removeExpertiseArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      expertiseAreas: prev.expertiseAreas.filter(a => a !== area)
    }));
  };

  const addSampleArticle = () => {
    if (newSampleUrl.trim() && !formData.sampleArticles.includes(newSampleUrl.trim())) {
      setFormData(prev => ({
        ...prev,
        sampleArticles: [...prev.sampleArticles, newSampleUrl.trim()]
      }));
      setNewSampleUrl('');
    }
  };

  const removeSampleArticle = (url: string) => {
    setFormData(prev => ({
      ...prev,
      sampleArticles: prev.sampleArticles.filter(u => u !== url)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!formData.fullName.trim() || !formData.bio.trim() || !formData.motivation.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.expertiseAreas.length === 0) {
      toast.error('Please add at least one area of expertise');
      return;
    }

    if (formData.sampleArticles.length === 0) {
      toast.error('Please add at least one sample article');
      return;
    }

    setIsSubmitting(true);

    try {
      await submitApplication(formData);
      setIsSubmitted(true);
      toast.success('Application submitted successfully! We\'ll review it and get back to you soon.');
    } catch (error) {
      console.error('Application submission error:', error);
      toast.error('Failed to submit application. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show success page if just submitted or if already pending
  if (isSubmitted || isPending) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl w-full"
        >
          <Card>
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold mb-2">Application Submitted!</h1>
                <p className="text-muted-foreground">
                  Thank you for applying to become an author on our platform. 
                  We'll review your application and get back to you within 5-7 business days.
                </p>
              </div>
              <Alert>
                <Clock className="h-4 w-4" />
                <AlertTitle>What happens next?</AlertTitle>
                <AlertDescription>
                  Our editorial team will review your application, portfolio, and writing samples. 
                  You'll receive an email notification once a decision has been made.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">Become an Author</h1>
          <p className="text-muted-foreground text-lg">
            Join our community of writers and share your expertise with our readers
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Personal Information
                </CardTitle>
                <CardDescription>
                  Tell us about yourself and your background
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="your.email@example.com"
                      disabled
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="bio">Professional Bio *</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    placeholder="Tell us about your professional background, expertise, and experience..."
                    rows={4}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="portfolioUrl">Portfolio/Website URL</Label>
                  <Input
                    id="portfolioUrl"
                    value={formData.portfolioUrl}
                    onChange={(e) => handleInputChange('portfolioUrl', e.target.value)}
                    placeholder="https://yourwebsite.com"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Expertise & Experience */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Expertise & Experience
                </CardTitle>
                <CardDescription>
                  Share your areas of expertise and professional experience
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Areas of Expertise *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newExpertise}
                      onChange={(e) => setNewExpertise(e.target.value)}
                      placeholder="e.g., Artificial Intelligence, Blockchain..."
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addExpertiseArea())}
                    />
                    <Button type="button" onClick={addExpertiseArea} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.expertiseAreas.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {formData.expertiseAreas.map((area) => (
                        <Badge key={area} variant="secondary" className="gap-1">
                          {area}
                          <button
                            type="button"
                            onClick={() => removeExpertiseArea(area)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="previousExperience">Previous Experience</Label>
                  <Textarea
                    id="previousExperience"
                    value={formData.previousExperience}
                    onChange={(e) => handleInputChange('previousExperience', e.target.value)}
                    placeholder="Describe your relevant work experience, previous publications, roles..."
                    rows={3}
                  />
                </div>


              </CardContent>
            </Card>

            {/* Writing Samples */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Writing Samples
                </CardTitle>
                <CardDescription>
                  Share links to your best published articles or blog posts
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Sample Articles *</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newSampleUrl}
                      onChange={(e) => setNewSampleUrl(e.target.value)}
                      placeholder="https://example.com/your-article"
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSampleArticle())}
                    />
                    <Button type="button" onClick={addSampleArticle} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  {formData.sampleArticles.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {formData.sampleArticles.map((url, index) => (
                        <div key={url} className="flex items-center gap-2 p-2 border rounded">
                          <span className="text-sm flex-1">{index + 1}. {url}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeSampleArticle(url)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Motivation & Social */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Motivation & Social Presence
                </CardTitle>
                <CardDescription>
                  Tell us why you want to write for our platform
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="motivation">Why do you want to write for our platform? *</Label>
                  <Textarea
                    id="motivation"
                    value={formData.motivation}
                    onChange={(e) => handleInputChange('motivation', e.target.value)}
                    placeholder="Share your motivation and what you hope to contribute..."
                    rows={4}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="twitterHandle">Twitter Handle</Label>
                    <Input
                      id="twitterHandle"
                      value={formData.twitterHandle}
                      onChange={(e) => handleInputChange('twitterHandle', e.target.value)}
                      placeholder="@yourusername"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedinHandle">LinkedIn Profile</Label>
                    <Input
                      id="linkedinHandle"
                      value={formData.linkedinHandle}
                      onChange={(e) => handleInputChange('linkedinHandle', e.target.value)}
                      placeholder="linkedin.com/in/yourprofile"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submit Button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex justify-center"
            >
              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting}
                className="w-full md:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Application
                  </>
                )}
              </Button>
            </motion.div>
          </form>
        </motion.div>
      </div>
    </div>
  );
} 