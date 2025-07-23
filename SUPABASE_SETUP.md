# Supabase Integration Setup Guide

This guide will help you set up Supabase for the Roundi delivery management system.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- Your Supabase project URL and anon key

## Step 1: Environment Variables

Create a `.env.local` file in your project root with the following variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://zolqvkpgiauqnjgujtvl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Replace `your_anon_key_here` with your actual Supabase anonymous key from your project settings.

## Step 2: Run Database Migrations

Execute the SQL files in the `sql/` directory in your Supabase SQL editor in the following order:

1. `01_create_drivers_table.sql` - Creates drivers table with sample data
2. `02_create_routes_table.sql` - Creates routes table with sample data  
3. `03_create_deliveries_table.sql` - Creates deliveries table with sample data
4. `04_create_route_optimizations_table.sql` - Creates route optimizations table

### Running the Migrations

1. Open your Supabase dashboard
2. Go to the SQL Editor
3. Copy and paste each SQL file content
4. Execute them in order

## Step 3: Database Schema Overview

### Tables Created

#### `drivers`
- Stores driver information (name, phone, vehicle type, etc.)
- Tracks driver status (active, inactive, on_break)

#### `routes` 
- Stores route information with optional driver assignment
- Tracks route metrics (distance, duration, efficiency)
- Links to drivers via foreign key

#### `deliveries`
- Stores individual delivery information
- Uses PostGIS POINT for coordinates
- Links to routes via foreign key
- Tracks delivery status and order

#### `route_optimizations`
- Stores optimization results and metrics
- Tracks which optimizations have been applied
- Links to routes for historical tracking

## Step 4: Data Services

The application includes comprehensive service classes:

- `DriverService` - Manage drivers and their status
- `RouteService` - Manage routes and assignments
- `DeliveryService` - Manage deliveries and coordinates
- `OptimizationService` - Track optimization history

## Step 5: Features Enabled

With Supabase integration, you get:

✅ **Real-time data persistence**  
✅ **Driver management and assignment**  
✅ **Route tracking and optimization history**  
✅ **Delivery status updates**  
✅ **Geographic coordinate storage**  
✅ **Performance analytics and statistics**  
✅ **Row Level Security (RLS) enabled**  

## Step 6: Testing the Integration

1. Start your development server: `npm run dev`
2. Navigate to the app
3. Check if data loads from Supabase instead of mock data
4. Test creating, updating, and deleting records

## Security Notes

- RLS (Row Level Security) is enabled on all tables
- Current policies allow all operations (development only)
- For production, implement proper authentication and authorization
- Consider adding user-specific policies based on your auth system

## Troubleshooting

### Common Issues

1. **Connection errors**: Verify your environment variables
2. **Permission errors**: Check RLS policies in Supabase
3. **Migration errors**: Ensure PostGIS is enabled for coordinates
4. **Type errors**: Make sure TypeScript types match your schema

### Environment Variables Not Loading

Make sure:
- `.env.local` is in your project root
- Variables start with `NEXT_PUBLIC_` for client-side access
- Restart your development server after adding variables

### PostGIS Coordinates

If you have issues with coordinates:
```sql
-- Enable PostGIS extension if needed
CREATE EXTENSION IF NOT EXISTS postgis;
```

## Next Steps

1. Replace mock data in components with Supabase service calls
2. Implement proper error handling and loading states
3. Add real-time subscriptions for live updates
4. Set up proper authentication and user management
5. Configure production RLS policies

## Support

For Supabase-specific issues, check:
- [Supabase Documentation](https://supabase.com/docs)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables) 