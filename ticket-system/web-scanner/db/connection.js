const mysql = require('mysql2/promise');

const pool = mysql.createPool(
  process.env.MYSQL_URL || {
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME,
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }
);

module.exports = pool;
