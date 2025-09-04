import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, getAuthTokenFromRequest } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient(request);
    
    // Get auth token from request
    const token = getAuthTokenFromRequest(request);
    
    if (!token) {
      return NextResponse.json({
        authenticated: false,
        error: 'No authentication token found',
        debug: {
          cookies: Object.fromEntries(request.cookies),
          headers: Object.fromEntries(request.headers.entries())
        }
      });
    }

    // Test authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({
        authenticated: false,
        error: authError?.message || 'No user',
      });
    }

    // Test profile query
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    // Test organization query
    let orgInfo = null;
    if (profile?.role === 'owner') {
      const { data: org, error: orgError } = await supabase
        .from('organization')
        .select('*')
        .eq('user', user.id)
        .single();
      
      orgInfo = { org, orgError: orgError?.message };
    }

    // Test api_keys table existence
    const { data: apiKeysTest, error: apiKeysError } = await supabase
      .from('api_keys')
      .select('count')
      .limit(1);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profile,
      profileError: profileError?.message,
      organization: orgInfo,
      apiKeysTableExists: !apiKeysError,
      apiKeysError: apiKeysError?.message,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });

  } catch (error) {
    console.error('Test endpoint error:', error);
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}