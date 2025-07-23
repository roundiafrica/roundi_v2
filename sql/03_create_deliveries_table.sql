-- Create deliveries table
CREATE TABLE IF NOT EXISTS deliveries (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT REFERENCES routes(id) ON DELETE SET NULL,
  farmer_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  coordinates POINT NOT NULL, -- PostGIS point for lat/lng
  produce VARCHAR(255) NOT NULL,
  estimated_value VARCHAR(50),
  weight VARCHAR(50),
  phone VARCHAR(20) NOT NULL,
  drop_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'completed', 'failed')),
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create trigger for deliveries table
CREATE TRIGGER update_deliveries_updated_at 
  BEFORE UPDATE ON deliveries
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert sample deliveries for Nairobi Central Route (route_id = 1)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(1, 'John Kamau', 'CBD Market', POINT(-1.2864, 36.8172), 'Tomatoes', 'KSh 2,500', '5kg', '+254712345678', '09:00', 'completed', 1),
(1, 'Mary Wanjiku', 'City Hall', POINT(-1.2921, 36.8219), 'Carrots', 'KSh 1,800', '3kg', '+254723456789', '09:30', 'completed', 2),
(1, 'Peter Mutua', 'Railway Station', POINT(-1.3067, 36.8321), 'Potatoes', 'KSh 3,200', '8kg', '+254734567890', '10:00', 'in-progress', 3),
(1, 'Grace Akinyi', 'Central Park', POINT(-1.2884, 36.8233), 'Onions', 'KSh 2,100', '5kg', '+254745678901', '10:30', 'pending', 4);

-- Insert sample deliveries for Westlands Circuit (route_id = 2)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(2, 'Samuel Kiprotich', 'Westlands Mall', POINT(-1.2676, 36.8099), 'Spinach', 'KSh 1,500', '2kg', '+254756789012', '08:00', 'completed', 1),
(2, 'Ruth Njeri', 'Sarit Centre', POINT(-1.2689, 36.8076), 'Kales', 'KSh 1,200', '4kg', '+254767890123', '08:45', 'completed', 2),
(2, 'Joseph Mwangi', 'ABC Place', POINT(-1.2643, 36.8123), 'Cabbages', 'KSh 2,000', '6kg', '+254778901234', '09:30', 'completed', 3);

-- Insert sample deliveries for Eastlands Express (route_id = 3)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(3, 'Agnes Wambui', 'Eastleigh Market', POINT(-1.2741, 36.8441), 'Bananas', 'KSh 1,800', '10kg', '+254789012345', '07:30', 'pending', 1),
(3, 'David Omondi', 'Donholm Shopping', POINT(-1.2945, 36.8876), 'Maize', 'KSh 3,500', '15kg', '+254790123456', '08:15', 'pending', 2),
(3, 'Helen Chebet', 'Umoja Market', POINT(-1.2834, 36.8765), 'Beans', 'KSh 2,200', '8kg', '+254701234567', '09:00', 'pending', 3);

-- Insert sample deliveries for Karen-Langata Loop (route_id = 4)
INSERT INTO deliveries (route_id, farmer_name, location, coordinates, produce, estimated_value, weight, phone, drop_time, status, order_index) VALUES
(4, 'Michael Wekesa', 'Karen Shopping', POINT(-1.3197, 36.7085), 'Avocados', 'KSh 4,000', '12kg', '+254712345679', '10:00', 'in-progress', 1),
(4, 'Susan Moraa', 'Junction Mall', POINT(-1.3037, 36.7324), 'Mangoes', 'KSh 3,200', '8kg', '+254723456780', '10:45', 'completed', 2),
(4, 'Francis Kiplagat', 'Langata Link', POINT(-1.3654, 36.7208), 'Oranges', 'KSh 2,800', '10kg', '+254734567891', '11:30', 'pending', 3);

-- Create index for better query performance
CREATE INDEX idx_deliveries_route_id ON deliveries(route_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_deliveries_coordinates ON deliveries USING GIST (coordinates);

-- Enable RLS
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

-- Create policy for deliveries
CREATE POLICY "Allow all operations on deliveries" ON deliveries
FOR ALL USING (true) WITH CHECK (true); 