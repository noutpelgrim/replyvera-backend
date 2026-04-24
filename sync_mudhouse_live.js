
import { syncGoogleReviews } from './src/services/googleSync.js';
import { supabase } from './src/db/index.js';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('--- Syncing Mudhouse Hostel Reviews ---');
    try {
        // 1. Get user ID for info@the-mud-house.com
        const { data: user } = await supabase.from('users').select('id').eq('email', 'info@the-mud-house.com').single();
        if (!user) throw new Error('User not found');

        // 2. These IDs are from the previous session for Mudhouse
        const googleAccountId = '106069903932269202511';
        const googleLocationId = '11776518367912781440';

        console.log('🔄 Starting sync...');
        const count = await syncGoogleReviews(user.id, googleAccountId, googleLocationId);
        console.log(`✅ Success! Synced ${count} reviews.`);

        // 3. Quick check of the database
        const { data: reviews } = await supabase
            .from('reviews')
            .select('reviewer_name, review_date, comment')
            .order('review_date', { ascending: false })
            .limit(5);
        
        console.log('\nLatest Reviews with Dates:');
        console.table(reviews);

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

run();
