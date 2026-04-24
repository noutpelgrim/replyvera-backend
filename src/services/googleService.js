import { google } from 'googleapis';
import { supabase } from '../db/index.js';
import dotenv from 'dotenv';
dotenv.config();

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.G_CLIENT_SECRET,
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
        // Fetch oauth tokens for this user using Supabase SDK
        const { data: tokenRes, error: tokenError } = await supabase
            .from('oauth_tokens')
            .select('access_token, refresh_token, expiry_date')
            .eq('user_id', userId);

        if (tokenError) throw tokenError;
        if (!tokenRes || tokenRes.length === 0) {
            throw new Error(`No OAuth tokens found for user ${userId}`);
        }

        const { access_token, refresh_token, expiry_date } = tokenRes[0];

        const oauth2Client = getOAuth2Client();
        oauth2Client.setCredentials({
            access_token,
            refresh_token,
            expiry_date: Number(expiry_date)
        });

        const reviewName = `accounts/-/locations/${googleLocationId}/reviews/${googleReviewId}`;

        // Send the payload
        const response = await oauth2Client.request({
            url: `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
            method: 'PUT',
            data: {
                comment: replyText
            }
        });

        console.log(`Successfully dispatched reply to Google for review ${googleReviewId}`);
        return response.data;
    } catch (error) {
        console.error('Error posting reply to Google:', error?.response?.data || error);
        throw error;
    }
}
