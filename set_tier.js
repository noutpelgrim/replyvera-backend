import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
    const email = process.argv[2];
    const tier = process.argv[3];
    
    if (!email || !tier) {
        console.log('❌ Usage: node set_tier.js <email> <starter|professional|agency>');
        process.exit(1);
    }
    
    const validTiers = ['starter', 'professional', 'agency'];
    if (!validTiers.includes(tier.toLowerCase())) {
        console.log(`❌ Invalid tier. Must be one of: ${validTiers.join(', ')}`);
        process.exit(1);
    }
    
    console.log(`Setting plan for ${email} to "${tier.toLowerCase()}"...`);
    
    // 1. Update public.users database row
    const { data: user, error: dbError } = await supabase
        .from('users')
        .upsert({ email, subscription_tier: tier.toLowerCase() }, { onConflict: 'email' })
        .select()
        .single();
        
    if (dbError) {
        console.warn('⚠️ Could not update public.users table (checking if it exists):', dbError.message);
    } else {
        console.log(`✅ Database table public.users successfully updated:`, user);
    }
    
    // 2. Also update Supabase Auth user metadata (to keep metadata synchronized)
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    if (!listError && users) {
        const authUser = users.find(u => u.email === email);
        if (authUser) {
            const { error: updateError } = await supabase.auth.admin.updateUserById(
                authUser.id,
                { user_metadata: { ...authUser.user_metadata, subscription_tier: tier.toLowerCase() } }
            );
            if (updateError) {
                console.error('❌ Error updating Supabase Auth metadata:', updateError.message);
            } else {
                console.log(`✅ Supabase Auth user metadata successfully updated!`);
            }
        } else {
            console.log(`ℹ️ User not found in Supabase Auth list (only exists in public db).`);
        }
    }
    
    console.log(`\n🎉 Done! Refresh your dashboard tab in the browser to see the changes live.`);
}

run();
