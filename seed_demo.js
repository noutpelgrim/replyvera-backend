import { supabase } from './src/db/index.js';
import dotenv from 'dotenv';
dotenv.config();

const demoReviews = [
  {
    reviewer_name: "John Miller",
    rating: 5,
    comment: "This is easily the best coffee in the city. The atmosphere is cozy and the staff is incredibly friendly. I'll be back every morning!",
    status: "PENDING",
    drafted_reply: "Hi John! We're so glad you enjoyed the coffee and our cozy vibes. We'll be here waiting with a fresh brew tomorrow morning! ☕️"
  },
  {
    reviewer_name: "Elena Rodriguez",
    rating: 5,
    comment: "Fixed my car in record time and didn't overcharge me. Very honest people. Highly recommended for any automotive work.",
    status: "PENDING",
    drafted_reply: "Thank you for the kind words, Elena! Honesty and speed are what we strive for. We're happy to have your car back on the road! 🚗"
  },
  {
    reviewer_name: "Marcus Thorne",
    rating: 4,
    comment: "The food was incredible, especially the pasta. The only downside was a 20-minute wait even with a reservation. still worth it though.",
    status: "PENDING",
    drafted_reply: "Hi Marcus! We're thrilled you loved the pasta. 🍝 We apologize for the wait – we're working on our timing and hope to have you seated even faster next time! Appreciate the support."
  }
];

async function seed() {
  console.log("🌱 Seeding Demo Data for Video Clip...");

  try {
    // 1. Get the first user
    const { data: users, error: userError } = await supabase.from('users').select('id').limit(1);
    if (userError || !users.length) throw new Error("No users found to attach reviews to.");
    const userId = users[0].id;

    // 2. Get the first location
    const { data: locations, error: locError } = await supabase.from('locations').select('id').eq('user_id', userId).limit(1);
    if (locError || !locations.length) throw new Error("No locations found.");
    const locationId = locations[0].id;

    // 3. Clear old demo reviews if any (optional)
    await supabase.from('reviews').delete().eq('location_id', locationId);

    // 4. Insert new demo reviews
    for (const rev of demoReviews) {
      const { error } = await supabase.from('reviews').insert({
        ...rev,
        location_id: locationId,
        google_review_id: `demo_${Math.random().toString(36).substr(2, 9)}`
      });
      if (error) console.error("Error inserting review:", error);
    }

    console.log("✅ Seed complete. Dashboard should now look 'Full' for the recording.");
  } catch (err) {
    console.error("❌ Seed failed:", err.message);
  }
}

seed();
