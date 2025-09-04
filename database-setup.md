# Database Setup for API Keys

## Step 1: Check if API Keys Table Exists

Go to your Supabase dashboard and run this query in the SQL editor:

```sql
SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name = 'api_keys'
);
```

If this returns `false`, the table doesn't exist and you need to run the migration.

## Step 2: Create the API Keys Table

Run this SQL in your Supabase SQL editor:

```sql
-- Create api_keys table for API key management
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
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
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

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
            SELECT org.id::text FROM organization org
            WHERE org.user = auth.uid()
            UNION
            SELECT om.organization_id::text FROM organization_members om
            WHERE om.user_id = auth.uid()
        )
    );

-- Policy: Only organization owners can create/manage API keys
CREATE POLICY "Organization owners can manage API keys" ON api_keys
    FOR ALL USING (
        organization_id IN (
            SELECT org.id::text FROM organization org
            WHERE org.user = auth.uid()
        )
    );

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
```

## Step 3: Test the Table

Run this query to test if the table was created successfully:

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'api_keys' 
ORDER BY ordinal_position;
```

## Step 4: Check RLS Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'api_keys';
```

## Troubleshooting

### Issue: "relation api_keys does not exist"
**Solution:** The table hasn't been created. Run the migration SQL above.

### Issue: "permission denied for table api_keys"  
**Solution:** RLS policies might be blocking access. Check your user role and organization setup.

### Issue: "organization_id type mismatch"
**Solution:** Make sure your organization IDs are properly typed. The table expects UUID format.

## Testing

After running the migration, visit `/api/test` to verify:
- Authentication works
- Profile exists
- Organization exists  
- API keys table is accessible

The test endpoint will show you exactly what's working and what needs to be fixed.