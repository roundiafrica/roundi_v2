-- Create drivers table
CREATE TABLE IF NOT EXISTS drivers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255),
  avatar_url TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'on_break')),
  vehicle_type VARCHAR(100) NOT NULL,
  license_number VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create updated_at trigger function (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for drivers table
CREATE TRIGGER update_drivers_updated_at 
  BEFORE UPDATE ON drivers
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample drivers
INSERT INTO drivers (name, phone, email, vehicle_type, license_number, status) VALUES
('James Ochieng', '+254712345678', 'james@roundi.com', 'Motorcycle', 'KCA123D', 'active'),
('Sarah Muthoni', '+254723456789', 'sarah@roundi.com', 'Van', 'KCB456E', 'active'),
('David Kiprop', '+254734567890', 'david@roundi.com', 'Truck', 'KCC789F', 'on_break'),
('Grace Wanjiku', '+254745678901', 'grace@roundi.com', 'Motorcycle', 'KCD012G', 'active'),
('Peter Kamau', '+254756789012', 'peter@roundi.com', 'Van', 'KCE345H', 'inactive');

-- Enable RLS
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Create policy for drivers (allow all for now)
CREATE POLICY "Allow all operations on drivers" ON drivers
FOR ALL USING (true) WITH CHECK (true); 