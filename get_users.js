import { supabase } from './src/db/index.js';

async function getUsers() {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) console.error(error);
    console.log(users.map(u => u.email));
}
getUsers();
