import express from 'express';
import { google } from 'googleapis';
import { supabase } from '../db/index.js';

const router = express.Router();

const getOAuth2Client = (redirectUriOverride = null) => {
    return new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET || process.env.G_CLIENT_SECRET,
        redirectUriOverride || process.env.GOOGLE_REDIRECT_URI || 'https://replyvera-backend-production.up.railway.app/api/auth/google/callback'
    );
};

// Scopes required for User email and Google Business Profile management
const SCOPES = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/business.manage'
];

router.get('/google', (req, res) => {
    const { email } = req.query;
    const host = req.get('host');
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const dynamicRedirectUri = `${protocol}://${host}${req.baseUrl}/google/callback`;

    const oauth2Client = getOAuth2Client(dynamicRedirectUri);
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
        const host = req.get('host');
        const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
        const dynamicCallbackUrl = `${protocol}://${host}${req.baseUrl}${req.path}`;

        const candidateUris = [
            dynamicCallbackUrl,
            process.env.GOOGLE_REDIRECT_URI,
            `https://${host}/auth/google/callback`,
            `https://${host}/api/auth/google/callback`,
            'https://replyvera-backend-production.up.railway.app/auth/google/callback',
            'https://replyvera-backend-production.up.railway.app/api/auth/google/callback',
            'https://api.replyvera.com/api/auth/google/callback',
            'https://api.replyvera.com/auth/google/callback',
            'https://replyvera-backend.onrender.com/auth/google/callback'
        ].filter(Boolean);

        let tokens = null;
        let activeOAuth2Client = null;
        let lastError = null;

        for (const uri of candidateUris) {
            try {
                const client = getOAuth2Client(uri);
                const tokenRes = await client.getToken(code);
                tokens = tokenRes.tokens;
                if (tokens && tokens.access_token) {
                    activeOAuth2Client = client;
                    break;
                }
            } catch (err) {
                lastError = err;
            }
        }

        if (!tokens || !tokens.access_token) {
            console.error('Failed to retrieve tokens with candidate URIs:', lastError);
            throw lastError || new Error('Token exchange failed');
        }

        activeOAuth2Client.setCredentials(tokens);

        // We use the email passed back in 'state' (from our dashboard)
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
                    expiry_date: expiry_date ? expiry_date.toString() : (Date.now() + 3600 * 1000).toString()
                }]);
                
            if (insertError) throw insertError;
        } else {
            // Update existing record
            const { error: updateError } = await supabase
                .from('oauth_tokens')
                .update({ 
                    access_token, 
                    expiry_date: expiry_date ? expiry_date.toString() : (Date.now() + 3600 * 1000).toString()
                })
                .eq('user_id', userId);
                
            if (updateError) throw updateError;
        }

        const dashboardUrl = process.env.NODE_ENV === 'production' 
            ? 'https://replyvera-dashboard.vercel.app/dashboard' 
            : 'http://localhost:5173/dashboard';

        res.redirect(dashboardUrl);
    } catch (error) {
        console.error('Error during Google Auth Callback:', error);
        res.status(500).send(`Authentication failed: ${error.message || 'Unknown error'}`);
    }
});

// Self-healing helper to synchronize Supabase Auth metadata tier with public PostgreSQL schema
async function syncUserTier(email) {
    let tier = 'professional'; // default fallback
    try {
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .maybeSingle();
        
        if (userData && userData.subscription_tier) {
            return userData.subscription_tier;
        }

        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (!authError && authData && authData.users) {
            const authUser = authData.users.find(u => u.email === email);
            if (authUser) {
                const metadata = authUser.user_metadata || authUser.raw_user_meta_data || {};
                if (metadata.subscription_tier) {
                    tier = metadata.subscription_tier;
                }
            }
        }

        const { error: upsertError } = await supabase
            .from('users')
            .upsert({ email, subscription_tier: tier }, { onConflict: 'email' });
            
        if (upsertError) {
            console.warn('⚠️ Could not save subscription_tier to public.users schema (perhaps column does not exist yet). Falling back to metadata tier:', tier);
        }
    } catch (e) {
        console.error('Error syncing user tier:', e.message);
    }
    return tier;
}

// GET connection status and user subscription details
router.get('/status/:email', async (req, res) => {
    const { email } = req.params;
    try {
        const tier = await syncUserTier(email);
        
        let facebookRequested = false;
        let trustpilotRequested = false;
        
        // Retrieve connection status from Supabase Auth metadata
        const { data: authData, error: authError } = await supabase.auth.admin.listUsers();
        if (!authError && authData && authData.users) {
            const authUser = authData.users.find(u => u.email === email);
            if (authUser) {
                const metadata = authUser.user_metadata || authUser.raw_user_meta_data || {};
                facebookRequested = !!metadata.requested_facebook;
                trustpilotRequested = !!metadata.requested_trustpilot;
            }
        }

        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', email)
            .single();

        let googleConnected = false;
        if (userData) {
            const { data: tokenData, error: tokenError } = await supabase
                .from('oauth_tokens')
                .select('id')
                .eq('user_id', userData.id)
                .single();
            googleConnected = !!tokenData && !tokenError;
        }

        res.json({ 
            connected: googleConnected, // compatibility fallback
            googleConnected,
            facebookRequested,
            trustpilotRequested,
            tier: tier
        });
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

// POST route to manually update or set user's subscription tier
router.post('/tier', async (req, res) => {
    const { email, tier } = req.body;
    try {
        const { error } = await supabase
            .from('users')
            .upsert({ email, subscription_tier: tier }, { onConflict: 'email' });
        
        if (error) {
            console.warn('⚠️ Could not update subscription_tier in public.users:', error.message);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST route to register interest in a future platform (Facebook/Trustpilot)
router.post('/request-platform', async (req, res) => {
    const { platform, email } = req.body;
    
    if (!email || !['facebook', 'trustpilot'].includes(platform)) {
        return res.status(400).json({ error: 'Invalid platform or missing email' });
    }
    
    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError || !users) throw listError || new Error('Could not fetch user list');
        
        const authUser = users.find(u => u.email === email);
        if (!authUser) throw new Error('User not found in Supabase Auth');
        
        const metadataKey = `requested_${platform}`;
        await supabase.auth.admin.updateUserById(
            authUser.id,
            { user_metadata: { ...authUser.user_metadata, [metadataKey]: true } }
        );
        
        // 🚀 Automatically send a notification email to the owner
        const { sendEmail } = await import('../services/mailService.js');
        await sendEmail({
            to: 'info@replyvera.com',
            subject: `🚀 New Integration Request: ${platform.toUpperCase()}`,
            text: `Hi Nout,\n\nUser ${email} has requested activation for the ${platform.toUpperCase()} review integration.\n\nBest regards,\nReplyVera System Bot`
        });
        
        res.json({ success: true, message: `Successfully registered interest for ${platform}!` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
