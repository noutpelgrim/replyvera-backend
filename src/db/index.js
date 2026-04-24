import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

// Initialize the Supabase client with the service role key (important for bypass RLS on backend)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Compatibility shim: While we refactor, we can use this to map standard queries.
// Eventually we want to move to supabase.from().x().y()...
export const query = async (text, params) => {
    console.warn(`⚠️ Deprecated: Using raw SQL query on Supabase. Consider refactoring to .from() SDK: ${text}`);
    // This is just a placeholder to keep the app from crashing while we refactor.
    // Raw SQL is NOT supported via SDK directly.
    return { rows: [] }; 
};
