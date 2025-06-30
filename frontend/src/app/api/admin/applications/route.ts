import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_global_admin');

    if (adminError || !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    // Use the database function to get real applications
    const { data: applications, error } = await supabase.rpc('list_author_applications', {
      p_status: status || null,
      p_limit: limit,
      p_offset: (page - 1) * limit
    });

    if (error) {
      console.error('Error fetching applications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch applications' },
        { status: 500 }
      );
    }

    // Count totals by status for dashboard stats
    const { data: allApplications, error: countError } = await supabase
      .from('author_applications')
      .select('status');

    if (countError) {
      console.error('Error counting applications:', countError);
      return NextResponse.json(
        { error: 'Failed to fetch application counts' },
        { status: 500 }
      );
    }

    const totalCount = allApplications?.length || 0;
    const pendingCount = allApplications?.filter(app => app.status === 'pending').length || 0;
    const approvedCount = allApplications?.filter(app => app.status === 'approved').length || 0;
    const rejectedCount = allApplications?.filter(app => app.status === 'rejected').length || 0;

    // If limit is 1, return dashboard summary data
    if (limit === 1) {
      return NextResponse.json({
        data: [
          {
            id: 'summary',
            status: 'pending',
            total_count: totalCount,
            pending_count: pendingCount,
            approved_count: approvedCount,
            rejected_count: rejectedCount,
            created_at: new Date().toISOString()
          }
        ],
        total: totalCount
      });
    }

    const response = {
      data: applications || [],
      total: totalCount,
      page,
      limit,
      hasMore: totalCount > (page * limit),
      stats: {
        total: totalCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Applications API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 