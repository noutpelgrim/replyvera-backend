import { google } from 'googleapis';
import { supabase } from '../db/index.js';
import { draftReply } from './aiManager.js';

// Simple in-memory cache to prevent Google Quota (429) exhaustion
const cache = {
    accounts: new Map(), // userId -> { data, expiry }
    locations: new Map() // accountId -> { data, expiry }
};
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const getOAuth2Client = (tokens, userId) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.G_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
    
    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Number(tokens.expiry_date)
    });

    // Automatically save refreshed tokens to the database
    oauth2Client.on('tokens', async (newTokens) => {
        console.log(`🔄 Refreshing Google tokens for user ${userId}...`);
        const updateData = {
            access_token: newTokens.access_token,
            expiry_date: newTokens.expiry_date.toString()
        };
        if (newTokens.refresh_token) {
            updateData.refresh_token = newTokens.refresh_token;
        }

        await supabase
            .from('oauth_tokens')
            .update(updateData)
            .eq('user_id', userId);
    });

    return oauth2Client;
};

/**
 * Lists all Google Business accounts authorized for a user.
 */
export async function listGoogleAccounts(userId) {
    // Check Cache
    const cached = cache.accounts.get(userId);
    if (cached && Date.now() < cached.expiry) {
        console.log(`📡 Using cached Google accounts for user ${userId}`);
        return cached.data;
    }

    const { data: tokens, error } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !tokens) throw new Error('User not connected to Google');

    const auth = getOAuth2Client(tokens, userId);
    
    // Direct request to the Business Information API
    try {
        const res = await auth.request({
            url: 'https://mybusinessbusinessinformation.googleapis.com/v1/accounts',
            method: 'GET'
        });
        
        const accounts = res.data.accounts || [];
        cache.accounts.set(userId, { data: accounts, expiry: Date.now() + CACHE_DURATION });
        return accounts;
    } catch (err) {
        console.error('❌ Google API Error (Accounts):', err.response?.data || err.message);
        throw err;
    }
}

/**
 * Lists all locations for a specific Google account.
 */
export async function listGoogleLocations(accountId, userId) {
    // Check Cache
    const cacheKey = `${userId}-${accountId}`;
    const cached = cache.locations.get(cacheKey);
    if (cached && Date.now() < cached.expiry) {
        console.log(`📡 Using cached Google locations for account ${accountId}`);
        return cached.data;
    }

    const { data: tokens, error } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !tokens) throw new Error('User not connected to Google');

    const auth = getOAuth2Client(tokens, userId);

    // Direct request to the Business Information API for locations
    try {
        const res = await auth.request({
            url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
            params: {
                readMask: 'name,title,storeCode,regularHours,metadata,categories'
            },
            method: 'GET'
        });
        const locations = res.data.locations || [];
        cache.locations.set(cacheKey, { data: locations, expiry: Date.now() + CACHE_DURATION });
        return locations;
    } catch (err) {
        console.error(`❌ Google API Error (Locations) for account ${accountId}:`, err.response?.data || err.message);
        throw err;
    }
}

/**
 * Syncs reviews from a Google location into the database.
 */
export async function syncGoogleReviews(userId, googleAccountId, googleLocationId) {
    const { data: tokens } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    const auth = getOAuth2Client(tokens, userId);

    // Map internal location_id & populate numeric IDs (UP FRONT)
    let { data: loc } = await supabase
        .from('locations')
        .update({ 
            google_account_id: googleAccountId, 
            gbp_location_id: googleLocationId 
        })
        .match({ google_location_id: googleLocationId })
        .select('id, tone_preference, business_name, google_account_id')
        .single();
    
    // Note: The modern Google Business Profile Reviews API (v1)
    let allReviews = [];
    let pageToken = null;

    // Search and Destroy: Strip any and all 'accounts/' or 'locations/' prefixes
    const cleanLocationId = googleLocationId.toString().replace(/locations\//g, '');
    let cleanAccountId = googleAccountId ? googleAccountId.toString().replace(/accounts\//g, '') : null;

    // If accountId is missing, try to find it from the enrolled location
    if (!cleanAccountId && loc?.google_account_id) {
        cleanAccountId = loc.google_account_id.toString().replace(/accounts\//g, '');
    }

    if (!cleanAccountId) {
        console.log("🕵️ Account ID missing, attempting to resolve from Google...");
        const accounts = await listGoogleAccounts(userId);
        if (accounts.length > 0) {
            cleanAccountId = accounts[0].name.toString().replace(/accounts\//g, '');
        } else {
            throw new Error('Could not resolve Google Account ID. Please try again in 15 mins.');
        }
    }

    do {
        // MODERN URL: mybusinessreviews.googleapis.com/v1
        const res = await auth.request({
            url: `https://mybusinessreviews.googleapis.com/v1/accounts/${cleanAccountId}/locations/${cleanLocationId}/reviews`,
            method: 'GET',
            params: pageToken ? { pageToken } : {}
        });

        const pageReviews = res.data.reviews || [];
        allReviews = [...allReviews, ...pageReviews];
        pageToken = res.data.nextPageToken;
        
        console.log(`📥 Fetched ${pageReviews.length} reviews from Google page...`);
    } while (pageToken);

    console.log(`✅ Total reviews fetched: ${allReviews.length}`);

    
    if (!loc) {
        console.log(`🆕 Creating new location entry for ${googleLocationId}...`);
        
        // Fetch location details from Google to get the business name
        const locInfo = await auth.request({
            url: `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${googleAccountId}/locations/${googleLocationId}`,
            method: 'GET',
            params: { readMask: 'title' }
        });

        const { data: newLoc, error: insertError } = await supabase
            .from('locations')
            .insert([{ 
                user_id: userId,
                google_location_id: googleLocationId, 
                business_name: locInfo.data.title || 'My Business',
                google_account_id: googleAccountId,
                gbp_location_id: googleLocationId,
                tone_preference: 'Professional and friendly'
            }])
            .select('id, tone_preference, business_name')
            .single();
            
        if (insertError) throw insertError;
        loc = newLoc;
    }

    for (let i = 0; i < allReviews.length; i++) {
        const rev = allReviews[i];
        const { reviewId, reviewer, starRating, comment, createTime } = rev;
        
        console.log(`🔍 Processing review ${i+1}/${allReviews.length} from ${reviewer.displayName}...`);

        // 1. Check if it already exists
        const { data: existing } = await supabase
            .from('reviews')
            .select('id')
            .eq('google_review_id', reviewId)
            .single();

        if (existing) {
            console.log(`⏩ Already exists, skipping.`);
            continue;
        }

        // 2. Draft AI response
        const ratingNum = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 }[starRating] || 5;
        console.log(`🤖 Drafting AI reply for ${ratingNum}-star review...`);
        const aiDraft = await draftReply(comment || '', ratingNum, loc.tone_preference, loc.business_name);

        // 3. Insert fresh review
        const { error: insErr } = await supabase
            .from('reviews')
            .insert([{
                location_id: loc.id,
                google_review_id: reviewId,
                reviewer_name: reviewer.displayName,
                rating: ratingNum,
                comment: comment || '',
                review_date: createTime,
                drafted_reply: aiDraft,
                status: 'PENDING'
            }]);
        
        if (insErr) {
            console.error(`❌ Insert failed for review ${reviewId}:`, insErr.message);
        } else {
            console.log(`✅ Review from ${reviewer.displayName} saved!`);
        }
    }

    return allReviews.length;
}

/**
 * Posts a reply to a Google review via the My Business API.
 */
export async function postReviewReply(userId, internalReviewId, comment) {
    // 1. Get the review and its associated numeric IDs
    const { data: rev, error: revError } = await supabase
        .from('reviews')
        .select('google_review_id, locations(google_account_id, gbp_location_id)')
        .eq('id', internalReviewId)
        .single();

    if (revError || !rev) throw new Error('Review not found in local database');
    
    const accountId = rev.locations.google_account_id;
    const locationId = rev.locations.gbp_location_id;
    const reviewId = rev.google_review_id;

    if (!accountId || !locationId) {
        throw new Error('Location is not fully synced with Google (Numeric IDs missing). Please run a sync first.');
    }

    // 2. Get user tokens
    const { data: tokens } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (!tokens) throw new Error('User not connected to Google');

    const auth = getOAuth2Client(tokens, userId);

    // 3. Send the reply to Google
    console.log(`📤 Posting reply to Google for review ${reviewId}...`);
    const res = await auth.request({
        url: `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${reviewId}/reply`,
        method: 'PUT',
        data: {
            comment: comment
        }
    });

    return res.data;
}
