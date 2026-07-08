const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize PostgreSQL connection pool
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
        release();
    }
});

// ==========================================
// AUTH API
// ==========================================

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const query = `
            INSERT INTO users (name, email, password)
            VALUES ($1, $2, $3) RETURNING id, name, email;
        `;
        const { rows } = await pool.query(query, [name, email, password]);
        res.json({ success: true, user: rows[0] });
    } catch (err) {
        if (err.code === '23505') { // Unique constraint violation (email exists)
            res.status(400).json({ error: 'Email already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const { rows } = await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND password = $2', [email, password]);
        if (rows.length > 0) {
            res.json({ success: true, user: rows[0] });
        } else {
            res.status(401).json({ error: 'Invalid email or password.' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// PRODUCTS API
// ==========================================

app.get('/api/products', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products ORDER BY id DESC');
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/products/:id', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (rows.length > 0) res.json(rows[0]);
        else res.status(404).json({ error: 'Product not found' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/products', async (req, res) => {
    const { title, price, category, brand, img, img2, img3, sizes } = req.body;
    try {
        const query = `
            INSERT INTO products (title, price, category, brand, img, img2, img3, sizes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id;
        `;
        const values = [title, price, category, brand, img, img2, img3, sizes || ''];
        const { rows } = await pool.query(query, values);
        res.json({ id: rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.json({ deletedID: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ORDERS API
// ==========================================

app.get('/api/orders', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        const parsedRows = rows.map(row => {
            try { row.items = JSON.parse(row.items); } catch (e) {}
            try { row.customer_info = JSON.parse(row.customer_info); } catch (e) {}
            return row;
        });
        res.json(parsedRows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/orders', async (req, res) => {
    const { items, total_price, customer_info } = req.body;
    
    const shipDate = new Date();
    shipDate.setDate(shipDate.getDate() + 3);
    const shipping_date = shipDate.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    try {
        const query = `
            INSERT INTO orders (items, total_price, customer_info, shipping_date)
            VALUES ($1, $2, $3, $4) RETURNING id;
        `;
        const values = [
            JSON.stringify(items), 
            total_price, 
            JSON.stringify(customer_info), 
            shipping_date
        ];
        const { rows } = await pool.query(query, values);
        res.json({ id: rows[0].id, shipping_date });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/orders/:id/dispatch', async (req, res) => {
    try {
        await pool.query("UPDATE orders SET status = 'Dispatched' WHERE id = $1", [req.params.id]);
        res.json({ updatedID: req.params.id, status: 'Dispatched' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/orders/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
        res.json({ deletedID: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// CART API
// ==========================================

app.get('/api/cart/:sessionId', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM cart_items WHERE session_id = $1 ORDER BY id ASC', [req.params.sessionId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/cart/:sessionId', async (req, res) => {
    const { img, title, price, brand, qty, size, color } = req.body;
    const sessionId = req.params.sessionId;

    try {
        // Check if item already exists in cart with same size and color
        const checkQuery = `SELECT id, qty FROM cart_items WHERE session_id = $1 AND title = $2 AND size = $3 AND color = $4`;
        const checkRes = await pool.query(checkQuery, [sessionId, title, size, color]);
        
        if (checkRes.rowCount > 0) {
            // Update quantity
            const newQty = checkRes.rows[0].qty + (qty || 1);
            await pool.query('UPDATE cart_items SET qty = $1 WHERE id = $2', [newQty, checkRes.rows[0].id]);
        } else {
            // Insert new item
            const query = `
                INSERT INTO cart_items (session_id, img, title, price, brand, qty, size, color)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `;
            const values = [sessionId, img, title, price, brand, qty || 1, size, color];
            await pool.query(query, values);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/cart/:sessionId/:itemId', async (req, res) => {
    const { delta } = req.body; // usually +1 or -1
    try {
        // get current qty
        const checkRes = await pool.query('SELECT qty FROM cart_items WHERE session_id = $1 AND id = $2', [req.params.sessionId, req.params.itemId]);
        if (checkRes.rowCount > 0) {
            let newQty = checkRes.rows[0].qty + delta;
            if (newQty < 1) newQty = 1;
            await pool.query('UPDATE cart_items SET qty = $1 WHERE id = $2', [newQty, req.params.itemId]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/cart/:sessionId/:itemId', async (req, res) => {
    try {
        await pool.query('DELETE FROM cart_items WHERE session_id = $1 AND id = $2', [req.params.sessionId, req.params.itemId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/cart/:sessionId', async (req, res) => {
    try {
        await pool.query('DELETE FROM cart_items WHERE session_id = $1', [req.params.sessionId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// WISHLIST API
// ==========================================

app.get('/api/wishlist/:sessionId', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM wishlist_items WHERE session_id = $1 ORDER BY id DESC', [req.params.sessionId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/wishlist/:sessionId', async (req, res) => {
    const { img, title, price, brand } = req.body;
    const sessionId = req.params.sessionId;

    try {
        const checkQuery = `SELECT id FROM wishlist_items WHERE session_id = $1 AND title = $2`;
        const checkRes = await pool.query(checkQuery, [sessionId, title]);
        
        if (checkRes.rowCount > 0) {
            // Remove it if it exists (Toggle behavior)
            await pool.query('DELETE FROM wishlist_items WHERE id = $1', [checkRes.rows[0].id]);
        } else {
            // Insert new item
            const query = `
                INSERT INTO wishlist_items (session_id, img, title, price, brand)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await pool.query(query, [sessionId, img, title, price, brand]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
