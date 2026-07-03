const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'moda_db',
    password: 'pas',
    port: 5432,
});

async function fix() {
    try {
        await pool.query('ALTER TABLE products ADD COLUMN img2 TEXT;');
        console.log("Added img2 successfully");
    } catch(e) {
        console.error("Error adding img2:", e.message);
    }
    
    try {
        await pool.query('ALTER TABLE products ADD COLUMN img3 TEXT;');
        console.log("Added img3 successfully");
    } catch(e) {
        console.error("Error adding img3:", e.message);
    }
    
    try {
        const res = await pool.query('SELECT id, title, left(img2, 20) as img2_start FROM products');
        console.log(res.rows);
    } catch(e) {
        console.error("Select error:", e.message);
    }
    pool.end();
}

fix();
