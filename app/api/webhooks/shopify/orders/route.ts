import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware/api-auth';
import { supabase } from '@/lib/supabase';
import { coordinatesToPoint } from '@/lib/supabase';

interface ShopifyOrder {
  id: number;
  order_number: string;
  customer: {
    first_name: string;
    last_name: string;
    phone: string | null;
    email: string;
  };
  shipping_address: {
    first_name: string;
    last_name: string;
    company: string | null;
    address1: string;
    address2: string | null;
    city: string;
    province: string;
    country: string;
    zip: string;
    phone: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  line_items: Array<{
    id: number;
    name: string;
    quantity: number;
    price: string;
    product_id: number;
    variant_id: number;
  }>;
  total_weight: number;
  total_price: string;
  created_at: string;
  updated_at: string;
  financial_status: string;
  fulfillment_status: string | null;
}

async function handleShopifyOrderWebhook(request: NextRequest, context: any) {
  try {
    // Verify webhook is for Shopify platform
    if (context.platform !== 'shopify') {
      return NextResponse.json(
        { error: 'This endpoint only accepts Shopify webhooks' },
        { status: 400 }
      );
    }

    const order: ShopifyOrder = await request.json();

    // Skip orders without shipping address or that are not paid
    if (!order.shipping_address || order.financial_status !== 'paid') {
      return NextResponse.json({ message: 'Order skipped - no shipping address or not paid' });
    }

    // Extract delivery information
    const customerName = `${order.customer.first_name} ${order.customer.last_name}`.trim();
    const shippingAddress = order.shipping_address;
    
    // Format address
    const addressParts = [
      shippingAddress.address1,
      shippingAddress.address2,
      shippingAddress.city,
      shippingAddress.province,
      shippingAddress.zip,
      shippingAddress.country
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    // Handle coordinates
    let coordinates: string | null = null;
    if (shippingAddress.latitude && shippingAddress.longitude) {
      coordinates = coordinatesToPoint([shippingAddress.latitude, shippingAddress.longitude]);
    }

    // Prepare items list
    const items = order.line_items.map(item => 
      `${item.quantity}x ${item.name}`
    ).join(', ');

    // Determine phone number (priority: shipping address phone, then customer phone)
    const phone = shippingAddress.phone || order.customer.phone || '';

    // Calculate estimated delivery time (next business day as default)
    const deliveryTime = new Date();
    deliveryTime.setDate(deliveryTime.getDate() + 1);
    
    // Skip weekends
    if (deliveryTime.getDay() === 0) deliveryTime.setDate(deliveryTime.getDate() + 1); // Sunday
    if (deliveryTime.getDay() === 6) deliveryTime.setDate(deliveryTime.getDate() + 2); // Saturday

    // Insert delivery into database
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .insert({
        customer_name: customerName,
        location: fullAddress,
        coordinates: coordinates || `POINT(0 0)`, // Default coordinates if not provided
        item: items,
        estimated_value: order.total_price,
        weight: order.total_weight ? `${order.total_weight}g` : null,
        phone: phone,
        drop_time: deliveryTime.toISOString(),
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

    // Log the webhook for tracking
    console.log(`Shopify order ${order.order_number} processed successfully`, {
      deliveryId: delivery.id,
      customerName,
      location: fullAddress,
      items
    });

    return NextResponse.json({ 
      message: 'Order processed successfully',
      delivery_id: delivery.id,
      order_number: order.order_number
    });

  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Apply API key authentication middleware
export const POST = withApiKeyAuth(handleShopifyOrderWebhook, ['orders:write', 'orders:create']);