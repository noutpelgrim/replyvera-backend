import { google } from 'googleapis';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Returns a configured OAuth2 client for Google APIs.
 */
export const getOAuth2Client = (tokens = null) => {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.G_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    if (tokens) {
        oauth2Client.setCredentials({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expiry_date: Number(tokens.expiry_date)
        });
    }

    return oauth2Client;
};
