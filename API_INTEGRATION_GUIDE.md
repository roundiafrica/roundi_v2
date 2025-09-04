# API Integration Guide

## Overview

This guide covers how to integrate your Shopify or WooCommerce store with Roundi's delivery management system using API keys.

## Getting Started

### 1. Generate API Key

1. Log in to your Roundi dashboard as an organization owner
2. Go to Settings → Direct Integrations
3. Click "Generate API Key"
4. Choose your platform (Shopify, WooCommerce, or General)
5. Give your key a descriptive name
6. Copy and store your API key securely

**⚠️ Important**: The full API key is only shown once. Store it securely as it cannot be retrieved again.

## Authentication

All API requests must include your API key in the Authorization header:

```
Authorization: Bearer rnd_shop_your_api_key_here
```

or

```
Authorization: ApiKey rnd_shop_your_api_key_here
```

## API Endpoints

### Base URL
```
https://your-domain.com/api
```

### Rate Limiting
- Default: 1000 requests per hour per API key
- Rate limit headers are included in responses
- 429 status code returned when limit exceeded

---

## Webhook Endpoints

### Shopify Order Webhook

**Endpoint:** `POST /api/webhooks/shopify/orders`

**Purpose:** Automatically create deliveries when Shopify orders are placed.

**Setup in Shopify:**
1. Go to Settings → Notifications in your Shopify admin
2. Scroll down to "Webhooks" section
3. Click "Create webhook"
4. Set Event: "Order creation"
5. Set URL: `https://your-domain.com/api/webhooks/shopify/orders`
6. Set Format: JSON
7. Add Header: `Authorization: Bearer your_shopify_api_key`

**What it processes:**
- Only paid orders (`financial_status: 'paid'`)
- Orders with shipping addresses
- Creates delivery records automatically

### WooCommerce Order Webhook

**Endpoint:** `POST /api/webhooks/woocommerce/orders`

**Purpose:** Automatically create deliveries when WooCommerce orders are placed.

**Setup in WooCommerce:**
1. Install a webhook plugin or use WooCommerce REST API
2. Set URL: `https://your-domain.com/api/webhooks/woocommerce/orders`
3. Set Topic: `order.created` or `order.updated`
4. Add Header: `Authorization: Bearer your_woocommerce_api_key`

**What it processes:**
- Orders with status: processing, completed, on-hold
- Uses shipping address (falls back to billing address)
- Creates delivery records automatically

---

## REST API Endpoints

### Create Delivery

**Endpoint:** `POST /api/deliveries`

**Required Permissions:** `deliveries:write` or `deliveries:create`

**Request Body:**
```json
{
  "customer_name": "John Doe",
  "location": "123 Main St, City, State, ZIP",
  "coordinates": [-1.2921, 36.8219], // [latitude, longitude] - optional
  "item": "2x T-Shirt, 1x Jeans",
  "estimated_value": "99.99",
  "weight": "2kg",
  "phone": "+254700000000",
  "drop_time": "2024-01-20T14:00:00Z",
  "notes": "Ring doorbell twice"
}
```

**Response:**
```json
{
  "message": "Delivery created successfully",
  "delivery": {
    "id": 123,
    "customer_name": "John Doe",
    "location": "123 Main St, City, State, ZIP",
    "item": "2x T-Shirt, 1x Jeans",
    "phone": "+254700000000",
    "status": "pending",
    "drop_time": "2024-01-20T14:00:00Z",
    "created_at": "2024-01-19T10:30:00Z"
  }
}
```

### Get Deliveries

**Endpoint:** `GET /api/deliveries`

**Required Permissions:** `deliveries:read`

**Query Parameters:**
- `status` - Filter by status (pending, in-progress, completed, failed)
- `limit` - Number of results (default: 50, max: 100)
- `offset` - Pagination offset (default: 0)

**Response:**
```json
{
  "deliveries": [
    {
      "id": 123,
      "customer_name": "John Doe",
      "location": "123 Main St, City, State, ZIP",
      "item": "2x T-Shirt, 1x Jeans",
      "phone": "+254700000000",
      "status": "pending",
      "drop_time": "2024-01-20T14:00:00Z",
      "created_at": "2024-01-19T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "count": 1
  }
}
```

### Get Single Delivery

**Endpoint:** `GET /api/deliveries/{delivery_id}`

**Required Permissions:** `deliveries:read`

### Update Delivery

**Endpoint:** `PATCH /api/deliveries/{delivery_id}`

**Required Permissions:** `deliveries:write` or `deliveries:update`

**Request Body:**
```json
{
  "status": "completed",
  "assigned_to": 456,
  "delivered_at": "2024-01-20T15:30:00Z"
}
```

### Delete Delivery

**Endpoint:** `DELETE /api/deliveries/{delivery_id}`

**Required Permissions:** `deliveries:write` or `deliveries:delete`

---

## Error Responses

All errors return JSON with an `error` field:

```json
{
  "error": "Error description"
}
```

**Common HTTP Status Codes:**
- `400` - Bad Request (invalid data)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Rate Limited
- `500` - Internal Server Error

---

## API Key Management

### Permissions
API keys can have the following permissions:
- `deliveries:read` - Read delivery data
- `deliveries:write` - Create, update, delete deliveries
- `deliveries:create` - Create new deliveries
- `deliveries:update` - Update existing deliveries
- `deliveries:delete` - Delete deliveries
- `orders:write` - Process webhook orders
- `orders:create` - Create orders from webhooks
- `admin` - Full access to all operations

### Security Best Practices

1. **Store Securely**: Never expose API keys in client-side code
2. **Use HTTPS**: Always use secure connections
3. **Rotate Keys**: Regenerate keys periodically
4. **Monitor Usage**: Check API key usage in your dashboard
5. **Limit Permissions**: Only grant necessary permissions
6. **Revoke Unused Keys**: Remove keys that are no longer needed

### Rate Limiting

Each API key has a configurable rate limit (default: 1000 requests/hour). The following headers are included in responses:

- `X-RateLimit-Limit` - Request limit per hour
- `X-RateLimit-Remaining` - Requests remaining in current window
- `X-RateLimit-Reset` - Unix timestamp when limit resets

---

## Integration Examples

### Shopify Webhook Handler (Node.js)

```javascript
const express = require('express');
const crypto = require('crypto');

app.post('/shopify-webhook', (req, res) => {
  // Verify webhook (recommended for production)
  const hmac = req.get('X-Shopify-Hmac-Sha256');
  const body = JSON.stringify(req.body);
  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('base64');

  if (hash !== hmac) {
    return res.status(401).send('Unauthorized');
  }

  // Forward to Roundi
  fetch('https://your-domain.com/api/webhooks/shopify/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.ROUNDI_API_KEY}`
    },
    body: body
  });

  res.status(200).send('OK');
});
```

### Manual Delivery Creation (Python)

```python
import requests
import json
from datetime import datetime, timedelta

# Create delivery via API
delivery_data = {
    "customer_name": "Jane Smith",
    "location": "456 Oak Avenue, Nairobi, Kenya",
    "coordinates": [-1.2921, 36.8219],
    "item": "Electronics Package",
    "estimated_value": "150.00",
    "weight": "1.5kg",
    "phone": "+254722000000",
    "drop_time": (datetime.now() + timedelta(days=1)).isoformat() + "Z"
}

response = requests.post(
    'https://your-domain.com/api/deliveries',
    headers={
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {api_key}'
    },
    json=delivery_data
)

if response.status_code == 201:
    delivery = response.json()['delivery']
    print(f"Delivery created with ID: {delivery['id']}")
else:
    print(f"Error: {response.json()['error']}")
```

---

## Support

For technical support or questions about the API:
- Email: support@roundi.africa
- Phone: +254 722 235 314
- Documentation: [Link to full docs]

**Need help with integration?** Our team can assist with custom webhook setups and API integration consulting.