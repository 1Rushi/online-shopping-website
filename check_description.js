const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'moda_db',
    password: 'pass123',
    port: 5432,
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL', err.stack);
    } else {
        console.log('Connected to PostgreSQL database "moda_db".');
        
        client.query('SELECT id, title, description FROM products ORDER BY id DESC LIMIT 5')
            .then(res => {
                console.log('Recent products with descriptions:');
                res.rows.forEach(row => {
                    console.log(`ID: ${row.id}, Title: ${row.title}, Description: ${row.description || 'NULL'}`);
                });
            })
            .catch(e => console.error('Error querying products:', e.message))
            .finally(() => {
                release();
                pool.end();
            });
    }
});
