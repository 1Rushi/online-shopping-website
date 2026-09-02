require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Admin Authentication Middleware
const adminAuth = (req, res, next) => {
    // Only check if it's an admin route or an admin parameter is passed
    if (req.path.startsWith('/api/admin') || req.query.admin || (req.path.startsWith('/api/settings') && req.method !== 'GET') || (req.path.startsWith('/api/products') && req.method !== 'GET') || (req.path.startsWith('/api/orders') && (req.method === 'PUT' || req.method === 'DELETE'))) {
        const token = req.headers['x-admin-token'];
        if (token !== (process.env.ADMIN_PASSWORD || 'secret')) {
            return res.status(401).json({ error: 'Unauthorized Admin Access' });
        }
    }
    next();
};

app.use(adminAuth);

// Initialize PostgreSQL connection pool
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
});

pool.connect((err, client, release) => {
    if (err) {
        console.error('Error connecting to PostgreSQL', err.stack);
    } else {
        console.log('Connected to PostgreSQL database "moda_db".');
        
        // Ensure user_id column exists on orders table and stock on products table
        Promise.all([
            client.query('ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER'),
            client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER DEFAULT 0'),
            client.query('ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT DEFAULT \'\'')
        ])
            .then(() => console.log('Checked user_id column in orders, stock and colors columns in products.'))
            .catch(e => console.error('Error altering tables:', e.message))
            .finally(() => release());
    }
});

// ==========================================
// AUTH API
// ==========================================

app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
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
            console.error('Register error:', err);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
    }
    try {
        const { rows } = await pool.query('SELECT id, name, email FROM users WHERE email = $1 AND password = $2', [email, password]);
        if (rows.length > 0) {
            res.json({ success: true, user: rows[0] });
        } else {
            res.status(401).json({ error: 'Invalid email or password.' });
        }
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.put('/api/users/:id', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let query, values;
        if (password && password.trim() !== '') {
            query = 'UPDATE users SET name = $1, email = $2, password = $3 WHERE id = $4 RETURNING id, name, email;';
            values = [name, email, password, req.params.id];
        } else {
            query = 'UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING id, name, email;';
            values = [name, email, req.params.id];
        }
        const { rows } = await pool.query(query, values);
        if (rows.length > 0) {
            res.json({ success: true, user: rows[0] });
        } else {
            res.status(404).json({ error: 'User not found.' });
        }
    } catch (err) {
        if (err.code === '23505') { 
            res.status(400).json({ error: 'Email already exists.' });
        } else {
            res.status(500).json({ error: err.message });
        }
    }
});

// ==========================================
// PRODUCTS API
// ==========================================

app.get('/api/products', async (req, res) => {
    try {
        if (req.query.admin) {
            const { rows } = await pool.query('SELECT * FROM products ORDER BY id DESC');
            res.json(rows);
        } else {
            const { rows } = await pool.query('SELECT id, title, price, category, brand, img, sizes, colors, stock FROM products ORDER BY id DESC');
            res.json(rows);
        }
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
    const { title, price, category, brand, img, img2, img3, sizes, colors, description, material, shipping, stock } = req.body;
    if (!title || !price || isNaN(price)) {
        return res.status(400).json({ error: 'Valid title and price are required.' });
    }
    console.log('Received description:', description);
    console.log('Received material:', material);
    console.log('Received shipping:', shipping);
    try {
        const query = `
            INSERT INTO products (title, price, category, brand, img, img2, img3, sizes, colors, description, material, shipping, stock)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id;
        `;
        const values = [title, price, category, brand, img, img2, img3, sizes || '', colors || '', description || '', material || '', shipping || '', stock || 0];
        const { rows } = await pool.query(query, values);
        res.json({ id: rows[0].id });
    } catch (err) {
        console.error('Error saving product:', err);
        res.status(500).json({ error: 'Internal Server Error' });
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

app.put('/api/products/:id/stock', async (req, res) => {
    try {
        const { stock } = req.body;
        if (stock === undefined || isNaN(stock) || stock < 0) {
            return res.status(400).json({ error: 'Valid stock quantity is required.' });
        }
        await pool.query('UPDATE products SET stock = $1 WHERE id = $2', [stock, req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Update stock error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// ==========================================
// REVIEWS API
// ==========================================

app.get('/api/reviews/:productId', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC', [req.params.productId]);
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/reviews', async (req, res) => {
    const { product_id, reviewer_name, rating, title, content } = req.body;
    try {
        const query = `
            INSERT INTO reviews (product_id, reviewer_name, rating, title, content)
            VALUES ($1, $2, $3, $4, $5) RETURNING *;
        `;
        const values = [product_id, reviewer_name, rating, title, content];
        const { rows } = await pool.query(query, values);
        res.json({ success: true, review: rows[0] });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// ORDERS API
// ==========================================

app.get('/api/orders', async (req, res) => {
    try {
        const days = parseInt(req.query.days);
        let query = 'SELECT * FROM orders';
        const params = [];
        if (!isNaN(days)) {
            query += " WHERE created_at >= NOW() - INTERVAL '" + days + " days'";
        }
        query += ' ORDER BY created_at DESC';
        const { rows } = await pool.query(query);
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
    const { items, customer_info, user_id, promo_code } = req.body;
    
    if (!items || items.length === 0) {
        return res.status(400).json({ error: 'Order items cannot be empty.' });
    }

    const shipDate = new Date();
    shipDate.setDate(shipDate.getDate() + 3);
    const shipping_date = shipDate.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    try {
        await pool.query('BEGIN');
        
        let calculatedSubtotal = 0;
        const validItems = [];

        for (const item of items) {
            const prodId = item.product_id || item.id;
            if (!prodId || !item.qty || item.qty <= 0) {
                throw new Error('Invalid item data.');
            }
            
            // Lock row for update to prevent overselling
            const productRes = await pool.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [prodId]);
            if (productRes.rows.length === 0) {
                throw new Error(`Product not found.`);
            }
            
            const product = productRes.rows[0];
            if (product.stock < item.qty) {
                throw new Error(`Insufficient stock for product ${product.title}.`);
            }
            
            calculatedSubtotal += (product.price * item.qty);
            validItems.push({
                product_id: product.id,
                title: product.title,
                price: product.price, // Trusting backend price
                qty: item.qty,
                size: item.size,
                color: item.color,
                img: product.img
            });
        }

        // Apply promo if valid
        let discountMultiplier = 0;
        const settingsPath = path.join(__dirname, 'settings.json');
        if (promo_code) {
            let activePromo = 'MODA20';
            let activeDiscount = 20;
            if (fs.existsSync(settingsPath)) {
                const settingsData = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (settingsData.promoCode) activePromo = settingsData.promoCode;
                if (settingsData.promoDiscount) activeDiscount = settingsData.promoDiscount;
            }
            
            if (promo_code.toUpperCase() === activePromo.toUpperCase()) {
                discountMultiplier = activeDiscount / 100;
            }
        }
        
        const discountAmt = calculatedSubtotal * discountMultiplier;
        const discountedSubtotal = calculatedSubtotal - discountAmt;
        const tax = discountedSubtotal * 0.0824;
        const finalTotal = parseFloat((discountedSubtotal + tax).toFixed(2));

        const query = `
            INSERT INTO orders (items, total_price, customer_info, shipping_date, user_id)
            VALUES ($1, $2, $3, $4, $5) RETURNING id;
        `;
        const values = [
            JSON.stringify(validItems), 
            finalTotal, 
            JSON.stringify(customer_info), 
            shipping_date,
            user_id || null
        ];
        const { rows } = await pool.query(query, values);
        
        for (const item of validItems) {
            await pool.query('UPDATE products SET stock = stock - $1 WHERE id = $2', [item.qty, item.product_id]);
        }
        
        await pool.query('COMMIT');
        res.json({ id: rows[0].id, shipping_date, total_price: finalTotal });
    } catch (err) {
        await pool.query('ROLLBACK');
        res.status(400).json({ error: err.message });
    }
});

app.get('/api/orders/user/:userId', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC', [req.params.userId]);
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

app.put('/api/orders/:id/status', async (req, res) => {
    const { status } = req.body;
    try {
        await pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, req.params.id]);
        res.json({ updatedID: req.params.id, status });
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
// ADMIN API
// ==========================================

app.get('/api/admin/bestselling-product', async (req, res) => {
    try {
        // User specifically requested to only show the highest sold product for the current month
        let dateFilter = "o.status != 'Cancelled' AND date_trunc('month', o.created_at) = date_trunc('month', CURRENT_DATE)";

        // Query to get the most sold product based on order items
        const query = `
            SELECT 
                p.id, 
                p.title, 
                p.img, 
                p.price, 
                p.brand,
                SUM((item->>'qty')::int) as total_sold,
                SUM(((item->>'qty')::int) * p.price) as total_revenue
            FROM orders o,
            json_array_elements(o.items::json) as item
            JOIN products p ON item->>'title' = p.title
            WHERE ${dateFilter}
            GROUP BY p.id, p.title, p.img, p.price, p.brand
            ORDER BY total_sold DESC
            LIMIT 1;
        `;
        const { rows } = await pool.query(query);
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.json(null);
        }
    } catch (err) {
        console.error('Error fetching best-selling product:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/category-sales-percentage', async (req, res) => {
    try {
        const days = parseInt(req.query.days);
        let dateFilter = "o.status != 'Cancelled'";
        if (!isNaN(days)) {
            dateFilter += " AND o.created_at >= NOW() - INTERVAL '" + days + " days'";
        }
        const defaultCategories = [
            'T-SHIRTS', 'SHIRTS', 'JEANS', 'JACKETS', 'TROUSERS', 
            'BLAZERS', 'SHOES', 'ACCESSORIES', 'TOPS', 'DRESSES', 
            'SKIRTS', 'BAGS'
        ];
        
        const allCategories = defaultCategories;
        console.log('All categories to return:', allCategories);
        
        const query = `
            WITH CategorySales AS (
                SELECT
                    CASE
                        WHEN p.title ILIKE '%t-shirt%' THEN 'T-SHIRTS'
                        WHEN p.title ILIKE '%shirt%' THEN 'SHIRTS'
                        WHEN p.title ILIKE '%jeans%' THEN 'JEANS'
                        WHEN p.title ILIKE '%jacket%' THEN 'JACKETS'
                        WHEN p.title ILIKE '%trouser%' THEN 'TROUSERS'
                        WHEN p.title ILIKE '%blazer%' THEN 'BLAZERS'
                        WHEN p.title ILIKE '%shoe%' OR p.title ILIKE '%sneaker%' OR p.title ILIKE '%sandal%' OR p.title ILIKE '%heel%' OR p.title ILIKE '%boot%' THEN 'SHOES'
                        WHEN p.title ILIKE '%bag%' OR p.title ILIKE '%backpack%' OR p.title ILIKE '%satchel%' THEN 'BAGS'
                        WHEN p.title ILIKE '%top%' THEN 'TOPS'
                        WHEN p.title ILIKE '%dress%' THEN 'DRESSES'
                        WHEN p.title ILIKE '%skirt%' THEN 'SKIRTS'
                        WHEN p.title ILIKE '%watch%' OR p.title ILIKE '%belt%' OR p.title ILIKE '%sunglass%' OR p.title ILIKE '%necklace%' OR p.title ILIKE '%hat%' OR p.title ILIKE '%cap%' OR p.title ILIKE '%wallet%' THEN 'ACCESSORIES'
                        ELSE 'OTHER'
                    END as category,
                    SUM((item->>'qty')::int) AS total_qty_sold
                FROM orders o,
                json_array_elements(o.items::json) AS item
                JOIN products p ON item->>'title' = p.title
                WHERE ${dateFilter}
                GROUP BY 
                    CASE
                        WHEN p.title ILIKE '%t-shirt%' THEN 'T-SHIRTS'
                        WHEN p.title ILIKE '%shirt%' THEN 'SHIRTS'
                        WHEN p.title ILIKE '%jeans%' THEN 'JEANS'
                        WHEN p.title ILIKE '%jacket%' THEN 'JACKETS'
                        WHEN p.title ILIKE '%trouser%' THEN 'TROUSERS'
                        WHEN p.title ILIKE '%blazer%' THEN 'BLAZERS'
                        WHEN p.title ILIKE '%shoe%' OR p.title ILIKE '%sneaker%' OR p.title ILIKE '%sandal%' OR p.title ILIKE '%heel%' OR p.title ILIKE '%boot%' THEN 'SHOES'
                        WHEN p.title ILIKE '%bag%' OR p.title ILIKE '%backpack%' OR p.title ILIKE '%satchel%' THEN 'BAGS'
                        WHEN p.title ILIKE '%top%' THEN 'TOPS'
                        WHEN p.title ILIKE '%dress%' THEN 'DRESSES'
                        WHEN p.title ILIKE '%skirt%' THEN 'SKIRTS'
                        WHEN p.title ILIKE '%watch%' OR p.title ILIKE '%belt%' OR p.title ILIKE '%sunglass%' OR p.title ILIKE '%necklace%' OR p.title ILIKE '%hat%' OR p.title ILIKE '%cap%' OR p.title ILIKE '%wallet%' THEN 'ACCESSORIES'
                        ELSE 'OTHER'
                    END
            ),
            TotalSales AS (
                SELECT SUM(total_qty_sold) AS overall_total_qty_sold
                FROM CategorySales
                WHERE category != 'OTHER'
            )
            SELECT
                cs.category,
                cs.total_qty_sold,
                (cs.total_qty_sold * 100.0 / ts.overall_total_qty_sold) AS percentage_sold
            FROM CategorySales cs, TotalSales ts
            WHERE ts.overall_total_qty_sold > 0 AND cs.category != 'OTHER'
            ORDER BY percentage_sold DESC;
        `;
        const { rows } = await pool.query(query);
        console.log('Query results:', rows);
        
        // Create a map of existing category sales
        const salesMap = {};
        rows.forEach(row => {
            salesMap[row.category.toUpperCase()] = {
                category: row.category,
                total_qty_sold: row.total_qty_sold,
                percentage_sold: row.percentage_sold
            };
        });
        console.log('Sales map:', salesMap);
        
        // Build result with all categories (0 sales for missing ones)
        let result = allCategories.map(cat => {
            const upperCat = cat.toUpperCase();
            if (salesMap[upperCat]) {
                return salesMap[upperCat];
            } else {
                return {
                    category: cat,
                    total_qty_sold: '0',
                    percentage_sold: '0'
                };
            }
        });
        
        // Sort by percentage sold descending and filter out 0% sales
        result = result
            .filter(item => parseFloat(item.percentage_sold) > 0)
            .sort((a, b) => parseFloat(b.percentage_sold) - parseFloat(a.percentage_sold));
        
        console.log('Final result:', result);
        res.json(result);
    } catch (err) {
        console.error('Error fetching category sales percentage:', err);
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/admin/customers', async (req, res) => {
    try {
        const query = `
            SELECT 
                u.id, 
                u.name, 
                u.email, 
                COUNT(o.id) as total_orders, 
                COALESCE(SUM(o.total_price), 0) as total_spent,
                MAX(o.created_at) as last_order_date
            FROM users u
            LEFT JOIN orders o ON u.id = o.user_id
            GROUP BY u.id
            ORDER BY u.id DESC;
        `;
        const { rows } = await pool.query(query);
        res.json(rows);
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

// ==========================================
// SETTINGS API (Categories Visibility)
// ==========================================
const settingsPath = path.join(__dirname, 'settings.json');

app.get('/api/settings', (req, res) => {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            res.json(data);
        } else {
            res.json({ hidden: [], promoCode: 'MODA20', promoDiscount: 20 });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/settings/categories', (req, res) => {
    try {
        if (fs.existsSync(settingsPath)) {
            const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            res.json({ hidden: data.hidden || [] });
        } else {
            res.json({ hidden: [] });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings/categories', (req, res) => {
    try {
        const { hidden } = req.body;
        let data = { hidden: [], promoCode: 'MODA20', promoDiscount: 20 };
        if (fs.existsSync(settingsPath)) {
            data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
        data.hidden = hidden;
        fs.writeFileSync(settingsPath, JSON.stringify(data), 'utf8');
        res.json({ success: true, hidden });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/settings/promo', (req, res) => {
    try {
        const { promoCode, promoDiscount } = req.body;
        let data = { hidden: [], promoCode: 'MODA20', promoDiscount: 20 };
        if (fs.existsSync(settingsPath)) {
            data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        }
        data.promoCode = promoCode;
        data.promoDiscount = promoDiscount;
        fs.writeFileSync(settingsPath, JSON.stringify(data), 'utf8');
        res.json({ success: true, promoCode, promoDiscount });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
