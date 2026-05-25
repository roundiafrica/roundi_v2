import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * GET /api/collection-points/stats
 *
 * Returns collection point statistics using database aggregation for performance
 * Much faster than fetching all collection points just to count them
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
    const [totalResult, activeResult, inactiveResult] = await Promise.all([
      supabase
        .from('collection_points')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id),
      supabase
        .from('collection_points')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id)
        .eq('status', 'active'),
      supabase
        .from('collection_points')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', membership.organization_id)
        .eq('status', 'inactive'),
    ])

    const stats = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      inactive: inactiveResult.count || 0,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('GET /api/collection-points/stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch collection point stats' },
      { status: 500 }
    )
  }
}
