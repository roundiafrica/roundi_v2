/**
 * GET /api/track?trackingNumber=XXX
 *
 * Public API endpoint for tracking deliveries
 * No authentication required - customers can check their package status
 *
 * Returns delivery status, location, and driver info if assigned
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase-server';
import { maskPhoneNumber } from '@/lib/privacy';

export interface TrackingResponse {
  success: boolean;
  delivery?: {
    trackingNumber: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    customerName: string;
    location: string;
    item: string;
    scheduledTime: string;
    deliveredAt?: string;
    attemptCount?: number;
    deliveryNotes?: string;
    proofOfDelivery?: string;
    customerRating?: number;
    customerFeedback?: string;
    driver?: {
      name: string;
      phone: string;
      vehicleType: string;
    };
    route?: {
      name: string;
      status: string;
    };
    timeline: Array<{
      status: string;
      timestamp: string;
      description: string;
    }>;
  };
  error?: string;
}


/**
 * Build timeline from delivery data
 */
function buildTimeline(delivery: any): Array<{ status: string; timestamp: string; description: string }> {
  const timeline: Array<{ status: string; timestamp: string; description: string }> = [];

  // Created
  if (delivery.created_at) {
    timeline.push({
      status: 'created',
      timestamp: delivery.created_at,
      description: 'Delivery order created',
    });
  }

  // Assigned to route
  if (delivery.route_id) {
    timeline.push({
      status: 'assigned',
      timestamp: delivery.updated_at || delivery.created_at,
      description: 'Assigned to delivery route',
    });
  }

  // In progress
  if (delivery.status === 'in-progress' || delivery.status === 'completed') {
    timeline.push({
      status: 'in-progress',
      timestamp: delivery.updated_at,
      description: 'Driver is on the way',
    });
  }

  // Completed
  if (delivery.status === 'completed' && delivery.delivered_at) {
    timeline.push({
      status: 'completed',
      timestamp: delivery.delivered_at,
      description: 'Package delivered successfully',
    });
  }

  // Failed
  if (delivery.status === 'failed') {
    timeline.push({
      status: 'failed',
      timestamp: delivery.updated_at,
      description: `Delivery attempt failed${delivery.attempt_count ? ` (Attempt ${delivery.attempt_count})` : ''}`,
    });
  }

  return timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

export async function GET(req: NextRequest): Promise<NextResponse<TrackingResponse>> {
  try {
    const { searchParams } = new URL(req.url);
    const trackingNumber = searchParams.get('trackingNumber');

    if (!trackingNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tracking number is required',
        },
        { status: 400 }
      );
    }

    // Use server Supabase client
    const supabase = await getSupabaseServer();

    // Fetch delivery with route and driver info, querying by tracking_id
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .select(`
        *,
        route:routes (
          id,
          name,
          status,
          driver:drivers (
            id,
            name,
            phone,
            vehicle_type
          )
        )
      `)
      .eq('tracking_id', trackingNumber)
      .maybeSingle();

    if (deliveryError) {
      console.error('[track] Database error:', deliveryError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to fetch tracking information',
        },
        { status: 500 }
      );
    }

    if (!delivery) {
      return NextResponse.json(
        {
          success: false,
          error: 'No delivery found with this tracking number',
        },
        { status: 404 }
      );
    }

    // Build response
    const deliveryAny = delivery as any;
    const route = deliveryAny.route as any;
    const driver = route?.driver as any;

    const response: TrackingResponse = {
      success: true,
      delivery: {
        trackingNumber: deliveryAny.tracking_id,
        status: deliveryAny.status,
        customerName: deliveryAny.customer_name,
        location: deliveryAny.location,
        item: deliveryAny.item,
        scheduledTime: deliveryAny.drop_time,
        deliveredAt: deliveryAny.delivered_at || undefined,
        attemptCount: deliveryAny.attempt_count || undefined,
        deliveryNotes: deliveryAny.delivery_notes || undefined,
        proofOfDelivery: deliveryAny.proof_of_delivery || undefined,
        customerRating: deliveryAny.customer_rating || undefined,
        customerFeedback: deliveryAny.customer_feedback || undefined,
        driver: driver ? {
          name: driver.name,
          phone: maskPhoneNumber(driver.phone), // PRIVACY: Masked phone number
          vehicleType: driver.vehicle_type,
        } : undefined,
        route: route ? {
          name: route.name,
          status: route.status,
        } : undefined,
        timeline: buildTimeline(delivery),
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('[track] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'An unexpected error occurred',
      },
      { status: 500 }
    );
  }
}
