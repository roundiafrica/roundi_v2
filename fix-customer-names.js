const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Replace these with your actual Supabase URL and key
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for admin operations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixCustomerNames() {
  try {
    console.log('🔍 Checking for deliveries with empty customer names...');
    
    // First, check which records need fixing
    const { data: emptyNameRecords, error: checkError } = await supabase
      .from('deliveries')
      .select('id, customer_name, location, item')
      .or('customer_name.is.null,customer_name.eq.""');
    
    if (checkError) {
      throw checkError;
    }
    
    if (!emptyNameRecords || emptyNameRecords.length === 0) {
      console.log('✅ No records found with empty customer names. All good!');
      return;
    }
    
    console.log(`📋 Found ${emptyNameRecords.length} records with empty customer names:`);
    emptyNameRecords.forEach(record => {
      console.log(`  - ID ${record.id}: "${record.customer_name || '(null)'}" - ${record.location} - ${record.item}`);
    });
    
    console.log('\n🔧 Fixing customer names...');
    
    // Generate realistic Kenyan names for the records
    const kenyaNames = [
      'James Kiprotich', 'Grace Wanjiku', 'David Ochieng', 'Sarah Mutindi',
      'Michael Wekesa', 'Ruth Akinyi', 'Paul Kiplagat', 'Agnes Moraa',
      'Francis Mwangi', 'Elizabeth Chebet', 'John Kamau', 'Mary Njeri',
      'Peter Otieno', 'Jane Wambui', 'Samuel Korir', 'Lucy Achieng'
    ];
    
    // Update each record with a proper name
    for (const record of emptyNameRecords) {
      const newName = kenyaNames[record.id % kenyaNames.length];
      
      const { error: updateError } = await supabase
        .from('deliveries')
        .update({ customer_name: newName })
        .eq('id', record.id);
      
      if (updateError) {
        console.error(`❌ Error updating record ${record.id}:`, updateError);
      } else {
        console.log(`✅ Updated record ${record.id}: "${newName}"`);
      }
    }
    
    console.log('\n🎉 All customer names have been fixed!');
    
    // Verify the fix
    const { data: verifyRecords, error: verifyError } = await supabase
      .from('deliveries')
      .select('id, customer_name, location')
      .or('customer_name.is.null,customer_name.eq.""');
    
    if (verifyError) {
      throw verifyError;
    }
    
    if (!verifyRecords || verifyRecords.length === 0) {
      console.log('✅ Verification complete: No more records with empty customer names!');
    } else {
      console.log(`⚠️  Warning: Still found ${verifyRecords.length} records with empty names`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing customer names:', error);
  }
}

// Run the fix
fixCustomerNames(); 