import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check if user is authenticated and is admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin permissions
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_global_admin');
    if (adminError || !isAdmin) {
      return NextResponse.json({ error: 'Access denied: Admin privileges required' }, { status: 403 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get('skip') || '0');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const visibility = searchParams.get('visibility');
    const search = searchParams.get('search');
    const category = searchParams.get('category');

    // Build query with admin privileges (bypasses RLS)
    let query = supabase
      .from('articles')
      .select('*')
      .range(skip, skip + limit - 1)
      .order('created_at', { ascending: false });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (visibility && visibility !== 'all') {
      query = query.eq('visibility', visibility);
    }
    
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    // Apply search filter
    if (search) {
      query = query.or(`title.ilike.%${search}%,subtitle.ilike.%${search}%,author.ilike.%${search}%`);
    }

    const { data: articles, error: articlesError } = await query;

    if (articlesError) {
      console.error('Error fetching articles:', articlesError);
      return NextResponse.json({ error: 'Failed to fetch articles' }, { status: 500 });
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('articles')
      .select('*', { count: 'exact', head: true });

    if (status && status !== 'all') {
      countQuery = countQuery.eq('status', status);
    }
    
    if (visibility && visibility !== 'all') {
      countQuery = countQuery.eq('visibility', visibility);
    }
    
    if (category && category !== 'all') {
      countQuery = countQuery.eq('category', category);
    }

    if (search) {
      countQuery = countQuery.or(`title.ilike.%${search}%,subtitle.ilike.%${search}%,author.ilike.%${search}%`);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Error getting articles count:', countError);
    }

    // Process articles data for admin panel
    const processedArticles = articles?.map((article: any) => ({
      id: article.id,
      title: article.title,
      subtitle: article.subtitle,
      author: article.author,
      author_email: 'unknown@email.com', // Simplified for now
      account_name: `Account ${article.account_id?.slice(0, 8)}`, // Simplified for now
      status: article.status,
      category: article.category,
      visibility: article.visibility,
      created_at: article.created_at,
      updated_at: article.updated_at,
      views: article.total_views || 0,
      engagement: article.avg_read_time || 0,
      reports_count: 0, // TODO: Add reports system
      tags: article.tags || [],
      upvotes: article.upvotes || 0,
      downvotes: article.downvotes || 0,
      vote_score: article.vote_score || 0,
      content: article.content?.substring(0, 500) + (article.content?.length > 500 ? '...' : ''), // Truncated content
      publish_date: article.publish_date,
      image_url: article.image_url,
      media_items: article.media_items || [],
      sources: article.sources || []
    })) || [];

    return NextResponse.json({
      articles: processedArticles,
      total: count || 0,
      skip,
      limit,
      hasMore: (skip + limit) < (count || 0)
    });

  } catch (error) {
    console.error('Admin articles API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 