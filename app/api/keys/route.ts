import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { 
  createApiKey, 
  getOrganizationApiKeys, 
  CreateApiKeyRequest 
} from '@/lib/services/api-keys';

export async function GET(request: NextRequest) {
  try {
    console.log('GET /api/keys called');
    
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    console.log('Authorization header present:', !!authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid Authorization header found');
      return NextResponse.json({ 
        error: 'No authentication token provided. Please include Authorization header.',
        debug: {
          hasAuthHeader: !!authHeader,
          authHeaderPrefix: authHeader?.substring(0, 20),
          allHeaders: Object.fromEntries(request.headers.entries())
        }
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    console.log('Extracted token length:', token.length);

    // Create Supabase client with service role for server-side operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    console.log('Auth result:', { user: !!user, error: authError?.message });
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Invalid authentication token. Please log in again.',
        details: authError?.message 
      }, { status: 401 });
    }

    console.log('User authenticated:', user.id, user.email);

    // Get user's profile to check role
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id);

    console.log('Profile query result:', { profiles, profileError, count: profiles?.length });

    if (profileError) {
      return NextResponse.json({ 
        error: 'Database error fetching profile', 
        details: profileError?.message
      }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ 
        error: 'User profile not found', 
        details: 'No profile exists for this user'
      }, { status: 404 });
    }

    // Use the first profile if multiple exist
    const profile = profiles[0];
    
    if (profiles.length > 1) {
      console.warn(`User ${user.id} has ${profiles.length} profiles, using the first one`);
    }

    // Get user's organization
    let organizationId: number;
    
    if (profile.role === 'owner') {
      console.log('User is owner, fetching organization...');
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id')
        .eq('user', user.id)
        .single();
        
      console.log('Organization query result:', { org, orgError });
        
      if (orgError || !org) {
        return NextResponse.json({ 
          error: 'Organization not found', 
          details: orgError?.message || 'No organization data',
          userRole: profile.role
        }, { status: 404 });
      }
      organizationId = org.id; // Keep as integer
    } else {
      console.log('User is not owner, fetching membership...');
      const { data: member, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();
        
      console.log('Member query result:', { member, memberError });
        
      if (memberError || !member) {
        return NextResponse.json({ 
          error: 'Organization membership not found', 
          details: memberError?.message || 'No membership data',
          userRole: profile.role
        }, { status: 404 });
      }
      organizationId = member.organization_id; // Keep as integer
    }

    console.log('Fetching API keys for organization:', organizationId);

    // Get organization API keys
    const result = await getOrganizationApiKeys(organizationId);
    
    console.log('API keys fetch result:', result);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: result.error || 'Failed to fetch API keys',
        organizationId 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      data: result.data || [],
      organizationId,
      count: result.data?.length || 0
    });
  } catch (error) {
    console.error('Error in GET /api/keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ 
        error: 'No authentication token provided. Please include Authorization header.'
      }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ 
        error: 'Invalid authentication token. Please log in again.',
        details: authError?.message 
      }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id);

    if (profileError) {
      return NextResponse.json({ 
        error: 'Database error fetching profile', 
        details: profileError?.message
      }, { status: 500 });
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json({ 
        error: 'User profile not found'
      }, { status: 404 });
    }

    // Use the first profile if multiple exist
    const profile = profiles[0];

    // Only owners can create API keys
    if (profile.role !== 'owner') {
      return NextResponse.json({ error: 'Only organization owners can create API keys' }, { status: 403 });
    }

    // Get user's organization (only owners have organizations)
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id')
      .eq('user', user.id)
      .single();
      
    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Parse request body
    const body: CreateApiKeyRequest = await request.json();
    
    // Validate required fields
    if (!body.keyName || !body.platform) {
      return NextResponse.json({ 
        error: 'Missing required fields: keyName, platform' 
      }, { status: 400 });
    }

    // Validate platform
    if (!['shopify', 'woocommerce', 'general'].includes(body.platform)) {
      return NextResponse.json({ 
        error: 'Invalid platform. Must be: shopify, woocommerce, or general' 
      }, { status: 400 });
    }

    // Create API key
    const result = await createApiKey(user.id, org.id, body);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ data: result.data }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}