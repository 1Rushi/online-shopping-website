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
        
        // Add description column if it doesn't exist
        client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT')
            .then(() => console.log('Successfully added description column to products table.'))
            .catch(e => console.error('Error adding description column:', e.message))
            .then(() => {
                // Add material column if it doesn't exist
                return client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS material TEXT');
            })
            .then(() => console.log('Successfully added material column to products table.'))
            .catch(e => console.error('Error adding material column:', e.message))
            .then(() => {
                // Add shipping column if it doesn't exist
                return client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS shipping TEXT');
            })
            .then(() => console.log('Successfully added shipping column to products table.'))
            .catch(e => console.error('Error adding shipping column:', e.message))
            .finally(() => {
                release();
                pool.end();
            });
    }
});
