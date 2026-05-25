import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * GET /api/deliveries/stats
 *
 * Returns delivery statistics using database aggregation for performance
 * Much faster than fetching all deliveries just to count them
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createAuthenticatedClient(request.headers.get('authorization'))

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization
    const { data: membership, error: membershipError } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'No organization found for user' }, { status: 403 })
    }

    // Use database aggregation to count - much faster than fetching all data
    const [totalResult, pendingResult, inProgressResult, completedResult, failedResult] = await Promise.all([
      supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id),
      supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id)
        .eq('status', 'pending'),
      supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id)
        .eq('status', 'in-progress'),
      supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id)
        .eq('status', 'completed'),
      supabase
        .from('deliveries')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id)
        .eq('status', 'failed'),
    ])

    // Note: totalValue calculation would require fetching all data, so we skip it here
    // The dashboard can calculate it from the full deliveries list if needed
    const stats = {
      total: totalResult.count || 0,
      pending: pendingResult.count || 0,
      inProgress: inProgressResult.count || 0,
      completed: completedResult.count || 0,
      failed: failedResult.count || 0,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('GET /api/deliveries/stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch delivery stats' },
      { status: 500 }
    )
  }
}
