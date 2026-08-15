import { google } from 'googleapis';
import { supabase } from '../db/index.js';
import dotenv from 'dotenv';
dotenv.config();

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET || process.env.G_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
};

/**
 * Replies to a specific Google Review using the authorized user's credentials.
 * @param {string} userId - The internal User ID to fetch tokens for.
 * @param {string} googleLocationId - The Google location identifier.
 * @param {string} googleReviewId - The specific review we are replying to.
 * @param {string} replyText - The finalized AI/Manual reply to push.
 */
export async function postReplyToGoogle(userId, googleLocationId, googleReviewId, replyText) {
    const { data: tokenRes, error: tokenError } = await supabase
        .from('oauth_tokens')
        .select('access_token, refresh_token, expiry_date')
        .eq('user_id', userId);

    if (tokenError || !tokenRes?.[0]) {
        throw new Error('Google OAuth tokens not found for this user account. Please click Connect with Google.');
    }

    const { access_token, refresh_token, expiry_date } = tokenRes[0];
    const oauth2Client = getOAuth2Client();
    oauth2Client.setCredentials({ access_token, refresh_token, expiry_date: Number(expiry_date) });

    // 1. Resolve Account ID
    const { data: loc } = await supabase
        .from('locations')
        .select('google_account_id, business_name')
        .eq('google_location_id', googleLocationId)
        .maybeSingle();
    
    let accountName = loc?.google_account_id;

    if (!accountName || accountName === 'mock-account') {
        try {
            console.log('🔍 Resolving Google Account ID from Google API...');
            const accountsRes = await oauth2Client.request({
                url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
            });
            const accounts = accountsRes.data.accounts || [];
            if (accounts.length > 0) {
                accountName = accounts[0].name;
                await supabase.from('locations').update({ google_account_id: accountName }).eq('google_location_id', googleLocationId);
            }
        } catch (accErr) {
            console.warn('⚠️ Account ID lookup notice:', accErr.message);
            accountName = accountName || 'accounts/111003738096356772718';
        }
    }
    
    const cleanAccountId = (accountName || '111003738096356772718').replace(/^accounts\//, '');
    const cleanLocationId = (googleLocationId || '').replace(/^locations\//, '');

    const replyEndpoints = [
        `https://mybusinessreviews.googleapis.com/v1/accounts/${cleanAccountId}/locations/${cleanLocationId}/reviews/${googleReviewId}/reply`,
        `https://mybusiness.googleapis.com/v4/accounts/${cleanAccountId}/locations/${cleanLocationId}/reviews/${googleReviewId}/reply`
    ];

    let postSuccess = false;
    let lastError = null;

    for (const url of replyEndpoints) {
        if (postSuccess) break;
        try {
            console.log(`🚀 Dispatching reply via ${url}...`);
            await oauth2Client.request({
                url,
                method: 'PUT',
                data: { comment: replyText }
            });
            postSuccess = true;
            console.log(`✅ Successfully posted reply to Google Maps via ${url.split('/')[2]}`);
        } catch (err) {
            lastError = err;
            const errMsg = err.response?.data?.error?.message || err.message || '';
            console.warn(`⚠️ Reply endpoint failed (${url.split('/')[2]}):`, errMsg);
        }
    }

    if (!postSuccess) {
        const rawErr = lastError?.response?.data?.error?.message || lastError?.message || 'Google API error';
        console.error('❌ All Google reply endpoints failed:', rawErr);
        
        if (rawErr.includes('Quota exceeded') || rawErr.includes('429')) {
            throw new Error('Google API rate limit reached (429). Google limits per-minute requests. Please retry in 3-5 minutes.');
        } else if (rawErr.includes('invalid_grant') || rawErr.includes('401') || rawErr.includes('Unauthenticated')) {
            throw new Error('Google authorization session expired. Please click Disconnect Account and then Connect with Google.');
        } else {
            throw new Error(`Google Maps API response: ${rawErr}`);
        }
    }
}
