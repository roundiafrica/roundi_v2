import { createHash, randomBytes } from 'crypto';
import { supabase } from '@/lib/supabase';

export interface ApiKey {
  id: string;
  user_id: string;
  organization_id: number;
  key_name: string;
  key_hash: string;
  key_prefix: string;
  platform: 'shopify' | 'woocommerce' | 'general';
  permissions: string[];
  status: 'active' | 'inactive' | 'revoked';
  last_used_at: string | null;
  expires_at: string | null;
  usage_count: number;
  rate_limit_per_hour: number;
  created_at: string;
  updated_at: string;
}

export interface CreateApiKeyRequest {
  keyName: string;
  platform: 'shopify' | 'woocommerce' | 'general';
  permissions?: string[];
  expiresAt?: string;
  rateLimitPerHour?: number;
}

export interface ApiKeyResponse {
  id: string;
  key_name: string;
  platform: string;
  key_prefix: string;
  status: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  usage_count: number;
  rate_limit_per_hour: number;
  full_key?: string; // Only returned when creating new key
}

// Generate a secure API key
export function generateApiKey(platform: 'shopify' | 'woocommerce' | 'general'): { fullKey: string; keyHash: string; keyPrefix: string } {
  const prefixMap = {
    shopify: 'rnd_shop_',
    woocommerce: 'rnd_woo_',
    general: 'rnd_api_'
  };

  const prefix = prefixMap[platform];
  const randomPart = randomBytes(24).toString('hex'); // 48 characters
  const fullKey = `${prefix}${randomPart}`;
  const keyHash = createHash('sha256').update(fullKey).digest('hex');

  return {
    fullKey,
    keyHash,
    keyPrefix: prefix
  };
}

// Hash an existing API key for verification
export function hashApiKey(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex');
}

// Validate API key format
export function validateApiKeyFormat(apiKey: string): boolean {
  const validPrefixes = ['rnd_shop_', 'rnd_woo_', 'rnd_api_'];
  const hasValidPrefix = validPrefixes.some(prefix => apiKey.startsWith(prefix));
  const hasValidLength = apiKey.length >= 32;
  
  return hasValidPrefix && hasValidLength;
}

// Create a new API key
export async function createApiKey(
  userId: string,
  organizationId: number,
  request: CreateApiKeyRequest
): Promise<{ success: boolean; data?: ApiKeyResponse; error?: string }> {
  try {
    const { fullKey, keyHash, keyPrefix } = generateApiKey(request.platform);

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        user_id: userId,
        organization_id: organizationId,
        key_name: request.keyName,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        platform: request.platform,
        permissions: request.permissions || [],
        expires_at: request.expiresAt,
        rate_limit_per_hour: request.rateLimitPerHour || 1000,
        status: 'active'
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating API key:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: {
        id: data.id,
        key_name: data.key_name,
        platform: data.platform,
        key_prefix: data.key_prefix,
        status: data.status,
        created_at: data.created_at,
        last_used_at: data.last_used_at,
        expires_at: data.expires_at,
        usage_count: data.usage_count,
        rate_limit_per_hour: data.rate_limit_per_hour,
        full_key: fullKey // Only return the full key when creating
      }
    };
  } catch (error) {
    console.error('Error creating API key:', error);
    return { success: false, error: 'Failed to create API key' };
  }
}

// Get all API keys for an organization
export async function getOrganizationApiKeys(
  organizationId: number
): Promise<{ success: boolean; data?: ApiKeyResponse[]; error?: string }> {
  try {
    console.log('getOrganizationApiKeys called with organizationId:', organizationId);

    // First, let's check if the api_keys table exists and has any data
    const { data: tableCheck, error: tableError } = await supabase
      .from('api_keys')
      .select('count')
      .limit(1);

    console.log('API keys table check:', { tableCheck, tableError });

    if (tableError) {
      console.error('API keys table does not exist or is not accessible:', tableError);
      return { 
        success: false, 
        error: `API keys table error: ${tableError.message}. Please run the database migration.` 
      };
    }

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    console.log('API keys query result:', { data, error, organizationId });

    if (error) {
      console.error('Error fetching API keys:', error);
      return { success: false, error: error.message };
    }

    const apiKeys = (data || []).map(key => ({
      id: key.id,
      key_name: key.key_name,
      platform: key.platform,
      key_prefix: key.key_prefix,
      status: key.status,
      created_at: key.created_at,
      last_used_at: key.last_used_at,
      expires_at: key.expires_at,
      usage_count: key.usage_count,
      rate_limit_per_hour: key.rate_limit_per_hour
    }));

    console.log('Processed API keys:', apiKeys);

    return { success: true, data: apiKeys };
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return { 
      success: false, 
      error: `Failed to fetch API keys: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

// Revoke an API key
export async function revokeApiKey(
  keyId: string,
  organizationId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('api_keys')
      .update({ status: 'revoked' })
      .eq('id', keyId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Error revoking API key:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error revoking API key:', error);
    return { success: false, error: 'Failed to revoke API key' };
  }
}

// Regenerate an API key
export async function regenerateApiKey(
  keyId: string,
  organizationId: number,
  platform: 'shopify' | 'woocommerce' | 'general'
): Promise<{ success: boolean; data?: { full_key: string }; error?: string }> {
  try {
    const { fullKey, keyHash, keyPrefix } = generateApiKey(platform);

    const { data, error } = await supabase
      .from('api_keys')
      .update({
        key_hash: keyHash,
        key_prefix: keyPrefix,
        usage_count: 0,
        last_used_at: null,
        status: 'active'
      })
      .eq('id', keyId)
      .eq('organization_id', organizationId)
      .select('*')
      .single();

    if (error) {
      console.error('Error regenerating API key:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: { full_key: fullKey } };
  } catch (error) {
    console.error('Error regenerating API key:', error);
    return { success: false, error: 'Failed to regenerate API key' };
  }
}

// Verify API key and get associated data
export async function verifyApiKey(
  apiKey: string
): Promise<{ success: boolean; data?: ApiKey; error?: string }> {
  try {
    if (!validateApiKeyFormat(apiKey)) {
      return { success: false, error: 'Invalid API key format' };
    }

    const keyHash = hashApiKey(apiKey);

    const { data, error } = await supabase
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('status', 'active')
      .single();

    if (error || !data) {
      return { success: false, error: 'Invalid or revoked API key' };
    }

    // Check if key is expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return { success: false, error: 'API key has expired' };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error verifying API key:', error);
    return { success: false, error: 'Failed to verify API key' };
  }
}

// Update API key usage
export async function updateApiKeyUsage(keyId: string): Promise<void> {
  try {
    await supabase.rpc('increment_api_key_usage', { key_id: keyId });
  } catch (error) {
    console.error('Error updating API key usage:', error);
  }
}