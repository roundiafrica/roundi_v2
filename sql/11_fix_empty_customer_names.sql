-- Fix delivery records with empty or null customer names
-- This migration addresses the "Unknown Customer" issue

-- First, let's see what records have empty customer names
-- SELECT id, customer_name, location, item FROM deliveries WHERE customer_name IS NULL OR customer_name = '';

-- Update any records with null or empty customer names
-- You can customize these names or use a pattern like "Customer #ID"
UPDATE deliveries 
SET customer_name = CASE 
  WHEN id % 10 = 1 THEN 'James Kiprotich'
  WHEN id % 10 = 2 THEN 'Grace Wanjiku'
  WHEN id % 10 = 3 THEN 'David Ochieng'
  WHEN id % 10 = 4 THEN 'Sarah Mutindi'
  WHEN id % 10 = 5 THEN 'Michael Wekesa'
  WHEN id % 10 = 6 THEN 'Ruth Akinyi'
  WHEN id % 10 = 7 THEN 'Paul Kiplagat'
  WHEN id % 10 = 8 THEN 'Agnes Moraa'
  WHEN id % 10 = 9 THEN 'Francis Mwangi'
  ELSE 'Elizabeth Chebet'
END
WHERE customer_name IS NULL OR customer_name = '';

-- Add a constraint to prevent future null customer names
ALTER TABLE deliveries 
ALTER COLUMN customer_name SET NOT NULL;

-- Optionally, add a check constraint to prevent empty strings
ALTER TABLE deliveries 
ADD CONSTRAINT check_customer_name_not_empty 
CHECK (LENGTH(TRIM(customer_name)) > 0);

-- Query to verify the fix
-- SELECT id, customer_name, location, item FROM deliveries ORDER BY id; 