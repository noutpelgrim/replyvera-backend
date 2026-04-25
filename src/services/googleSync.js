import { getOAuth2Client } from './googleAuth.js';
import { supabase } from '../db/index.js';
import { draftReply } from './aiManager.js';

const cache = {
    accounts: new Map(),
    locations: new Map()
};

const CACHE_DURATION = 15 * 60 * 1000; // 15 mins

/**
 * Lists all Google accounts the user has access to.
 */
export async function listGoogleAccounts(userId) {
    // Check Cache
    const cached = cache.accounts.get(userId);
    if (cached && Date.now() < cached.expiry) {
        console.log('📡 Using cached Google accounts');
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
    const { data: tokens, error } = await supabase
        .from('oauth_tokens')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error || !tokens) throw new Error('User not connected to Google');

    const auth = getOAuth2Client(tokens, userId);

    try {
        const res = await auth.request({
            url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accountId}/locations`,
            params: {
                readMask: 'name,title,storeCode,regularHours,metadata,categories'
            },
            method: 'GET'
        });
        const locations = res.data.locations || [];
        return locations;
    } catch (err) {
        console.error(`❌ Google API Error (Locations) for account ${accountId}:`, err.response?.data || err.message);
        throw err;
    }
}

/**
 * Syncs reviews from a Google location into the database.
 * (Legacy wrapper - now handled by emergencySync)
 */
export async function syncGoogleReviews(userId, googleAccountId, googleLocationId) {
    console.log("🚀 syncGoogleReviews legacy called. Delegating to primary sync...");
    const { syncGoogleReviews: emergencySync } = await import('./emergencySync.js');
    return emergencySync(userId);
}

/**
 * Posts a reply to a Google review.
 * Delegated to googleService.js for actual API logic.
 */
export async function postReviewReply(userId, reviewPk, replyText) {
    const { postReplyToGoogle } = await import('./googleService.js');
    const { data: rev } = await supabase
        .from('reviews')
        .select('google_review_id, locations(google_location_id)')
        .eq('id', reviewPk)
        .single();
    
    if (!rev) throw new Error('Review not found in local DB');
    
    return postReplyToGoogle(
        userId, 
        rev.locations.google_location_id, 
        rev.google_review_id, 
        replyText
    );
}
