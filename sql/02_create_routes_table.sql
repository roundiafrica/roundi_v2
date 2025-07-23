-- Create routes table
CREATE TABLE IF NOT EXISTS routes (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('active', 'completed', 'pending', 'cancelled')),
  total_distance DECIMAL(10,2), -- in kilometers
  estimated_duration INTEGER, -- in minutes
  start_location VARCHAR(255),
  end_location VARCHAR(255),
  efficiency_score INTEGER DEFAULT 0 CHECK (efficiency_score >= 0 AND efficiency_score <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create trigger for routes table
CREATE TRIGGER update_routes_updated_at 
  BEFORE UPDATE ON routes
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample routes
INSERT INTO routes (name, driver_id, status, total_distance, estimated_duration, start_location, end_location, efficiency_score) VALUES
('Nairobi Central Route', 1, 'active', 45.2, 150, 'Nairobi CBD', 'Eastlands', 92),
('Westlands Circuit', 2, 'completed', 32.8, 105, 'Westlands', 'Karen', 88),
('Eastlands Express', NULL, 'pending', 28.5, 80, 'Eastleigh', 'Donholm', 0),
('Karen-Langata Loop', 3, 'active', 38.7, 130, 'Karen', 'Langata', 95);

-- Enable RLS
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

-- Create policy for routes
CREATE POLICY "Allow all operations on routes" ON routes
FOR ALL USING (true) WITH CHECK (true); 