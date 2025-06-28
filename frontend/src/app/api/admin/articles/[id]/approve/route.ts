import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const articleId = params.id;
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is global admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_global_admin');
    
    if (adminError) {
      console.error('Error checking admin status:', adminError);
      return NextResponse.json(
        { error: 'Failed to verify admin permissions' },
        { status: 500 }
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Approve the article using the RPC function
    const { data: result, error: approveError } = await supabase.rpc('approve_article', {
      article_id: articleId
    });

    if (approveError) {
      console.error('Error approving article:', approveError);
      return NextResponse.json(
        { error: approveError.message || 'Failed to approve article' },
        { status: 500 }
      );
    }

    // Check if the RPC returned an error in the result
    if (result && result.success === false) {
      return NextResponse.json(
        { error: result.error || 'Failed to approve article' },
        { status: 400 }
      );
    }

    // Log the admin action for audit
    try {
      await supabase.rpc('log_admin_action', {
        action_type: 'approve_article',
        target_entity_type: 'article',
        target_entity_id: articleId,
        justification: 'Admin approved article for publication'
      });
    } catch (logError) {
      console.warn('Failed to log admin action:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json({
      success: true,
      message: 'Article approved and published successfully',
      articleId
    });

  } catch (error) {
    console.error('Unexpected error in approve article API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 