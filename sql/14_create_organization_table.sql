-- Create organization table (singular) for proper user-organization relationship
CREATE TABLE IF NOT EXISTS organization (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  user UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  address TEXT,
  website VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add trigger to automatically update updated_at timestamp
CREATE TRIGGER update_organization_updated_at 
    BEFORE UPDATE ON organization 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_organization_user ON organization(user);
CREATE INDEX IF NOT EXISTS idx_organization_created_at ON organization(created_at);

-- Add RLS (Row Level Security) policies
ALTER TABLE organization ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own organization
CREATE POLICY "Users can view own organization" ON organization
    FOR SELECT USING (user = auth.uid());

-- Policy: Users can only manage their own organization
CREATE POLICY "Users can manage own organization" ON organization
    FOR ALL USING (user = auth.uid());

-- Create organization_members table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_members (
  id SERIAL PRIMARY KEY,
  organization_id INTEGER REFERENCES organization(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Add indexes for organization_members
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);

-- Add RLS for organization_members
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see organization members for organizations they belong to
CREATE POLICY "Users can view org members" ON organization_members
    FOR SELECT USING (
        organization_id IN (
            SELECT org.id FROM organization org WHERE org.user = auth.uid()
            UNION
            SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
        )
    );

-- Policy: Only organization owners can manage members
CREATE POLICY "Organization owners can manage members" ON organization_members
    FOR ALL USING (
        organization_id IN (
            SELECT org.id FROM organization org WHERE org.user = auth.uid()
        )
    );