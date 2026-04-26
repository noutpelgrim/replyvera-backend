import { supabase } from '../db/index.js';
import { getOAuth2Client } from './googleAuth.js';
import { listGoogleAccounts, listGoogleLocations } from './googleSync.js';
import { draftReply } from './aiManager.js';

/**
 * Syncs reviews from a Google location into the database.
 * This version uses an "Emergency Refresh" strategy to re-discover IDs directly from Google.
 */
export async function syncGoogleReviews(userId) {
    const { data: tokens } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (!tokens) throw new Error('User not connected to Google');
    const auth = getOAuth2Client(tokens, userId);

    // 1. DISCOVERY: Check local DB first to avoid Quota hammering
    let { data: loc } = await supabase
        .from('locations')
        .select('*')
        .eq('user_id', userId)
        .not('google_account_id', 'is', null)
        .not('google_location_id', 'is', null)
        .limit(1)
        .maybeSingle();

    let cleanAccountId, cleanLocationId, businessName;

    if (loc) {
        console.log(`🧠 Using MEMORIZED IDs for ${loc.business_name} (Saves Quota!)`);
        // FORCE SANITIZE: Strip any recursive prefixes found in the DB
        cleanAccountId = loc.google_account_id.toString().replace(/accounts\//g, '');
        cleanLocationId = loc.google_location_id.toString().replace(/locations\//g, '');
        businessName = loc.business_name;
    } else {
        console.log(`📡 Emergency Refresh: Identifying fresh Google IDs for user ${userId}...`);
        const allAccounts = await listGoogleAccounts(userId);
        if (allAccounts.length === 0) throw new Error('No Google Business accounts found.');
        
        // Use regex global replace to catch any "accounts/accounts/..." errors from Google
        cleanAccountId = allAccounts[0].name.replace(/accounts\//g, '');
        
        const locs = await listGoogleLocations(allAccounts[0].name, userId);
        if (locs.length === 0) throw new Error('No locations found in this Google account.');

        cleanLocationId = locs[0].name.replace(/locations\//g, '');
        businessName = locs[0].title;
        console.log(`🎯 Target Discovered: ${businessName} (Acc: ${cleanAccountId}, Loc: ${cleanLocationId})`);
        
        // Auto-enroll to save for next time (CLEAN VERSION)
        const { data: newLoc } = await supabase
            .from('locations')
            .upsert([{
                user_id: userId,
                google_location_id: cleanLocationId,
                gbp_location_id: cleanLocationId,
                google_account_id: cleanAccountId,
                business_name: businessName,
                tone_preference: 'Professional'
            }], { onConflict: 'google_location_id' })
            .select('*')
            .single();
        loc = newLoc;
    }

    // 3. SYNC: Try multiple API paths (Modern v1, Legacy v4, and Business Info v1)
    let allReviews = [];
    let pageToken = null;
    const endpoints = [
        `https://mybusinessreviews.googleapis.com/v1/accounts/${cleanAccountId}/locations/${cleanLocationId}/reviews`,
        `https://mybusiness.googleapis.com/v4/accounts/${cleanAccountId}/locations/${cleanLocationId}/reviews`,
        `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${cleanAccountId}/locations/${cleanLocationId}/reviews`,
        `https://mybusiness.googleapis.com/v1/accounts/${cleanAccountId}/locations/${cleanLocationId}/reviews`
    ];

    let success = false;
    let lastErr = null;

    for (const url of endpoints) {
        if (success) break;
        try {
            console.log(`📡 Trying sync path: ${url}`);
            const res = await auth.request({ url, method: 'GET', params: pageToken ? { pageToken } : {} });
            allReviews = res.data.reviews || [];
            pageToken = res.data.nextPageToken;
            success = true;
            console.log(`✅ Success with path: ${url.split('/')[2]}`);
        } catch (err) {
            lastErr = err;
            const status = err.response?.status;
            const message = err.response?.data?.error?.message || err.message;
            console.log(`⚠️ Path failed: ${url.split('/')[2]} (Status: ${status}, Msg: ${message})`);
            
            // If it's a "Not Enabled" error, we capture the exact API name for the user
            if (message.includes('not been used in project') || message.includes('disabled')) {
                throw new Error(`CRITICAL: Google API not enabled. Please enable the "My Business Reviews API" in your Google Console. (${message})`);
            }
        }
    }

    if (!success) throw lastErr || new Error('All sync paths failed.');

    // 4. SAVE: Process and store reviews
    console.log(`✅ Total reviews fetched: ${allReviews.length}`);
    for (let i = 0; i < allReviews.length; i++) {
        const rev = allReviews[i];
        const { reviewId, reviewer, starRating, comment, createTime } = rev;
        const ratingNum = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }[starRating] || 5;

        const { data: existing } = await supabase.from('reviews').select('id').eq('google_review_id', reviewId).single();
        if (existing) continue;

        console.log(`🤖 Drafting reply for ${reviewer.displayName}...`);
        const aiDraft = await draftReply(comment || '', ratingNum, loc.tone_preference, loc.business_name);

        await supabase.from('reviews').insert([{
            location_id: loc.id,
            google_review_id: reviewId,
            reviewer_name: reviewer.displayName,
            rating: ratingNum,
            comment: comment || '',
            review_date: createTime,
            drafted_reply: aiDraft,
            status: 'PENDING'
        }]);
    }

    return allReviews.length;
}
