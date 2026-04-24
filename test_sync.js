import { listGoogleAccounts } from './src/services/googleSync.js';
import { supabase } from './src/db/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function testSync() {
    console.log('--- Testing Live Sync for info@the-mud-house.com ---');
    try {
        // 1. Get user ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', 'info@the-mud-house.com')
            .single();

        if (userError || !user) {
            console.error('User not found in local "users" table.');
            return;
        }

        console.log('User found:', user.id);

        // 2. Mock a list accounts attempt (this will trigger getOAuth2Client and the refresh logic)
        const accounts = await listGoogleAccounts(user.id);
        
        console.log('✅ Successfully connected to Google API!');
        console.log('Accounts found:', accounts.length);
        if (accounts.length > 0) {
            console.log('Primary Account Name:', accounts[0].displayName);
        }
        
    } catch (err) {
        console.error('❌ Connection Failed:', err.message);
        if (err.message.includes('invalid_grant')) {
            console.log('REASON: The refresh token is invalid/revoked. The user MUST re-connect their account in the dashboard.');
        } else if (err.message.includes('403')) {
            console.log('REASON: Permission denied (403). Check Google Cloud Project permissions or if the user is a "Test User".');
        }
    }
}

testSync();
