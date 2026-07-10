import { syncGoogleReviews } from './src/services/emergencySync.js';
import { supabase } from './src/db/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function test() {
    console.log('🏃 Running emergency sync test...');
    try {
        const { data: user } = await supabase.from('users').select('id').eq('email', 'noutpelgrim@hotmail.com').single();
        if (!user) throw new Error('User not found');
        
        console.log('User ID:', user.id);
        const count = await syncGoogleReviews(user.id);
        console.log('✅ Sync completed. Total synced:', count);
    } catch (err) {
        console.error('❌ Error during sync:', err.stack || err.message);
    }
}

test();
