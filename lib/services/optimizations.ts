import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/supabase'

type RouteOptimization = Database['public']['Tables']['route_optimizations']['Row']
type RouteOptimizationInsert = Database['public']['Tables']['route_optimizations']['Insert']

export class OptimizationService {
  static async saveOptimization(optimization: RouteOptimizationInsert): Promise<RouteOptimization> {
    const { data, error } = await supabase
      .from('route_optimizations')
      .insert([optimization])
      .select()
      .single()

    if (error) {
      console.error('Error saving optimization:', error)
      throw error
    }

    return data
  }

  static async getOptimizationsByRoute(routeId: number): Promise<RouteOptimization[]> {
    const { data, error } = await supabase
      .from('route_optimizations')
      .select('*')
      .eq('route_id', routeId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching optimizations by route:', error)
      throw error
    }

    return data || []
  }

  static async getLatestOptimization(routeId: number): Promise<RouteOptimization | null> {
    const { data, error } = await supabase
      .from('route_optimizations')
      .select('*')
      .eq('route_id', routeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching latest optimization:', error)
      throw error
    }

    return data
  }

  static async markOptimizationAsApplied(id: number): Promise<RouteOptimization> {
    const { data, error } = await supabase
      .from('route_optimizations')
      .update({ applied: true })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Error marking optimization as applied:', error)
      throw error
    }

    return data
  }

  static async getOptimizationStats() {
    const { data, error } = await supabase
      .from('route_optimizations')
      .select('improvement_percent, time_saved, cost_savings, applied')

    if (error) {
      console.error('Error fetching optimization stats:', error)
      throw error
    }

    const stats = {
      total: data?.length || 0,
      applied: data?.filter(o => o.applied).length || 0,
      totalTimeSaved: data?.reduce((sum, o) => sum + (o.time_saved || 0), 0) || 0,
      totalCostSavings: data?.reduce((sum, o) => sum + (o.cost_savings || 0), 0) || 0,
      averageImprovement: data?.length 
        ? Math.round(data.reduce((sum, o) => sum + (o.improvement_percent || 0), 0) / data.length * 100) / 100
        : 0
    }

    return stats
  }

  static async deleteOptimization(id: number): Promise<void> {
    const { error } = await supabase
      .from('route_optimizations')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting optimization:', error)
      throw error
    }
  }

  static async getAppliedOptimizations(): Promise<RouteOptimization[]> {
    const { data, error } = await supabase
      .from('route_optimizations')
      .select('*')
      .eq('applied', true)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching applied optimizations:', error)
      throw error
    }

    return data || []
  }
} 