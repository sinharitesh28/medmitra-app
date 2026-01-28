// Example: db.js or wherever you configure your connection

const mysql = require('mysql2');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '', // Allow env var for password
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || 'clinipraxis',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Enable SSL if configured (Required for Aiven/TiDB/Azure/AWS)
if (process.env.DB_SSL === 'true') {
    dbConfig.ssl = {
        rejectUnauthorized: false // Often required for self-signed or free-tier certs
    };
}

const pool = mysql.createPool(dbConfig);

module.exports = pool.promise();
