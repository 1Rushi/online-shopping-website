# MODA E-Commerce Project

This is the fully functional backend and frontend for the MODA online fashion e-commerce website.

## Features
- **Customer Flows**: Registration, Login, Browsing, Filtering, Cart, Checkout, Order Tracking.
- **Admin Panel**: Dashboard Statistics, Product Management, Order Status Management.
- **Secure Backend**: Order calculations (tax, promos) are securely handled on the backend.
- **Database**: PostgreSQL database.

## Prerequisites
Make sure you have [Node.js](https://nodejs.org/) and [PostgreSQL](https://www.postgresql.org/) installed.

## How to Run the Project

1. **Clone the repository**:
   ```bash
   git clone https://github.com/1Rushi/online-shopping-website.git
   ```

2. **Navigate to the project folder**:
   ```bash
   cd online-shopping-website
   ```

3. **Install the required dependencies**:
   ```bash
   npm install
   ```

4. **Environment Variables**:
   Create a `.env` file in the root directory based on `.env.example`.
   ```env
   DB_USER=postgres
   DB_HOST=localhost
   DB_NAME=moda_db
   DB_PASSWORD=your_db_password
   DB_PORT=5432
   ADMIN_PASSWORD=your_admin_secret
   ```

5. **Database Setup**:
   Run the database creation script once to create tables:
   ```bash
   node create-db.js
   ```

6. **Start the server**:
   ```bash
   npm start
   ```

7. **Access the website**:
   - Customer UI: Open your browser and navigate to `http://localhost:3000`
   - Admin Panel: Navigate to `http://localhost:3000/admin.html` (You will be prompted for the `ADMIN_PASSWORD` defined in `.env`).

## Security Features Added
- Credentials moved to `.env` variables instead of hardcoded in code.
- Parameterized PostgreSQL queries to avoid SQL Injection.
- Backend authoritatively calculates all order totals and final pricing to prevent tampering.
- Backend verifies stock availability and locks row during checkout to prevent concurrent overselling.
- Admin APIs are protected via token authentication.
