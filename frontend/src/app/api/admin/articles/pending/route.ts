import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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

    // Get pending articles using the RPC function
    const { data: pendingArticles, error: articlesError } = await supabase.rpc('get_pending_articles');

    if (articlesError) {
      console.error('Error fetching pending articles:', articlesError);
      return NextResponse.json(
        { error: 'Failed to fetch pending articles' },
        { status: 500 }
      );
    }

    // Log the admin action for audit
    try {
      await supabase.rpc('log_admin_action', {
        action_type: 'view_pending_articles',
        target_entity_type: 'article',
        target_entity_id: null,
        justification: 'Admin viewed pending articles list'
      });
    } catch (logError) {
      console.warn('Failed to log admin action:', logError);
      // Don't fail the request if logging fails
    }

    return NextResponse.json(pendingArticles || []);

  } catch (error) {
    console.error('Unexpected error in pending articles API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 