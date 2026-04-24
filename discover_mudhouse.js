import { listGoogleAccounts, listGoogleLocations } from './src/services/googleSync.js';
import { supabase } from './src/db/index.js';
import dotenv from 'dotenv';

dotenv.config();

async function discoverSpecificBusiness() {
    console.log('--- Discovering Specific Business: The Mudhouse Hostel ---');
    try {
        const { data: user } = await supabase.from('users').select('id').eq('email', 'info@the-mud-house.com').single();
        if (!user) { console.error('User info@the-mud-house.com not found.'); return; }

        console.log('Fetching accounts...');
        const accounts = await listGoogleAccounts(user.id);
        console.log(`Found ${accounts.length} accounts.`);

        for (const account of accounts) {
            console.log(`Checking account: ${account.displayName} (${account.name})`);
            const locations = await listGoogleLocations(account.name.split('/')[1], user.id);
            console.log(`- Found ${locations.length} locations.`);
            
            for (const loc of locations) {
                console.log(`  - ${loc.title} (ID: ${loc.name})`);
                if (loc.title.toLowerCase().includes('mudhouse')) {
                    console.log('✅ MATCH FOUND: The Mudhouse Hostel');
                }
            }
        }
    } catch (err) {
        console.error('Discovery Failed:', err.message);
    }
}

discoverSpecificBusiness();
