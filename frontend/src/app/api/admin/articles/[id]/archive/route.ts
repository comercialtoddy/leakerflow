import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Archive article (changes status to 'archived')
export async function POST(
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

    // Get article details before archiving for audit log
    const { data: article } = await supabase
      .from('articles')
      .select('title, author, status')
      .eq('id', params.id)
      .single();

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }

    if (article.status === 'archived') {
      return NextResponse.json({ error: 'Article is already archived' }, { status: 400 });
    }

    // Archive article by updating status
    const { data: updatedArticle, error } = await supabase
      .from('articles')
      .update({ 
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error archiving article:', error);
      return NextResponse.json({ error: 'Failed to archive article' }, { status: 500 });
    }

    // Log admin action in audit log (if audit system exists)
    try {
      await supabase.rpc('log_admin_action', {
        action_type: 'article_archive',
        target_entity_type: 'article',
        target_entity_id: params.id,
        details: { 
          article_title: article.title, 
          article_author: article.author,
          previous_status: article.status,
          new_status: 'archived'
        },
        justification: `Admin archived article: ${article.title}`
      });
    } catch (auditError) {
      console.warn('Failed to log admin action:', auditError);
      // Don't fail the request if audit logging fails
    }

    return NextResponse.json({ 
      article: updatedArticle,
      message: 'Article archived successfully' 
    });

  } catch (error) {
    console.error('Admin article archive API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 