import express from 'express';
import { google } from 'googleapis';
import { supabase } from '../db/index.js';

const router = express.Router();

const getOAuth2Client = () => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.G_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );
};

// Scopes required for User email and Google Business Profile access
const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/business.manage'
];

router.get('/google', (req, res) => {
    const { email } = req.query;
    const oauth2Client = getOAuth2Client();
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
        state: email
    });
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        const oauth2Client = getOAuth2Client();
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // We use the email passed back in 'state' (from our dashboard)
        // rather than the email returned by Google info.
        const email = state;

        if (!email) {
            return res.status(400).send('Target email context lost in Auth flow');
        }

        // Upsert User using Supabase SDK
        const { data: userRes, error: userError } = await supabase
            .from('users')
            .upsert({ email }, { onConflict: 'email' })
            .select();

        if (userError) throw userError;
        const userId = userRes[0].id;

        // Manage Tokens
        const { access_token, refresh_token, expiry_date } = tokens;
        
        if (refresh_token) {
            // Wipe old tokens and insert fresh ones
            await supabase
                .from('oauth_tokens')
                .delete()
                .eq('user_id', userId);
                
            const { error: insertError } = await supabase
                .from('oauth_tokens')
                .insert([{
                    user_id: userId,
                    access_token,
                    refresh_token,
                    expiry_date: expiry_date.toString()
                }]);
                
            if (insertError) throw insertError;
        } else {
            // Update existing record
            const { error: updateError } = await supabase
                .from('oauth_tokens')
                .update({ 
                    access_token, 
                    expiry_date: expiry_date.toString() 
                })
                .eq('user_id', userId);
                
            if (updateError) throw updateError;
        }

        res.redirect('http://localhost:5173/dashboard');
    } catch (error) {
        console.error('Error during Google Auth Callback:', error);
        res.status(500).send('Authentication failed');
    }
});

// GET connection status
router.get('/status/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !userData) {
            return res.json({ connected: false });
        }

        const { data: tokenData, error: tokenError } = await supabase
            .from('oauth_tokens')
            .select('id')
            .eq('user_id', userData.id)
            .single();

        res.json({ connected: !!tokenData && !tokenError });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Disconnect Google Account (Delete tokens)
 */
router.delete('/disconnect/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        if (userError || !user) throw new Error('User not found');

        const { error: deleteError } = await supabase
            .from('oauth_tokens')
            .delete()
            .eq('user_id', user.id);

        if (deleteError) throw deleteError;

        res.json({ success: true, message: 'Google account disconnected successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
