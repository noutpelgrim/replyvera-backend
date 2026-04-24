import { supabase } from './src/db/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function checkLocations() {
    console.log('--- Checking locations in Supabase ---');
    try {
        const { data, error } = await supabase
            .from('locations')
            .select('*');
        if (error) throw error;
        console.log('Total locations in DB:', data.length);
        console.log(JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkLocations();
