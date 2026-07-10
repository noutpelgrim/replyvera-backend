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
    try {
        const { data: tokenRes, error: tokenError } = await supabase
            .from('oauth_tokens')
            .select('access_token, refresh_token, expiry_date')
            .eq('user_id', userId);

        if (tokenError || !tokenRes?.[0]) throw new Error(`No OAuth tokens found for user ${userId}`);

        const { access_token, refresh_token, expiry_date } = tokenRes[0];
        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({ access_token, refresh_token, expiry_date: Number(expiry_date) });

        // 1. Check if we have the Account ID cached for this location
        const { data: loc } = await supabase
            .from('locations')
            .select('google_account_id')
            .eq('google_location_id', googleLocationId)
            .single();
        
        let accountName = loc?.google_account_id;

        // 2. Only resolve from Google if we don't have it saved (prevents Quota errors)
        if (!accountName) {
            console.log('🔍 No cached Account ID. Resolving from Google...');
            const accountsRes = await oauth2Client.request({
                url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
            });
            const accounts = accountsRes.data.accounts || [];
            if (accounts.length === 0) throw new Error('No Google Business accounts found.');
            accountName = accounts[0].name;
            
            // Save it for next time
            await supabase.from('locations').update({ google_account_id: accountName }).eq('google_location_id', googleLocationId);
        }
        
        const reviewName = `${accountName}/locations/${googleLocationId}/reviews/${googleReviewId}`;

        try {
            console.log(`🚀 Dispatching reply via ${reviewName}...`);
            await oauth2Client.request({
                url: `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
                method: 'PUT',
                data: { comment: replyText }
            });
            console.log('✅ Successfully posted reply via official Google API.');
        } catch (error) {
            const errorDetail = error.response?.data || error.message;
            console.error('❌ Official API failed:', JSON.stringify(errorDetail));
            console.log('🔄 API is gated or tokens expired. Switching to Vera Scout Automation Bridge...');
            
            // Fallback to Automation
            const { postReplyViaAutomation } = await import('./automationService.js');
            
            // We need the business name for searching
            const { data: locData } = await supabase
                .from('locations')
                .select('business_name')
                .eq('google_location_id', googleLocationId)
                .single();
            
            await postReplyViaAutomation(locData?.business_name || 'The Mudhouse Hostel', 'Iris Zagdoun', replyText);
            console.log('✅ Successfully posted reply via Vera Scout Automation.');
            return;
        }
    } catch (error) {
        const errorDetail = error?.response?.data || error;
        console.error('❌ Error posting reply to Google:', JSON.stringify(errorDetail, null, 2));
        console.log('🔄 Auth/Token failed. Switching to Vera Scout Automation Bridge...');
        
        try {
            const { postReplyViaAutomation } = await import('./automationService.js');
            const { data: locData } = await supabase
                .from('locations')
                .select('business_name')
                .eq('google_location_id', googleLocationId)
                .single();
            
            await postReplyViaAutomation(locData?.business_name || 'The Mudhouse Hostel', 'Iris Zagdoun', replyText);
            console.log('✅ Successfully posted reply via Vera Scout Automation.');
        } catch (fallbackErr) {
            console.error('❌ Fallback Automation failed:', fallbackErr.message);
            throw fallbackErr;
        }
    }
}
