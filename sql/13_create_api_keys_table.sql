-- Create api_keys table for API key management
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix VARCHAR(10) NOT NULL,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('shopify', 'woocommerce', 'general')),
  permissions TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'revoked')),
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,
  rate_limit_per_hour INTEGER DEFAULT 1000,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger to automatically update updated_at timestamp
CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON api_keys 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_organization_id ON api_keys(organization_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_platform ON api_keys(platform);
CREATE INDEX IF NOT EXISTS idx_api_keys_status ON api_keys(status);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_at ON api_keys(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own organization's API keys
CREATE POLICY "Users can view own org API keys" ON api_keys
    FOR SELECT USING (
        organization_id IN (
            SELECT org.id FROM organization org
            WHERE org.user = auth.uid()
            UNION
            SELECT om.organization_id FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- Policy: Only organization owners can create/manage API keys
CREATE POLICY "Organization owners can manage API keys" ON api_keys
    FOR ALL USING (
        organization_id IN (
            SELECT org.id FROM organization org
            WHERE org.user = auth.uid()
        )
    );

-- Create function to generate API key prefix
CREATE OR REPLACE FUNCTION generate_api_key_prefix(platform_name TEXT)
RETURNS TEXT AS $$
BEGIN
    CASE platform_name
        WHEN 'shopify' THEN RETURN 'rnd_shop_';
        WHEN 'woocommerce' THEN RETURN 'rnd_woo_';
        ELSE RETURN 'rnd_api_';
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate API key format
CREATE OR REPLACE FUNCTION validate_api_key_format(api_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- API key should be at least 32 characters and start with proper prefix
    RETURN (
        LENGTH(api_key) >= 32 AND 
        (api_key LIKE 'rnd\_shop\_%' OR api_key LIKE 'rnd\_woo\_%' OR api_key LIKE 'rnd\_api\_%')
    );
END;
$$ LANGUAGE plpgsql;

-- Create function to increment API key usage
CREATE OR REPLACE FUNCTION increment_api_key_usage(key_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE api_keys 
    SET 
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = key_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;