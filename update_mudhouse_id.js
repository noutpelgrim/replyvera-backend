import { supabase } from './src/db/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function updateMudhouseId() {
    const REAL_ID = '0x8fd506bceca07999:0xf7ce350312927865';
    console.log(`Updating The Mudhouse Hostel with ID: ${REAL_ID}`);
    
    try {
        const { data, error } = await supabase
            .from('locations')
            .update({ google_location_id: REAL_ID })
            .eq('business_name', 'The Mudhouse Hostel')
            .select();
            
        if (error) throw error;
        console.log('✅ Success! Database updated.', data);
    } catch (err) {
        console.error('❌ Failed:', err.message);
    }
}

updateMudhouseId();
