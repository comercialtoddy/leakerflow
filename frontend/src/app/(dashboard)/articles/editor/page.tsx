'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'motion/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useArticle, useCreateArticle, useUpdateArticle } from '@/hooks/react-query/articles/use-articles';
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
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

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

export default function ArticleEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const articleId = searchParams.get('id');
  
  // State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [author, setAuthor] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'scheduled'>('draft');
  const [publishDate, setPublishDate] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newSource, setNewSource] = useState({ title: '', url: '', description: '' });

  // React Query hooks
  const { data: existingArticle, isLoading: loadingArticle } = useArticle(articleId);
  const createArticleMutation = useCreateArticle();
  const updateArticleMutation = useUpdateArticle();

  const isEditing = !!articleId;

  // Load existing article data when editing
  useEffect(() => {
    if (existingArticle) {
      setTitle(existingArticle.title);
      setSubtitle(existingArticle.subtitle);
      setContent(existingArticle.content);
      setCategory(existingArticle.category);
      setTags(existingArticle.tags || []);
      setAuthor(existingArticle.author);
      setStatus(existingArticle.status);
      setPublishDate(existingArticle.publish_date ? new Date(existingArticle.publish_date).toISOString().slice(0, 16) : '');
      
      // Convert JSONB data back to local state
      if (existingArticle.sources) {
        setSources(existingArticle.sources as Source[]);
      }
      if (existingArticle.media_items) {
        setMediaItems(existingArticle.media_items as MediaItem[]);
      }
    }
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

  const estimateReadTime = useCallback((text: string) => {
    const wordsPerMinute = 200;
    const words = text.trim().split(/\s+/).length;
    const minutes = Math.ceil(words / wordsPerMinute);
    return `${minutes} min read`;
  }, []);

  const handleSave = useCallback(async (saveStatus: 'draft' | 'published' | 'scheduled' = 'draft') => {
    if (!title.trim() || !subtitle.trim() || !content.trim() || !author.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    const articleData = {
      title: title.trim(),
      subtitle: subtitle.trim(),
      content: content.trim(),
      category,
      tags,
      sources: sources,
      media_items: mediaItems,
      author: author.trim(),
      read_time: estimateReadTime(content),
      status: saveStatus,
      image_url: mediaItems.length > 0 ? mediaItems[0].url : undefined,
      publish_date: (saveStatus === 'published' || saveStatus === 'scheduled') ? publishDate : undefined,
    };

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
    }
  }, [
    title, subtitle, content, category, tags, sources, mediaItems, author, 
    publishDate, estimateReadTime, isEditing, articleId, updateArticleMutation, 
    createArticleMutation, router
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
            <Button variant="outline" size="sm">
              <Eye className="mr-2 h-4 w-4" />
              Preview
            </Button>
            <Button 
              size="sm" 
              onClick={() => handleSave('draft')}
              disabled={createArticleMutation.isPending || updateArticleMutation.isPending}
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
              disabled={createArticleMutation.isPending || updateArticleMutation.isPending}
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

                <div className="space-y-2">
                  <Label htmlFor="content">Content</Label>
                  
                  {/* Content size warning */}
                  {content.length > 180000 && (
                    <div className={`p-3 rounded-lg text-sm ${
                      content.length > 200000 
                        ? 'bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800' 
                        : 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800'
                    }`}>
                      {content.length > 200000 ? (
                        <>⚠️ Content exceeds 200K character limit and will be truncated when saved. Consider breaking this into multiple articles.</>
                      ) : (
                        <>⚠️ Content is approaching the 200K character limit ({((content.length / 200000) * 100).toFixed(1)}% used).</>
                      )}
                    </div>
                  )}
                  
                  <Textarea
                    id="content"
                    placeholder="Write your article content here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={15}
                    className="min-h-[400px] font-mono text-sm"
                  />
                  <div className="flex justify-between items-center text-xs text-muted-foreground">
                    <span>Estimated read time: {estimateReadTime(content)}</span>
                                                              <span className={content.length > 180000 ? 'text-amber-600' : content.length > 200000 ? 'text-red-600' : ''}>
                       {content.length.toLocaleString()} / 200,000 characters
                     </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Media Library */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Media Library
                </CardTitle>
                <CardDescription>
                  Upload and manage images, videos, and other media
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
                    <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag and drop files here, or click to browse
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Upload Media
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </div>

                  {mediaItems.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {mediaItems.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative group border rounded-lg overflow-hidden"
                        >
                          {item.type === 'image' ? (
                            <img
                              src={item.url}
                              alt={item.name}
                              className="w-full h-32 object-cover"
                            />
                          ) : (
                            <div className="w-full h-32 bg-muted flex items-center justify-center">
                              <Video className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => removeMediaItem(item.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{item.size}</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Sources */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Sources & References
                </CardTitle>
                <CardDescription>
                  Add credible sources and references for your article
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                    <div className="space-y-2">
                      <Label htmlFor="source-title">Source Title</Label>
                      <Input
                        id="source-title"
                        placeholder="Source name or title"
                        value={newSource.title}
                        onChange={(e) => setNewSource(prev => ({ ...prev, title: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="source-url">URL</Label>
                      <Input
                        id="source-url"
                        placeholder="https://example.com"
                        value={newSource.url}
                        onChange={(e) => setNewSource(prev => ({ ...prev, url: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="source-description">Description (optional)</Label>
                      <Input
                        id="source-description"
                        placeholder="Brief description of the source"
                        value={newSource.description}
                        onChange={(e) => setNewSource(prev => ({ ...prev, description: e.target.value }))}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <Button onClick={addSource} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Source
                      </Button>
                    </div>
                  </div>

                  {sources.length > 0 && (
                    <div className="space-y-3">
                      {sources.map((source) => (
                        <motion.div
                          key={source.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="flex items-start gap-3 p-3 border rounded-lg bg-background"
                        >
                          <Link2 className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-sm">{source.title}</h4>
                            <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                            {source.description && (
                              <p className="text-xs text-muted-foreground mt-1">{source.description}</p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeSource(source.id)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </motion.div>
                      ))}
                    </div>
                  )}
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
                      <SelectItem value="ai-automation">AI & Automation</SelectItem>
                      <SelectItem value="productivity">Productivity</SelectItem>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="business">Business</SelectItem>
                      <SelectItem value="technology">Technology</SelectItem>
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