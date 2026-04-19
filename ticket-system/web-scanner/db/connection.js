const mysql = require('mysql2/promise');

const pool = mysql.createPool(
  process.env.MYSQL_URL ||
  process.env.DATABASE_URL || {
    host: process.env.DB_HOST,
    user: process.env.DB_USER || process.env.MYSQLUSER,
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD,
    database: process.env.DB_NAME || process.env.MYSQL_DATABASE,
    port: process.env.DB_PORT || process.env.MYSQLPORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  }
);

module.exports = pool;
