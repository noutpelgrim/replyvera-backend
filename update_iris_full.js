import { createClient } from '@supabase/supabase-js';

import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const s = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateIrisFull() {
    const fullText = "Everything was amazing! A place that truly feels like home. The staff is incredible. The dorms are cozy, and the common areas are perfect for socializing and unwinding. The kitchen is well-equipped and spotlessly clean. On top of that, the location couldn't be better. I'll be back without a second thought!";
    
    console.log('📝 Updating Iris Zagdoun to full Google text...');
    const { error } = await s.from('reviews')
        .update({ comment: fullText })
        .eq('reviewer_name', 'Iris Zagdoun');
    
    if (error) console.error('❌ Error:', error);
    else console.log('🚀 SUCCESS: Iris is now 100% identical to Google.');
}

updateIrisFull();
