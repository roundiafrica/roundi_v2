import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware/api-auth';
import { supabase } from '@/lib/supabase';

interface UpdateDeliveryRequest {
  status?: 'pending' | 'in-progress' | 'completed' | 'failed';
  assigned_to?: number;
  delivered_at?: string;
}

async function handleGetDelivery(
  request: NextRequest, 
  context: any,
  params: { deliveryId: string }
) {
  try {
    const { data: delivery, error } = await supabase
      .from('deliveries')
      .select('*')
      .eq('id', params.deliveryId)
      .single();

    if (error || !delivery) {
      return NextResponse.json(
        { error: 'Delivery not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ delivery });

  } catch (error) {
    console.error('Error fetching delivery:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleUpdateDelivery(
  request: NextRequest, 
  context: any,
  params: { deliveryId: string }
) {
  try {
    const body: UpdateDeliveryRequest = await request.json();

    // Validate status if provided
    if (body.status && !['pending', 'in-progress', 'completed', 'failed'].includes(body.status)) {
      return NextResponse.json({
        error: 'Invalid status. Must be: pending, in-progress, completed, or failed'
      }, { status: 400 });
    }

    // Validate delivered_at format if provided
    if (body.delivered_at) {
      const deliveredAt = new Date(body.delivered_at);
      if (isNaN(deliveredAt.getTime())) {
        return NextResponse.json({
          error: 'Invalid delivered_at format. Use ISO datetime string.'
        }, { status: 400 });
      }
    }

    // If status is being set to completed, automatically set delivered_at
    const updateData = { ...body };
    if (body.status === 'completed' && !body.delivered_at) {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data: delivery, error } = await supabase
      .from('deliveries')
      .update(updateData)
      .eq('id', params.deliveryId)
      .select()
      .single();

    if (error) {
      console.error('Error updating delivery:', error);
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Delivery not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to update delivery' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Delivery updated successfully',
      delivery: {
        id: delivery.id,
        customer_name: delivery.customer_name,
        location: delivery.location,
        item: delivery.item,
        phone: delivery.phone,
        status: delivery.status,
        drop_time: delivery.drop_time,
        assigned_to: delivery.assigned_to,
        delivered_at: delivery.delivered_at,
        updated_at: delivery.updated_at
      }
    });

  } catch (error) {
    console.error('Error updating delivery:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleDeleteDelivery(
  request: NextRequest, 
  context: any,
  params: { deliveryId: string }
) {
  try {
    const { error } = await supabase
      .from('deliveries')
      .delete()
      .eq('id', params.deliveryId);

    if (error) {
      console.error('Error deleting delivery:', error);
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Delivery not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to delete delivery' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Delivery deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting delivery:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Wrapper to handle params correctly for the withApiKeyAuth middleware
const createHandlerWithParams = (handler: any) => {
  return async (request: NextRequest, context: any) => {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const deliveryId = pathParts[pathParts.length - 1];
    
    return handler(request, context, { deliveryId });
  };
};

// Apply API key authentication middleware
export const GET = withApiKeyAuth(createHandlerWithParams(handleGetDelivery), ['deliveries:read']);
export const PATCH = withApiKeyAuth(createHandlerWithParams(handleUpdateDelivery), ['deliveries:write', 'deliveries:update']);
export const DELETE = withApiKeyAuth(createHandlerWithParams(handleDeleteDelivery), ['deliveries:write', 'deliveries:delete']);