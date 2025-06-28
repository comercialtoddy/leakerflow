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

    // Return mock data for now since author_applications table doesn't exist yet
    const mockApplications = [
      {
        id: 'app_1',
        status: 'pending',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        full_name: 'John Doe',
        email: 'john.doe@example.com',
        bio: 'Experienced tech writer with 5 years in the industry',
        submitted_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'app_2',
        status: 'approved',
        created_at: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        full_name: 'Jane Smith',
        email: 'jane.smith@example.com',
        bio: 'Technology journalist and content creator',
        submitted_at: new Date(Date.now() - 172800000).toISOString(),
        reviewed_at: new Date(Date.now() - 86400000).toISOString(),
        reviewed_by: user.id
      },
      {
        id: 'app_3',
        status: 'rejected',
        created_at: new Date(Date.now() - 259200000).toISOString(), // 3 days ago
        full_name: 'Bob Johnson',
        email: 'bob.johnson@example.com',
        bio: 'New to writing but eager to learn',
        submitted_at: new Date(Date.now() - 259200000).toISOString(),
        reviewed_at: new Date(Date.now() - 172800000).toISOString(),
        reviewed_by: user.id,
        rejection_reason: 'Insufficient writing experience'
      }
    ];

    // Filter by status if provided
    let filteredApplications = mockApplications;
    if (status) {
      filteredApplications = mockApplications.filter(app => app.status === status);
    }

    // Count totals by status for dashboard stats
    const totalCount = mockApplications.length;
    const pendingCount = mockApplications.filter(app => app.status === 'pending').length;
    const approvedCount = mockApplications.filter(app => app.status === 'approved').length;
    const rejectedCount = mockApplications.filter(app => app.status === 'rejected').length;

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

    // Calculate pagination
    const offset = (page - 1) * limit;
    const paginatedApplications = filteredApplications.slice(offset, offset + limit);

    const response = {
      data: paginatedApplications,
      total: filteredApplications.length,
      page,
      limit,
      hasMore: filteredApplications.length > offset + limit
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