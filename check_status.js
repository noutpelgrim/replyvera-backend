import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUser() {
    console.log('--- DB Check for info@the-mud-house.com ---');
    try {
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('email', 'info@the-mud-house.com')
            .single();

        if (userError) {
            console.log('User status: Not found in database or error:', userError.message);
        } else {
            console.log('User status: EXISTS');
            console.log('User ID:', user.id);
            
            const { data: tokens, error: tokenError } = await supabase
                .from('oauth_tokens')
                .select('*')
                .eq('user_id', user.id);
                
            if (tokenError || (tokens && tokens.length === 0)) {
                console.log('Connection status: Google NOT CONNECTED (no tokens)');
            } else {
                console.log('Connection status: Google CONNECTED');
                console.log('Token count:', tokens.length);
                const token = tokens[0];
                const isExpired = new Date(parseInt(token.expiry_date)) < new Date();
                console.log('Token expired:', isExpired);
            }
        }
    } catch (err) {
        console.error('Fatal error during check:', err.message);
    }
}

checkUser();
