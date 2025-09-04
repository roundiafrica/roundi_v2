import { NextRequest, NextResponse } from 'next/server';
import { withApiKeyAuth } from '@/lib/middleware/api-auth';
import { supabase } from '@/lib/supabase';
import { coordinatesToPoint } from '@/lib/supabase';

interface WooCommerceOrder {
  id: number;
  order_key: string;
  number: string;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  discount_total: string;
  discount_tax: string;
  shipping_total: string;
  shipping_tax: string;
  cart_tax: string;
  total: string;
  total_tax: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: Array<{
    id: number;
    name: string;
    product_id: number;
    variation_id: number;
    quantity: number;
    tax_class: string;
    subtotal: string;
    subtotal_tax: string;
    total: string;
    total_tax: string;
    price: number;
    meta_data: Array<{
      id: number;
      key: string;
      value: string;
    }>;
  }>;
  shipping_lines: Array<{
    id: number;
    method_title: string;
    method_id: string;
    instance_id: string;
    total: string;
    total_tax: string;
    taxes: any[];
    meta_data: any[];
  }>;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  customer_ip_address: string;
  customer_user_agent: string;
  created_via: string;
  customer_note: string;
  date_completed: string | null;
  date_paid: string | null;
  cart_hash: string;
}

async function handleWooCommerceOrderWebhook(request: NextRequest, context: any) {
  try {
    // Verify webhook is for WooCommerce platform
    if (context.platform !== 'woocommerce') {
      return NextResponse.json(
        { error: 'This endpoint only accepts WooCommerce webhooks' },
        { status: 400 }
      );
    }

    const order: WooCommerceOrder = await request.json();

    // Skip orders that are not processing, completed, or on-hold
    const validStatuses = ['processing', 'completed', 'on-hold'];
    if (!validStatuses.includes(order.status)) {
      return NextResponse.json({ 
        message: `Order skipped - status '${order.status}' not eligible for delivery` 
      });
    }

    // Use shipping address, fallback to billing if no shipping address
    const address = order.shipping.first_name ? order.shipping : order.billing;
    const customerName = `${address.first_name} ${address.last_name}`.trim();
    
    // Format address
    const addressParts = [
      address.address_1,
      address.address_2,
      address.city,
      address.state,
      address.postcode,
      address.country
    ].filter(Boolean);
    const fullAddress = addressParts.join(', ');

    // For WooCommerce, we might not have coordinates, so we'll set them to default
    // In a production environment, you'd want to geocode the address
    const coordinates = coordinatesToPoint([0, 0]); // Default coordinates - implement geocoding as needed

    // Prepare items list
    const items = order.line_items.map(item => 
      `${item.quantity}x ${item.name}`
    ).join(', ');

    // Use billing phone as WooCommerce doesn't typically have shipping phone
    const phone = order.billing.phone || '';

    // Calculate estimated delivery time (next business day as default)
    const deliveryTime = new Date();
    deliveryTime.setDate(deliveryTime.getDate() + 1);
    
    // Skip weekends
    if (deliveryTime.getDay() === 0) deliveryTime.setDate(deliveryTime.getDate() + 1); // Sunday
    if (deliveryTime.getDay() === 6) deliveryTime.setDate(deliveryTime.getDate() + 2); // Saturday

    // Calculate total weight if available in meta_data
    let totalWeight: string | null = null;
    for (const item of order.line_items) {
      const weightMeta = item.meta_data.find(meta => meta.key === '_weight');
      if (weightMeta) {
        // This is a simplified calculation - you might want more sophisticated logic
        const itemWeight = parseFloat(weightMeta.value) * item.quantity;
        if (!isNaN(itemWeight)) {
          totalWeight = totalWeight ? 
            `${parseFloat(totalWeight) + itemWeight}kg` : 
            `${itemWeight}kg`;
        }
        break;
      }
    }

    // Insert delivery into database
    const { data: delivery, error: deliveryError } = await supabase
      .from('deliveries')
      .insert({
        customer_name: customerName,
        location: fullAddress,
        coordinates: coordinates,
        item: items,
        estimated_value: order.total,
        weight: totalWeight,
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
    console.log(`WooCommerce order ${order.number} processed successfully`, {
      deliveryId: delivery.id,
      customerName,
      location: fullAddress,
      items,
      status: order.status
    });

    return NextResponse.json({ 
      message: 'Order processed successfully',
      delivery_id: delivery.id,
      order_number: order.number,
      order_status: order.status
    });

  } catch (error) {
    console.error('Error processing WooCommerce webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Apply API key authentication middleware
export const POST = withApiKeyAuth(handleWooCommerceOrderWebhook, ['orders:write', 'orders:create']);