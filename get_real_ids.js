import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    console.log('🔍 Fetching real Google IDs...');
    
    try {
        // Get user and tokens
        const { data: user } = await supabase.from('users').select('id').eq('email', 'noutpelgrim@hotmail.com').single();
        const { data: tokens } = await supabase.from('oauth_tokens').select('*').eq('user_id', user.id).single();
        
        if (!tokens) throw new Error('No tokens found for user');

        const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        oauth2Client.setCredentials({
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token
        });
        
        const res = await oauth2Client.request({
            url: 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts'
        });
        
        console.log('FOUND_ACCOUNTS:' + JSON.stringify(res.data.accounts));
        
        if (res.data.accounts && res.data.accounts.length > 0) {
            const accName = res.data.accounts[0].name; // accounts/XXXXX
            console.log('✅ First Account ID detected:', accName);
            
            // Now fetch locations for this account
            const locRes = await oauth2Client.request({
                url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accName}/locations`,
                params: { readMask: 'name,title' }
            });
            console.log('FOUND_LOCATIONS:' + JSON.stringify(locRes.data.locations));
        }

    } catch (err) {
        console.error('❌ Error:', err.response?.data || err.message);
    }
}

run();
