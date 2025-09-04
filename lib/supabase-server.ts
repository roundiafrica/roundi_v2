import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

// Create a server client that can handle authentication from cookies or headers
export function createSupabaseServerClient(request?: NextRequest) {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Prevent automatic token refresh on the server
        autoRefreshToken: false,
        // Don't persist session on server
        persistSession: false
      }
    }
  )

  return client
}

// Extract auth token from request headers or cookies
export function getAuthTokenFromRequest(request: NextRequest): string | null {
  console.log('getAuthTokenFromRequest called');
  
  // Try to get from Authorization header first
  const authHeader = request.headers.get('authorization')
  console.log('Authorization header:', authHeader);
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    console.log('Found token in Authorization header, length:', token.length);
    return token
  }

  // Try to get from cookies - check all possible cookie names
  const allCookies = Object.fromEntries(request.cookies);
  console.log('All cookies:', Object.keys(allCookies));
  
  const accessToken = request.cookies.get('sb-access-token')?.value ||
                     request.cookies.get('supabase-auth-token')?.value ||
                     request.cookies.get('sb-zolqvkpgiauqnjgujtvl-auth-token')?.value

  console.log('Token from cookies:', accessToken ? `Found (length: ${accessToken.length})` : 'Not found');

  return accessToken || null
}