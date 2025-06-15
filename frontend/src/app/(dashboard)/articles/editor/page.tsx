'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useArticle, useCreateArticle, useUpdateArticle } from '@/hooks/react-query/articles/use-articles';
import { RichTextEditor, RichTextEditorRef } from '@/components/ui/rich-text-editor';
import { toast } from 'sonner';
import { 
  Save, 
  Eye, 
  Upload, 
  Image as ImageIcon, 
  Video, 
  Link2, 
  Tag, 
  Calendar, 
  Settings,
  ArrowLeft,
  Plus,
  X,
  FileText,
  Globe,
  User,
  Clock,
  Bookmark,
  Loader2
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface MediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  name: string;
  size: string;
}

interface Source {
  id: string;
  title: string;
  url: string;
  description?: string;
}

interface ArticleSection {
  id: string;
  title: string;
  content: string;
  media: MediaItem[];
  sources: Source[];
  order: number;
}

// Predefined categories that match the Discover navbar
const PREDEFINED_CATEGORIES = [
  { value: 'trends', label: 'Trends' },
  { value: 'for-you', label: 'For You' },
  { value: 'official', label: 'Official' },
  { value: 'rumor', label: 'Rumor' },
  { value: 'community', label: 'Community' },
];

export default function ArticleEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const articleId = searchParams.get('id');
  
  // State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [sections, setSections] = useState<ArticleSection[]>([
    {
      id: `section-${Date.now()}`,
      title: '',
      content: '',
      media: [],
      sources: [],
      order: 0
    }
  ]);
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'scheduled'>('draft');
  const [publishDate, setPublishDate] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isOwner, setIsOwner] = useState(true); // Track if current user owns the article
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const richTextEditorRef = useRef<RichTextEditorRef>(null);
  const [newSource, setNewSource] = useState({ title: '', url: '', description: '' });

  // React Query hooks
  const { data: existingArticle, isLoading: loadingArticle } = useArticle(articleId);
  const createArticleMutation = useCreateArticle();
  const updateArticleMutation = useUpdateArticle();

  const isEditing = !!articleId;

  // Load existing article data when editing
  useEffect(() => {
    const checkOwnership = async () => {
      if (existingArticle) {
        // Check if current user owns the article
        try {
          const { createClient } = await import('@/lib/supabase/client');
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          
          if (user && existingArticle.user_id) {
            setIsOwner(user.id === existingArticle.user_id);
            console.log('Ownership check:', {
              currentUserId: user.id,
              articleUserId: existingArticle.user_id,
              isOwner: user.id === existingArticle.user_id
            });
          }
        } catch (error) {
          console.error('Error checking ownership:', error);
        }
        
        setTitle(existingArticle.title);
        setSubtitle(existingArticle.subtitle);
        setContent(existingArticle.content);
        setCategory(existingArticle.category);
        setTags(existingArticle.tags || []);
        setAuthor(existingArticle.author);
        setStatus(existingArticle.status);
        setPublishDate(existingArticle.publish_date ? new Date(existingArticle.publish_date).toISOString().slice(0, 16) : '');
        
        // Load sections if they exist, otherwise create from content
        if (existingArticle.sections && Array.isArray(existingArticle.sections) && existingArticle.sections.length > 0) {
          console.log('Loading existing sections:', existingArticle.sections);
          setSections(existingArticle.sections as ArticleSection[]);
          
          // Clear global media/sources since they're now in sections
          setMediaItems([]);
          setSources([]);
        } else if (existingArticle.content) {
          // Convert existing content to first section and migrate media/sources
          const legacyMedia = existingArticle.media_items as MediaItem[] || [];
          const legacySources = existingArticle.sources as Source[] || [];
          
          setSections([{
            id: `section-${Date.now()}`,
            title: '',
            content: existingArticle.content,
            media: legacyMedia,
            sources: legacySources,
            order: 0
          }]);
          
          // Clear global media/sources since they're now in the section
          setMediaItems([]);
          setSources([]);
        } else {
          // No content or sections, create empty section
          setSections([{
            id: `section-${Date.now()}`,
            title: '',
            content: '',
            media: [],
            sources: [],
            order: 0
          }]);
        }
      }
    };
    
    checkOwnership();
  }, [existingArticle]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    const articlesService = new (await import('@/lib/supabase/articles')).ArticlesService();

    for (const file of Array.from(files)) {
      try {
          // Check file size (15MB limit)
        const maxSize = 15 * 1024 * 1024; // 15MB
        if (file.size > maxSize) {
          toast.error(`File "${file.name}" exceeds 15MB limit. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
          continue;
        }

        toast.info(`Uploading "${file.name}"...`);
        
        // Upload file to Supabase Storage
        const url = await articlesService.uploadFile(file);
        
        const newMediaItem: MediaItem = {
          id: `media-${Date.now()}-${Math.random()}`,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          url: url,
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        };
        
        setMediaItems(prev => [...prev, newMediaItem]);
        toast.success(`"${file.name}" uploaded successfully!`);
      } catch (error: any) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload "${file.name}": ${error.message || 'Unknown error'}`);
      }
    }
  }, []);

  const addTag = useCallback(() => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  }, [newTag, tags]);

  const removeTag = useCallback((tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  }, []);

  const addSection = useCallback(() => {
    const newSection: ArticleSection = {
      id: `section-${Date.now()}`,
      title: '',
      content: '',
      media: [],
      sources: [],
      order: sections.length
    };
    setSections(prev => [...prev, newSection]);
  }, [sections.length]);

  const updateSection = useCallback((id: string, updates: Partial<ArticleSection>) => {
    setSections(prev => prev.map(section => 
      section.id === id ? { ...section, ...updates } : section
    ));
  }, []);

  const handleSectionMediaUpload = useCallback(async (sectionId: string, files: FileList) => {
    const articlesService = new (await import('@/lib/supabase/articles')).ArticlesService();

    for (const file of Array.from(files)) {
      try {
        const maxSize = 15 * 1024 * 1024; // 15MB
        if (file.size > maxSize) {
          toast.error(`File "${file.name}" exceeds 15MB limit`);
          continue;
        }

        toast.info(`Uploading "${file.name}"...`);
        const url = await articlesService.uploadFile(file);
        
        const newMediaItem: MediaItem = {
          id: `media-${Date.now()}-${Math.random()}`,
          type: file.type.startsWith('video/') ? 'video' : 'image',
          url: url,
          name: file.name,
          size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        };
        
        setSections(prev => prev.map(section => 
          section.id === sectionId 
            ? { ...section, media: [...section.media, newMediaItem] }
            : section
        ));
        
        toast.success(`"${file.name}" uploaded successfully!`);
      } catch (error: any) {
        toast.error(`Failed to upload "${file.name}": ${error.message}`);
      }
    }
  }, []);

  const addSourceToSection = useCallback((sectionId: string, source: Source) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId 
        ? { ...section, sources: [...section.sources, source] }
        : section
    ));
  }, []);

  const removeSection = useCallback((id: string) => {
    if (sections.length > 1) {
      setSections(prev => prev.filter(section => section.id !== id));
    }
  }, [sections.length]);

  const addSource = useCallback(() => {
    if (newSource.title.trim() && newSource.url.trim()) {
      const source: Source = {
        id: `source-${Date.now()}`,
        title: newSource.title.trim(),
        url: newSource.url.trim(),
        description: newSource.description.trim() || undefined,
      };
      setSources(prev => [...prev, source]);
      setNewSource({ title: '', url: '', description: '' });
    }
  }, [newSource]);

  const removeSource = useCallback((sourceId: string) => {
    setSources(prev => prev.filter(source => source.id !== sourceId));
  }, []);

  const removeMediaItem = useCallback((itemId: string) => {
    setMediaItems(prev => prev.filter(item => item.id !== itemId));
  }, []);

  const insertMediaIntoEditor = useCallback((url: string, type: 'image' | 'video') => {
    if (richTextEditorRef.current) {
      richTextEditorRef.current.insertMedia(url, type);
    }
  }, []);

  const estimateReadTime = useCallback((text: string) => {
    // Calculate read time based on characters (approximately 1000 characters per minute)
    const charactersPerMinute = 1000;
    const characters = text.trim().length;
    const minutes = Math.ceil(characters / charactersPerMinute);
    return `${minutes} min read`;
  }, []);

  const handleSave = useCallback(async (saveStatus: 'draft' | 'published' | 'scheduled' = 'draft') => {
    if (!title.trim() || !subtitle.trim() || !author.trim()) {
      toast.error('Please fill in title, subtitle, and author');
      return;
    }

    // Combine sections into single content for backward compatibility
    const combinedContent = sections.map(section => {
      let sectionText = '';
      if (section.title.trim()) {
        sectionText += `## ${section.title.trim()}\n\n`;
      }
      if (section.content.trim()) {
        sectionText += section.content.trim();
      }
      return sectionText;
    }).filter(s => s).join('\n\n');

    // Collect all media and sources from sections
    const allSectionMedia = sections.flatMap(section => section.media);
    const allSectionSources = sections.flatMap(section => section.sources);

    const articleData = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      content: combinedContent || content.trim(),
      sections: sections,
      category,
      tags,
      sources: [...sources, ...allSectionSources],
      media_items: [...mediaItems, ...allSectionMedia],
      author: author.trim(),
      read_time: estimateReadTime(combinedContent || content),
      status: saveStatus,
      image_url: (allSectionMedia.length > 0 ? allSectionMedia[0].url : mediaItems.length > 0 ? mediaItems[0].url : undefined),
      publish_date: (saveStatus === 'published' || saveStatus === 'scheduled') ? publishDate : undefined,
    };

    // Debug logging
    console.log('=== SAVE ARTICLE DEBUG ===');
    console.log('Article ID:', articleId);
    console.log('Is editing:', isEditing);
    console.log('Sections count:', sections.length);
    console.log('Sections data:', sections);
    console.log('Total section media:', allSectionMedia.length);
    console.log('Total section sources:', allSectionSources.length);

    try {
      if (isEditing && articleId) {
        await updateArticleMutation.mutateAsync({
          id: articleId,
          ...articleData,
        });
        toast.success('Article updated successfully!');
      } else {
        await createArticleMutation.mutateAsync(articleData);
        toast.success('Article created successfully!');
        router.push('/articles');
      }
    } catch (error) {
      console.error('Error saving article:', error);
      
      // Provide specific error messages based on the error type
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          toast.error('Permission denied: ' + error.message);
        } else if (error.message.includes('not found')) {
          toast.error('Article not found: ' + error.message);
        } else if (error.message.includes('authenticated')) {
          toast.error('Authentication required: Please log in and try again.');
        } else {
          toast.error('Error saving article: ' + error.message);
        }
      } else {
        toast.error('An unexpected error occurred while saving the article.');
      }
    }
  }, [
    title, subtitle, content, category, tags, sources, mediaItems, author, 
    publishDate, estimateReadTime, isEditing, articleId, updateArticleMutation, 
    createArticleMutation, router, sections, status
  ]);

  if (loadingArticle) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-6 flex items-center justify-center">
          <div className="flex items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span>Loading article...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/articles">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Articles
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">
                {isEditing ? 'Edit Article' : 'Create Article'}
              </h1>
              <p className="text-muted-foreground text-sm">
                {isEditing ? 'Edit your article for the Discover platform' : 'Create and edit articles for the Discover platform'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-4xl max-h-[90vh] p-0">
                <DialogHeader className="p-6 pb-0">
                  <DialogTitle>Article Preview</DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[80vh] px-6 pb-6">
                  <div className="space-y-6">
                    {/* Preview Header */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="capitalize">
                          {category || 'No category'}
                        </Badge>
                        <Badge variant="outline">
                          {estimateReadTime(content)}
                        </Badge>
                      </div>
                      
                      <h1 className="text-3xl font-bold text-foreground leading-tight">
                        {title || 'Untitled Article'}
                      </h1>
                      
                      <p className="text-lg text-muted-foreground leading-relaxed">
                        {subtitle || 'No subtitle provided'}
                      </p>
                      
                      <div className="flex items-center gap-3 p-4 bg-card rounded-lg border border-border/50">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {author || 'No author'}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {status === 'published' ? 'Published' : 'Draft'} • {new Date().toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Hero Image */}
                    {mediaItems.length > 0 && mediaItems[0].type === 'image' && (
                      <div className="mb-8">
                        <img 
                          src={mediaItems[0].url} 
                          alt={title}
                          className="w-full h-64 md:h-96 object-cover rounded-xl"
                        />
                      </div>
                    )}

                    {/* Article Sections */}
                    <div className="space-y-8">
                      {sections.length > 0 ? (
                        sections.map((section) => (
                          <div key={section.id} className="space-y-4">
                            {section.title && (
                              <h2 className="text-2xl font-semibold text-foreground border-b border-border/30 pb-2">
                                {section.title}
                              </h2>
                            )}
                            {section.content && (
                              <div className="prose prose-lg dark:prose-invert max-w-none">
                                <div 
                                  dangerouslySetInnerHTML={{ 
                                    __html: section.content
                                      .replace(/\n\n/g, '</p><p>')
                                      .replace(/\n/g, '<br>')
                                      .replace(/^/, '<p>')
                                      .replace(/$/, '</p>')
                                      .replace(/<p><\/p>/g, '')
                                  }} 
                                />
                              </div>
                            )}
                            
                            {/* Section Media in Preview */}
                            {section.media && section.media.length > 0 && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-6">
                                {section.media.map((item) => (
                                  <div key={item.id} className="rounded-lg overflow-hidden">
                                    {item.type === 'image' ? (
                                      <img
                                        src={item.url}
                                        alt={item.name}
                                        className="w-full h-64 object-cover"
                                      />
                                    ) : (
                                      <div className="w-full h-64 bg-muted flex items-center justify-center">
                                        <Video className="h-12 w-12 text-muted-foreground" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Section Sources in Preview */}
                            {section.sources.length > 0 && (
                              <div className="space-y-2 my-4">
                                <h4 className="text-sm font-medium text-muted-foreground">Sources for this section:</h4>
                                <div className="space-y-1">
                                  {section.sources.map((source) => (
                                    <div key={source.id} className="text-sm p-2 bg-muted rounded-lg">
                                      <p className="font-medium">{source.title}</p>
                                      <a 
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-primary hover:underline"
                                      >
                                        {source.url}
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-muted-foreground italic">No sections added yet...</p>
                      )}
                    </div>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="space-y-3">
                        <Separator />
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-3">Tags</h3>
                          <div className="flex flex-wrap gap-2">
                            {tags.map((tag) => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Sources */}
                    {sources.length > 0 && (
                      <div className="space-y-3">
                        <Separator />
                        <div>
                          <h3 className="text-sm font-medium text-muted-foreground mb-3">Sources</h3>
                          <div className="space-y-2">
                            {sources.map((source) => (
                              <div key={source.id} className="p-3 bg-card rounded-lg border border-border/50">
                                <div className="flex items-start gap-3">
                                  <Link2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-medium text-foreground truncate">
                                      {source.title}
                                    </h4>
                                    {source.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {source.description}
                                      </p>
                                    )}
                                    <a 
                                      href={source.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:text-primary/80 transition-colors mt-1 inline-block"
                                    >
                                      {source.url}
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
            <Button 
              size="sm" 
              onClick={() => handleSave('draft')}
              disabled={createArticleMutation.isPending || updateArticleMutation.isPending || (isEditing && !isOwner)}
            >
              {(createArticleMutation.isPending || updateArticleMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Draft
                </>
              )}
            </Button>
            <Button 
              size="sm" 
              variant="default"
              onClick={() => handleSave('published')}
              disabled={createArticleMutation.isPending || updateArticleMutation.isPending || (isEditing && !isOwner)}
            >
              {(createArticleMutation.isPending || updateArticleMutation.isPending) ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Globe className="mr-2 h-4 w-4" />
                  Publish
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Ownership Warning */}
        {isEditing && !isOwner && (
          <Alert className="mb-6" variant="destructive">
            <AlertTitle>Permission Denied</AlertTitle>
            <AlertDescription>
              You don't have permission to edit this article. Only the original author can make changes.
              You can view the article content, but any attempts to save changes will be rejected.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Article Content
                </CardTitle>
                <CardDescription>
                  The main content and structure of your article
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter article title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-lg font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subtitle">Subtitle</Label>
                  <Textarea
                    id="subtitle"
                    placeholder="Brief description or summary..."
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Article Sections */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Article Sections</Label>
                    <Button 
                      type="button" 
                      onClick={addSection}
                      variant="outline" 
                      size="sm"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Section
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    {sections.map((section, index) => (
                      <Card key={section.id} className="relative">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">
                              Section {index + 1}
                            </CardTitle>
                            {sections.length > 1 && (
                              <Button
                                type="button"
                                onClick={() => removeSection(section.id)}
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                          <div className="space-y-2">
                            <Label htmlFor={`section-title-${section.id}`}>Section Title (Optional)</Label>
                            <Input
                              id={`section-title-${section.id}`}
                              placeholder="Enter section title..."
                              value={section.title}
                              onChange={(e) => updateSection(section.id, { title: e.target.value })}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor={`section-content-${section.id}`}>Section Content</Label>
                            <RichTextEditor
                              value={section.content}
                              onChange={(value) => updateSection(section.id, { content: value })}
                              placeholder="Write the content for this section..."
                              minHeight="300px"
                            />
                          </div>

                          {/* Section Media - Independent Upload */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label>Media for this Section</Label>
                              <div>
                                <Button 
                                  type="button" 
                                  onClick={() => document.getElementById(`media-upload-${section.id}`)?.click()}
                                  variant="outline" 
                                  size="sm"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Upload Media
                                </Button>
                                <input
                                  id={`media-upload-${section.id}`}
                                  type="file"
                                  multiple
                                  accept="image/*,video/*"
                                  onChange={(e) => e.target.files && handleSectionMediaUpload(section.id, e.target.files)}
                                  className="hidden"
                                />
                              </div>
                            </div>
                            
                            {/* Show section's media */}
                            {section.media && section.media.length > 0 && (
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {section.media.map((item) => (
                                  <div key={item.id} className="relative group border rounded-lg overflow-hidden">
                                    {item.type === 'image' ? (
                                      <img src={item.url} alt={item.name} className="w-full h-24 object-cover" />
                                    ) : (
                                      <div className="w-full h-24 bg-muted flex items-center justify-center">
                                        <Video className="h-6 w-6 text-muted-foreground" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => updateSection(section.id, { 
                                          media: section.media.filter(m => m.id !== item.id) 
                                        })}
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </div>
                                    <div className="p-1">
                                      <p className="text-xs truncate">{item.name}</p>
                                      <p className="text-xs text-muted-foreground">{item.size}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Section Sources */}
                          <div className="space-y-3">
                            <Label>Sources for this Section</Label>
                            
                            {/* Add source form */}
                            <div className="grid grid-cols-2 gap-3 p-3 border rounded-lg bg-muted/30">
                              <Input
                                placeholder="Source title"
                                value={newSource.title}
                                onChange={(e) => setNewSource(prev => ({ ...prev, title: e.target.value }))}
                              />
                              <Input
                                placeholder="URL"
                                value={newSource.url}
                                onChange={(e) => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                              />
                              <div className="col-span-2">
                                <Button
                                  type="button"
                                  onClick={() => {
                                    if (newSource.title.trim() && newSource.url.trim()) {
                                      const source: Source = {
                                        id: `source-${Date.now()}`,
                                        title: newSource.title.trim(),
                                        url: newSource.url.trim(),
                                      };
                                      addSourceToSection(section.id, source);
                                      setNewSource({ title: '', url: '', description: '' });
                                    }
                                  }}
                                  size="sm"
                                  className="w-full"
                                >
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Source
                                </Button>
                              </div>
                            </div>
                            
                            {/* Show section's sources */}
                            {section.sources && section.sources.length > 0 && (
                              <div className="space-y-2">
                                {section.sources.map((source) => (
                                  <div key={source.id} className="flex items-center justify-between p-2 border rounded bg-background">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{source.title}</p>
                                      <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => updateSection(section.id, { 
                                        sources: section.sources.filter(s => s.id !== source.id) 
                                      })}
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
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>


          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Article Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Article Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {PREDEFINED_CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          <div className="flex items-center gap-2">
                            <span>{cat.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    placeholder="Author name"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select value={status} onValueChange={(value: any) => setStatus(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Published</SelectItem>
                      <SelectItem value="scheduled">Scheduled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {status === 'scheduled' && (
                  <div className="space-y-2">
                    <Label htmlFor="publish-date">Publish Date</Label>
                    <Input
                      id="publish-date"
                      type="datetime-local"
                      value={publishDate}
                      onChange={(e) => setPublishDate(e.target.value)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tag className="h-5 w-5" />
                  Tags
                </CardTitle>
                <CardDescription>
                  Add relevant tags to help categorize your article
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Add tag..."
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                  />
                  <Button size="sm" onClick={addTag}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Article Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Article Stats
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Word Count:</span>
                  <span className="font-medium">{content.trim().split(/\s+/).filter(word => word.length > 0).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Read Time:</span>
                  <span className="font-medium">{estimateReadTime(content)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Characters:</span>
                  <span className="font-medium">{content.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Media Items:</span>
                  <span className="font-medium">{mediaItems.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Sources:</span>
                  <span className="font-medium">{sources.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}