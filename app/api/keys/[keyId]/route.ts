import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revokeApiKey, regenerateApiKey } from '@/lib/services/api-keys';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const cookieStore = cookies();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Only owners can revoke API keys
    if (profile.role !== 'owner') {
      return NextResponse.json({ error: 'Only organization owners can revoke API keys' }, { status: 403 });
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

    // Revoke the API key
    const result = await revokeApiKey(params.keyId, org.id);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/keys/[keyId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const cookieStore = cookies();
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    // Get user from session
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Only owners can regenerate API keys
    if (profile.role !== 'owner') {
      return NextResponse.json({ error: 'Only organization owners can regenerate API keys' }, { status: 403 });
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

    // Parse request body to get platform
    const { platform } = await request.json();
    
    if (!platform || !['shopify', 'woocommerce', 'general'].includes(platform)) {
      return NextResponse.json({ 
        error: 'Invalid platform. Must be: shopify, woocommerce, or general' 
      }, { status: 400 });
    }

    // Regenerate the API key
    const result = await regenerateApiKey(params.keyId, org.id, platform);
    
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'API key regenerated successfully',
      data: result.data 
    });
  } catch (error) {
    console.error('Error in POST /api/keys/[keyId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}