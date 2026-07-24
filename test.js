const { Pool } = require('pg');
const pool = new Pool({user: 'postgres', host: 'localhost', database: 'moda_db', password: 'pass123', port: 5432});

async function test() {
  try {
    const res1 = await pool.query("SELECT pg_size_pretty(pg_total_relation_size('products'));");
    console.log('Table size:', res1.rows[0]);
    const res2 = await pool.query("SELECT id, length(img) as img1_len, length(img2) as img2_len, length(img3) as img3_len FROM products LIMIT 5;");
    console.log('Image lengths:', res2.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
test();
