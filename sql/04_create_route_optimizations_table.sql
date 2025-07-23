-- Create route_optimizations table
CREATE TABLE IF NOT EXISTS route_optimizations (
  id BIGSERIAL PRIMARY KEY,
  route_id BIGINT REFERENCES routes(id) ON DELETE CASCADE,
  algorithm_used VARCHAR(50) NOT NULL,
  original_distance DECIMAL(10,2) NOT NULL,
  optimized_distance DECIMAL(10,2) NOT NULL,
  improvement_percent DECIMAL(5,2) NOT NULL,
  time_saved INTEGER NOT NULL, -- in minutes
  cost_savings DECIMAL(10,2) NOT NULL, -- in KSh
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create index for better query performance
CREATE INDEX idx_route_optimizations_route_id ON route_optimizations(route_id);
CREATE INDEX idx_route_optimizations_applied ON route_optimizations(applied);

-- Enable RLS
ALTER TABLE route_optimizations ENABLE ROW LEVEL SECURITY;

-- Create policy for route_optimizations
CREATE POLICY "Allow all operations on route_optimizations" ON route_optimizations
FOR ALL USING (true) WITH CHECK (true); 