import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware/api-auth';
import { supabase } from '@/lib/supabase';
import { coordinatesToPoint } from '@/lib/supabase';

interface CreateDeliveryRequest {
  customer_name: string;
  location: string;
  coordinates?: [number, number]; // [latitude, longitude]
  item: string;
  estimated_value?: string;
  weight?: string;
  phone: string;
  drop_time: string; // ISO datetime string
  notes?: string;
}

interface UpdateDeliveryRequest {
  status?: 'pending' | 'in-progress' | 'completed' | 'failed';
  assigned_to?: number;
  delivered_at?: string;
  notes?: string;
}

async function handleCreateDelivery(request: NextRequest, context: any) {
  try {
    const body: CreateDeliveryRequest = await request.json();

    // Validate required fields
    const requiredFields: (keyof CreateDeliveryRequest)[] = ['customer_name', 'location', 'item', 'phone', 'drop_time'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return NextResponse.json({
        error: `Missing required fields: ${missingFields.join(', ')}`
      }, { status: 400 });
    }

    // Validate drop_time format
    const dropTime = new Date(body.drop_time);
    if (isNaN(dropTime.getTime())) {
      return NextResponse.json({
        error: 'Invalid drop_time format. Use ISO datetime string.'
      }, { status: 400 });
    }

    // Handle coordinates
    let coordinates: string;
    if (body.coordinates && Array.isArray(body.coordinates) && body.coordinates.length === 2) {
      const [lat, lng] = body.coordinates;
      if (typeof lat === 'number' && typeof lng === 'number' && 
          lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        coordinates = coordinatesToPoint([lat, lng]);
      } else {
        return NextResponse.json({
          error: 'Invalid coordinates. Latitude must be between -90 and 90, longitude between -180 and 180.'
        }, { status: 400 });
      }
    } else {
      // Default to origin point - should be geocoded in production
      coordinates = coordinatesToPoint([0, 0]);
    }

    // Insert delivery into database
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .insert({
        customer_name: body.customer_name,
        location: body.location,
        coordinates: coordinates,
        item: body.item,
        estimated_value: body.estimated_value,
        weight: body.weight,
        phone: body.phone,
        drop_time: body.drop_time,
        status: 'pending'
      })
      .select()
      .single();

    if (deliveryError) {
      console.error('Error creating delivery:', deliveryError);
      return NextResponse.json(
        { error: 'Failed to create delivery record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Delivery created successfully',
      delivery: {
        id: delivery.id,
        customer_name: delivery.customer_name,
        location: delivery.location,
        item: delivery.item,
        phone: delivery.phone,
        status: delivery.status,
        drop_time: delivery.drop_time,
        created_at: delivery.created_at
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating delivery:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleGetDeliveries(request: NextRequest, context: any) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('deliveries')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status && ['pending', 'in-progress', 'completed', 'failed'].includes(status)) {
      query = query.eq('status', status);
    }

    const { data: deliveries, error } = await query;

    if (error) {
      console.error('Error fetching deliveries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch deliveries' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      deliveries: deliveries || [],
      pagination: {
        limit,
        offset,
        count: deliveries?.length || 0
      }
    });

  } catch (error) {
    console.error('Error fetching deliveries:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Apply API key authentication middleware
export const POST = withApiKeyAuth(handleCreateDelivery, ['deliveries:write', 'deliveries:create']);
export const GET = withApiKeyAuth(handleGetDeliveries, ['deliveries:read']);