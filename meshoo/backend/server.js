const express = require('express');
const cors = require('cors');
const { Pool, Client } = require('pg');
const path = require('path');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased limit for base64 images

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../')));

const dbConfig = {
    user: 'postgres',
    host: 'localhost',
    password: 'pas', // Your password
    port: 5432,
};

let pool;

// Initialize Database and Table
const initDb = async () => {
    // 1. Connect to default 'postgres' database to create moda_db if it doesn't exist
    const client = new Client({ ...dbConfig, database: 'postgres' });
    
    try {
        await client.connect();
        const res = await client.query("SELECT 1 FROM pg_database WHERE datname = 'moda_db'");
        if (res.rowCount === 0) {
            console.log('Database "moda_db" does not exist. Creating it now...');
            await client.query('CREATE DATABASE moda_db');
            console.log('Database "moda_db" created successfully.');
        }
    } catch (err) {
        console.error('\n--- DATABASE CONNECTION ERROR ---');
        console.error('Could not connect to PostgreSQL to create the database.');
        console.error('Are the username and password correct in server.js?');
        console.error('Details:', err.message);
        console.error('---------------------------------\n');
        return; // Stop initialization if we can't connect
    } finally {
        await client.end();
    }

    // 2. Connect to moda_db and create the table
    pool = new Pool({ ...dbConfig, database: 'moda_db' });

    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                price DECIMAL(10, 2) NOT NULL,
                category VARCHAR(100) NOT NULL,
                brand VARCHAR(100) NOT NULL,
                img TEXT NOT NULL,
                img2 TEXT,
                img3 TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Safely attempt to add columns for existing databases without them
        try { await pool.query('ALTER TABLE products ADD COLUMN img2 TEXT;'); } catch(e) {}
        try { await pool.query('ALTER TABLE products ADD COLUMN img3 TEXT;'); } catch(e) {}
        
        console.log('PostgreSQL Table "products" is ready.');

        // Create orders table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                items JSONB NOT NULL,
                customer_info JSONB,
                total_price DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'Pending',
                shipping_date VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        // Safely add customer_info column to existing orders tables
        try { await pool.query('ALTER TABLE orders ADD COLUMN customer_info JSONB;'); } catch(e) {}
        console.log('PostgreSQL Table "orders" is ready.');
    } catch (err) {
        console.error('Error creating table:', err.message);
    }
};

initDb();

// Routes

// 1. Get all products
app.get('/api/products', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
        const result = await pool.query('SELECT * FROM products ORDER BY created_at ASC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch products from database' });
    }
});

// 2. Add a new product
app.post('/api/products', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { title, price, category, brand, img, img2, img3 } = req.body;
    
    try {
        const result = await pool.query(
            'INSERT INTO products (title, price, category, brand, img, img2, img3) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
            [title, price, category, brand, img, img2 || null, img3 || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to save product to database' });
    }
});

// 3. Delete a product
app.delete('/api/products/:id', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [id]);
        res.json({ message: 'Product deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete product' });
    }
});

// ==========================================
// ORDERS MANAGEMENT APIs
// ==========================================

// 1. Get all orders
app.get('/api/orders', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    try {
        const result = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// 2. Place a new order
app.post('/api/orders', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { items, total_price, customer_info } = req.body;
    
    // Calculate shipping date (3 days from now)
    const shipping = new Date();
    shipping.setDate(shipping.getDate() + 3);
    const shippingDateStr = shipping.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    try {
        // Ensure items and customer_info are proper JSON objects
        const parsedItems = typeof items === 'string' ? JSON.parse(items) : items;
        const parsedCustomerInfo = typeof customer_info === 'string' ? JSON.parse(customer_info) : (customer_info || {});
        const result = await pool.query(
            'INSERT INTO orders (items, customer_info, total_price, status, shipping_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [parsedItems, parsedCustomerInfo, total_price, 'Pending', `Estimated: ${shippingDateStr}`]
        );
        res.status(201).json({
            success: true,
            order: result.rows[0],
            shipping_date: shippingDateStr
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

// 3. Dispatch an order (Updates status to Dispatched and sets a real shipping/dispatched date)
app.put('/api/orders/:id/dispatch', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { id } = req.params;
    
    const today = new Date();
    const dispatchedDateStr = today.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });

    try {
        const result = await pool.query(
            "UPDATE orders SET status = 'Dispatched', shipping_date = $1 WHERE id = $2 RETURNING *",
            [`Dispatched on ${dispatchedDateStr}`, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }
        res.json({ success: true, order: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to dispatch order' });
    }
});

// 4. Delete an order
app.delete('/api/orders/:id', async (req, res) => {
    if (!pool) return res.status(500).json({ error: 'Database not initialized' });
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM orders WHERE id = $1', [id]);
        res.json({ success: true, message: 'Order deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to delete order' });
    }
});

app.listen(port, () => {
    console.log(`\nMODA Backend Server is running at http://localhost:${port}`);
    console.log('Ready to receive API requests from the frontend.');
});
