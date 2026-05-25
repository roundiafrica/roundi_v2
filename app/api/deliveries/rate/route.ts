import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Public route - no authentication required
// Customers can rate deliveries using their tracking number

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { trackingNumber, rating, feedback } = body

    // Validate input
    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'Tracking number is required' },
        { status: 400 }
      )
    }

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      )
    }

    // Create Supabase client with service role to bypass RLS
    // This is safe because we're validating the tracking number
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Find delivery by tracking number
    const { data: delivery, error: findError } = await supabase
      .from('deliveries')
      .select('id, status, customer_rating')
      .eq('tracking_id', trackingNumber.trim())
      .maybeSingle()

    if (findError) {
      console.error('Error finding delivery:', findError)
      return NextResponse.json(
        { error: 'Failed to find delivery' },
        { status: 500 }
      )
    }

    if (!delivery) {
      return NextResponse.json(
        { error: 'Invalid tracking number' },
        { status: 404 }
      )
    }

    // Only allow rating completed deliveries
    if (delivery.status !== 'completed') {
      return NextResponse.json(
        { error: 'Only completed deliveries can be rated' },
        { status: 400 }
      )
    }

    // Check if already rated (optional - allow re-rating or prevent it)
    if (delivery.customer_rating) {
      return NextResponse.json(
        { error: 'This delivery has already been rated' },
        { status: 400 }
      )
    }

    // Update delivery with rating
    const { error: updateError } = await supabase
      .from('deliveries')
      .update({
        customer_rating: rating,
        customer_feedback: feedback || null
      })
      .eq('id', delivery.id)

    if (updateError) {
      console.error('Error updating delivery rating:', updateError)
      return NextResponse.json(
        { error: 'Failed to save rating' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, message: 'Rating submitted successfully' },
      { status: 200 }
    )
  } catch (error: any) {
    console.error('Unexpected error in POST /api/deliveries/rate:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
