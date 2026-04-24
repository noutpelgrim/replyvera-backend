
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  try {
    console.log('--- Checking schema of reviews table ---');
    const cols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reviews'
    `);
    if (cols.rows.length === 0) {
      console.log('No columns found for "reviews" table.');
    } else {
      console.table(cols.rows);
    }

    console.log('\n--- Checking latest reviews ---');
    const reviews = await pool.query(`
      SELECT r.id, r.reviewer_name, r.rating, r.created_at, l.business_name 
      FROM reviews r 
      JOIN locations l ON r.location_id = l.id 
      ORDER BY r.created_at DESC 
      LIMIT 10
    `);
    if (reviews.rows.length === 0) {
      console.log('No reviews found.');
    } else {
      console.table(reviews.rows);
    }
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

run();
