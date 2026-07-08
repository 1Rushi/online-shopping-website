const { Client } = require('pg');

async function setup() {
    // Connect to default 'postgres' database to create new database
    const initialClient = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'postgres',
        password: 'pass123',
        port: 5432,
    });

    try {
        await initialClient.connect();
        const res = await initialClient.query("SELECT datname FROM pg_database WHERE datname = 'moda_db'");
        if (res.rowCount === 0) {
            console.log("Creating database moda_db...");
            await initialClient.query('CREATE DATABASE moda_db');
        } else {
            console.log("Database moda_db already exists.");
        }
    } catch (e) {
        console.error("Error creating database:", e);
        process.exit(1);
    } finally {
        await initialClient.end();
    }

    // Connect to the new 'moda_db' to create tables
    const client = new Client({
        user: 'postgres',
        host: 'localhost',
        database: 'moda_db',
        password: 'pass123',
        port: 5432,
    });

    try {
        await client.connect();
        console.log("Connected to moda_db, creating tables...");

        await client.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT,
                email TEXT UNIQUE,
                password TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                title TEXT,
                price REAL,
                category TEXT,
                brand TEXT,
                img TEXT,
                img2 TEXT,
                img3 TEXT,
                sizes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                items TEXT,
                total_price REAL,
                customer_info TEXT,
                status TEXT DEFAULT 'Pending',
                shipping_date TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS cart_items (
                id SERIAL PRIMARY KEY,
                session_id TEXT,
                product_id INTEGER,
                img TEXT,
                title TEXT,
                price REAL,
                brand TEXT,
                qty INTEGER DEFAULT 1,
                size TEXT,
                color TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS wishlist_items (
                id SERIAL PRIMARY KEY,
                session_id TEXT,
                product_id INTEGER,
                img TEXT,
                title TEXT,
                price REAL,
                brand TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("Tables created successfully.");
    } catch (e) {
        console.error("Error creating tables:", e);
    } finally {
        await client.end();
    }
}

setup();
