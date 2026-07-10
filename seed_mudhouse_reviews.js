import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { draftReply } from './src/services/aiManager.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const SERPAPI_KEY = "7157fa4f16c69e5ebdd6435f5ab36c782748d6a288e79627db7b41b921fc0fa7";

async function seed() {
    console.log("🔍 Fetching live reviews for The Mudhouse Hostel via SerpApi...");
    try {
        // 1. Get User ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', 'noutpelgrim@hotmail.com')
            .single();
            
        if (userError || !user) throw new Error("User noutpelgrim@hotmail.com not found.");
        const userId = user.id;

        // 2. Get Location ID
        const { data: locations, error: locError } = await supabase
            .from('locations')
            .select('id, business_name')
            .eq('user_id', userId)
            .limit(1);
            
        if (locError || !locations.length) throw new Error("No locations found for user.");
        const location = locations[0];
        const locationId = location.id;

        // 3. Clear old reviews
        await supabase.from('reviews').delete().eq('location_id', locationId);

        // 4. Query SerpApi for Reviews
        const placeId = "0x8fd506bceca07999:0xf7ce350312927865";
        const reviewUrl = `https://serpapi.com/search.json?engine=google_maps_reviews&data_id=${placeId}&hl=en&sort_by=newestFirst&api_key=${SERPAPI_KEY}`;
        
        console.log("📡 Fetching reviews from SerpApi...");
        const res = await fetch(reviewUrl);
        const data = await res.json();
        const serpReviews = data.reviews || [];

        if (serpReviews.length === 0) {
            console.log("❌ No reviews returned from SerpApi.");
            return;
        }

        console.log(`✅ Retrieved ${serpReviews.length} reviews. Generating AI drafts and inserting...`);

        for (const r of serpReviews.slice(0, 10)) {
            const reviewerName = r.user.name;
            const rating = r.rating;
            const comment = r.snippet || "";
            
            // Check if already has a reply from Google (represented by r.response)
            const hasReply = !!r.response;
            const status = hasReply ? "PUBLISHED" : "PENDING";
            const currentReplyText = hasReply ? r.response.text : null;

            console.log(`✍️ Drafting reply for ${reviewerName} (${rating}⭐)`);
            let draftedReply = currentReplyText;
            if (!hasReply) {
                draftedReply = await draftReply(comment, rating, "Professional", location.business_name);
            }

            const { error: insertError } = await supabase
                .from('reviews')
                .insert({
                    location_id: locationId,
                    google_review_id: r.id || `google_${Math.random().toString(36).substr(2, 9)}`,
                    reviewer_name: reviewerName,
                    rating: rating,
                    comment: comment,
                    status: status,
                    drafted_reply: draftedReply
                });

            if (insertError) {
                console.error(`❌ Failed to insert review for ${reviewerName}:`, insertError.message);
            }
        }

        console.log("🎉 Seeding complete! Dashboard reviews are now actual reviews from The Mudhouse Hostel!");
    } catch (err) {
        console.error("❌ Seed failed:", err.message);
    }
}

seed();
