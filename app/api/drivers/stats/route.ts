import { NextRequest, NextResponse } from 'next/server'
import { createAuthenticatedClient } from '@/lib/supabase'

/**
 * GET /api/drivers/stats
 *
 * Returns driver statistics using database aggregation for performance
 * Much faster than fetching all drivers just to count them
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
    const [totalResult, activeResult, inactiveResult, onBreakResult] = await Promise.all([
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', membership.organization_id),
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', membership.organization_id)
        .eq('status', 'active'),
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', membership.organization_id)
        .eq('status', 'inactive'),
      supabase
        .from('drivers')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', membership.organization_id)
        .eq('status', 'on_break'),
    ])

    const stats = {
      total: totalResult.count || 0,
      active: activeResult.count || 0,
      inactive: inactiveResult.count || 0,
      on_break: onBreakResult.count || 0,
    }

    return NextResponse.json(stats)
  } catch (error) {
    console.error('GET /api/drivers/stats error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch driver stats' },
      { status: 500 }
    )
  }
}
