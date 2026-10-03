const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'interview_practice',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection on startup
(async () => {
    try {
        const conn = await pool.getConnection();
        console.log(`MySQL Database Pool connected to '${process.env.DB_NAME || 'interview_practice'}' on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);
        conn.release();
    } catch (err) {
        console.error('CRITICAL: Failed to connect to MySQL pool:', err);
    }
})();

module.exports = pool;
