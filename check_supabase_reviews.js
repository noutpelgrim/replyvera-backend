
import { supabase } from './src/db/index.js';

async function checkReviews() {
  console.log('--- Checking Latest Reviews via Supabase SDK ---');
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*, locations(business_name)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('❌ Error fetching reviews:', error.message);
      return;
    }

    if (!reviews || reviews.length === 0) {
      console.log('No reviews found.');
    } else {
      console.log('Recent Reviews:');
      console.log(JSON.stringify(reviews, null, 2));
    }
  } catch (err) {
    console.error('❌ Unexpected Error:', err);
  }
}

checkReviews();
