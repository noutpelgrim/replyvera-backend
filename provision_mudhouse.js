import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function provision() {
    console.log('👷 Provisioning Mudhouse Hostel...');
    
    // 1. Get User ID
    const { data: user, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', 'noutpelgrim@hotmail.com')
        .single();
        
    if (userError || !user) {
        console.error('❌ User not found:', userError?.message);
        return;
    }

    // 2. Insert Location
    const { error: locError } = await supabase
        .from('locations')
        .upsert({
            user_id: user.id,
            business_name: 'The Mudhouse Hostel',
            google_location_id: '15892556272551469032',
            google_account_id: '111003738096356772718'
        }, { onConflict: 'google_location_id' });

    if (locError) {
        console.error('❌ Location link failed:', locError.message);
    } else {
        console.log('✅ Successfully linked The Mudhouse Hostel to your dashboard!');
    }
}

provision();
