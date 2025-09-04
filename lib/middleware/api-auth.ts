import { NextRequest } from 'next/server';
import { verifyApiKey, updateApiKeyUsage } from '@/lib/services/api-keys';

export interface ApiAuthContext {
  userId: string;
  organizationId: string;
  keyId: string;
  platform: string;
  permissions: string[];
  rateLimitPerHour: number;
}

export interface ApiAuthResult {
  success: boolean;
  context?: ApiAuthContext;
  error?: string;
  statusCode?: number;
}

// Rate limiting storage (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Clean up expired rate limit entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export async function authenticateApiKey(request: NextRequest): Promise<ApiAuthResult> {
  try {
    // Extract API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return {
        success: false,
        error: 'Missing Authorization header',
        statusCode: 401
      };
    }

    // Support both "Bearer" and "ApiKey" prefix
    const apiKey = authHeader.replace(/^(Bearer|ApiKey)\s+/i, '');
    
    if (!apiKey) {
      return {
        success: false,
        error: 'Invalid Authorization header format',
        statusCode: 401
      };
    }

    // Verify the API key
    const verification = await verifyApiKey(apiKey);
    
    if (!verification.success || !verification.data) {
      return {
        success: false,
        error: verification.error || 'Invalid API key',
        statusCode: 401
      };
    }

    const apiKeyData = verification.data;

    // Check rate limiting
    const rateLimitKey = `${apiKeyData.id}:${Math.floor(Date.now() / 3600000)}`; // Hour-based key
    const rateLimitData = rateLimitStore.get(rateLimitKey);
    const currentHour = Math.floor(Date.now() / 3600000) * 3600000;
    
    if (rateLimitData) {
      if (rateLimitData.count >= apiKeyData.rate_limit_per_hour) {
        return {
          success: false,
          error: 'Rate limit exceeded',
          statusCode: 429
        };
      }
      rateLimitData.count++;
    } else {
      rateLimitStore.set(rateLimitKey, {
        count: 1,
        resetTime: currentHour + 3600000 // Next hour
      });
    }

    // Update usage count (async, don't wait)
    updateApiKeyUsage(apiKeyData.id).catch(error => {
      console.error('Failed to update API key usage:', error);
    });

    // Return authentication context
    return {
      success: true,
      context: {
        userId: apiKeyData.user_id,
        organizationId: apiKeyData.organization_id,
        keyId: apiKeyData.id,
        platform: apiKeyData.platform,
        permissions: apiKeyData.permissions,
        rateLimitPerHour: apiKeyData.rate_limit_per_hour
      }
    };
  } catch (error) {
    console.error('Error in API key authentication:', error);
    return {
      success: false,
      error: 'Internal authentication error',
      statusCode: 500
    };
  }
}

// Middleware wrapper for API routes
export function withApiKeyAuth(
  handler: (request: NextRequest, context: ApiAuthContext) => Promise<Response>,
  requiredPermissions?: string[]
) {
  return async (request: NextRequest): Promise<Response> => {
    const authResult = await authenticateApiKey(request);
    
    if (!authResult.success || !authResult.context) {
      return new Response(
        JSON.stringify({ error: authResult.error }),
        {
          status: authResult.statusCode || 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check permissions if required
    if (requiredPermissions && requiredPermissions.length > 0) {
      const hasRequiredPermission = requiredPermissions.some(permission => 
        authResult.context!.permissions.includes(permission) ||
        authResult.context!.permissions.includes('admin')
      );

      if (!hasRequiredPermission) {
        return new Response(
          JSON.stringify({ 
            error: 'Insufficient permissions',
            required: requiredPermissions,
            provided: authResult.context.permissions
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    return handler(request, authResult.context);
  };
}

// Helper to check if API key has specific permission
export function hasPermission(context: ApiAuthContext, permission: string): boolean {
  return context.permissions.includes(permission) || context.permissions.includes('admin');
}

// Helper to get rate limit info
export function getRateLimitInfo(keyId: string): { remaining: number; resetTime: number } {
  const currentHour = Math.floor(Date.now() / 3600000);
  const rateLimitKey = `${keyId}:${currentHour}`;
  const rateLimitData = rateLimitStore.get(rateLimitKey);
  
  return {
    remaining: rateLimitData ? Math.max(0, 1000 - rateLimitData.count) : 1000,
    resetTime: (currentHour + 1) * 3600000
  };
}