import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const email = process.argv[2] || 'agency@replyvera.com';
    console.log(`🧹 Resetting integration interest requests for: ${email}...`);
    
    try {
        const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
        if (listError || !users) throw listError || new Error('Could not fetch user list');
        
        const authUser = users.find(u => u.email === email);
        if (!authUser) {
            console.log(`❌ User ${email} not found.`);
            process.exit(1);
        }
        
        // Explicitly set flags to false to bypass Supabase's shallow merge behavior
        const updatedMeta = { ...authUser.user_metadata };
        updatedMeta.requested_facebook = false;
        updatedMeta.requested_trustpilot = false;
        
        const { error: updateError } = await supabase.auth.admin.updateUserById(
            authUser.id,
            { user_metadata: updatedMeta }
        );
        
        if (updateError) throw updateError;
        
        console.log(`✅ Successfully reset requests metadata for ${email}!`);
    } catch (err) {
        console.error('❌ Reset failed:', err.message);
    } finally {
        process.exit(0);
    }
}

run();
