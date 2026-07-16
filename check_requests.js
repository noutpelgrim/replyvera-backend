import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    console.log('📊 Fetching integration interest requests from Supabase Auth...');
    try {
        const { data: { users }, error } = await supabase.auth.admin.listUsers();
        if (error) throw error;
        
        const requests = [];
        for (const u of users) {
            const meta = u.user_metadata || u.raw_user_meta_data || {};
            if (meta.requested_facebook || meta.requested_trustpilot) {
                requests.push({
                    Email: u.email,
                    'Requested Facebook': meta.requested_facebook ? 'Yes ✅' : 'No',
                    'Requested Trustpilot': meta.requested_trustpilot ? 'Yes ✅' : 'No',
                    Created: new Date(u.created_at).toLocaleDateString()
                });
            }
        }
        
        if (requests.length === 0) {
            console.log('ℹ️ No interest requests recorded yet.');
        } else {
            console.log(`\nFound ${requests.length} request(s):`);
            console.table(requests);
        }
    } catch (err) {
        console.error('❌ Failed to fetch requests:', err.message);
    } finally {
        process.exit(0);
    }
}

run();
