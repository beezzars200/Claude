const mysql = require('mysql2/promise');

let config;
const dbUrl = process.env.DATABASE_URL || process.env.MYSQL_PUBLIC_URL || process.env.MYSQL_URL;

if (dbUrl) {
  const parsed = new URL(dbUrl);
  config = {
    host: parsed.hostname,
    port: parseInt(parsed.port) || 3306,
    user: parsed.username,
    password: parsed.password,
    database: parsed.pathname.slice(1),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
} else {
  config = {
    host: process.env.MYSQLHOST || process.env.DB_HOST || 'localhost',
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME,
    port: parseInt(process.env.MYSQLPORT || process.env.DB_PORT || 3306),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  };
}

console.log(`DB config: host=${config.host} port=${config.port} user=${config.user} db=${config.database}`);

const pool = mysql.createPool(config);
module.exports = pool;
