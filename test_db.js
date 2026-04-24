import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function test() {
  console.log('Testing connection to:', process.env.DATABASE_URL.replace(/:([^@]+)@/, ':****@'));
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ Success!', res.rows[0]);
  } catch (err) {
    console.error('❌ Failed:', err.message);
  } finally {
    await pool.end();
  }
}

test();
