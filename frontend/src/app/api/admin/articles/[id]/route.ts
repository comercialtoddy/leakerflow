import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET - Get specific article details for admin
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { data: article, error } = await supabase
      .from('articles')
      .select(`
        *,
        author_applications!inner(
          user_id,
          full_name,
          email,
          status as application_status
        )
      `)
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Article not found' }, { status: 404 });
      }
      console.error('Error fetching article:', error);
      return NextResponse.json({ error: 'Failed to fetch article' }, { status: 500 });
    }

    return NextResponse.json({ article });

  } catch (error) {
    console.error('Admin article detail API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update article (admin can update any article)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const updates = await request.json();
    
    // Validate required fields if status is being changed to published
    if (updates.status === 'published') {
      const { data: currentArticle } = await supabase
        .from('articles')
        .select('title, content')
        .eq('id', params.id)
        .single();
      
      if (!currentArticle?.title || !currentArticle?.content) {
        return NextResponse.json(
          { error: 'Cannot publish article: missing title or content' },
          { status: 400 }
        );
      }
    }

    // Update article
    const { data: article, error } = await supabase
      .from('articles')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating article:', error);
      return NextResponse.json({ error: 'Failed to update article' }, { status: 500 });
    }

    // Log admin action in audit log (if audit system exists)
    try {
      await supabase.rpc('log_admin_action', {
        action_type: 'article_update',
        target_entity_type: 'article',
        target_entity_id: params.id,
        details: { updated_fields: Object.keys(updates) },
        justification: `Admin updated article: ${article.title}`
      });
    } catch (auditError) {
      console.warn('Failed to log admin action:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ 
      article,
      message: 'Article updated successfully' 
    });

  } catch (error) {
    console.error('Admin article update API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete article (admin can delete any article)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // Get article details before deletion for audit log
    const { data: article } = await supabase
      .from('articles')
      .select('title, author')
      .eq('id', params.id)
      .single();

    // Delete article
    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', params.id);

    if (error) {
      console.error('Error deleting article:', error);
      return NextResponse.json({ error: 'Failed to delete article' }, { status: 500 });
    }

    // Log admin action in audit log (if audit system exists)
    try {
      await supabase.rpc('log_admin_action', {
        action_type: 'article_delete',
        target_entity_type: 'article',
        target_entity_id: params.id,
        details: { article_title: article?.title, article_author: article?.author },
        justification: `Admin deleted article: ${article?.title}`
      });
    } catch (auditError) {
      console.warn('Failed to log admin action:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ 
      message: 'Article deleted successfully' 
    });

  } catch (error) {
    console.error('Admin article delete API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 