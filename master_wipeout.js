import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function surgicalDelete() {
    console.log('🧼 Running Complete Clean-up...');
    
    // Delete all reviews using a safe uuid filter
    const { error: revErr } = await supabase.from('reviews').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (revErr) console.error('❌ Reviews Purge Error:', revErr.message);
    else console.log('✅ All reviews deleted.');

    // Delete old unknown locations
    const { error: locErr } = await supabase.from('locations').delete().eq('google_location_id', 'unknown');
    if (locErr) console.error('❌ Locations Purge Error:', locErr.message);
    else console.log('✅ Old unknown locations deleted.');
}

surgicalDelete();
