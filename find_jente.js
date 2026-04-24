
import { supabase } from './src/db/index.js';

async function findJente() {
  console.log('--- Searching for Jente Review ---');
  try {
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*, locations(business_name)')
      .ilike('reviewer_name', '%Jente%');

    if (error) {
      console.error('❌ Error fetching reviews:', error.message);
      return;
    }

    if (!reviews || reviews.length === 0) {
      console.log('No reviews found for Jente.');
    } else {
      console.log('Found Jente Reviews:');
      console.log(JSON.stringify(reviews, null, 2));
    }
  } catch (err) {
    console.error('❌ Unexpected Error:', err);
  }
}

findJente();
