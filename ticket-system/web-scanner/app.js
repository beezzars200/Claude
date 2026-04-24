require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const db = require('./db/connection');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS organisations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(100) UNIQUE NOT NULL,
      logo_url VARCHAR(500),
      primary_color VARCHAR(7) DEFAULT '#0f172a',
      secondary_color VARCHAR(7) DEFAULT '#ffffff',
      accent_color VARCHAR(7) DEFAULT '#6366f1',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      organisation_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      event_date DATE NOT NULL,
      event_time VARCHAR(50),
      venue VARCHAR(255),
      slug VARCHAR(150) UNIQUE NOT NULL,
      logo_url VARCHAR(500),
      primary_color VARCHAR(7) DEFAULT '#0f172a',
      secondary_color VARCHAR(7) DEFAULT '#ffffff',
      accent_color VARCHAR(7) DEFAULT '#6366f1',
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS attendees (
      id INT AUTO_INCREMENT PRIMARY KEY,
      event_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      mobile VARCHAR(50),
      company VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      attendee_id INT NOT NULL,
      event_id INT NOT NULL,
      ticket_number VARCHAR(36) UNIQUE NOT NULL,
      scanned TINYINT(1) DEFAULT 0,
      scanned_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attendee_id) REFERENCES attendees(id) ON DELETE CASCADE,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    )
  `);
  await db.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      organisation_id INT DEFAULT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE
    )
  `);
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tickets_number ON tickets(ticket_number)`).catch(() => {});
  await db.query(`CREATE INDEX IF NOT EXISTS idx_tickets_event ON tickets(event_id)`).catch(() => {});
  await db.query(`CREATE INDEX IF NOT EXISTS idx_events_slug ON events(slug)`).catch(() => {});
  // Widen logo columns to handle base64 image data
  await db.query(`ALTER TABLE organisations MODIFY COLUMN logo_url MEDIUMTEXT`).catch(() => {});
  await db.query(`ALTER TABLE events MODIFY COLUMN logo_url MEDIUMTEXT`).catch(() => {});
  console.log('Database ready');
}

app.use('/', require('./routes/events'));
app.use('/', require('./routes/manage'));
app.use('/auth', require('./routes/auth'));
app.use('/api', require('./routes/api'));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

initDb().then(() => {
  app.listen(port, () => console.log(`UMN Ticket Scanner running on port ${port}`));
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});

module.exports = app;
