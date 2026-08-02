require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const path = require('path');
const db = require('./db/connection');

const app = express();
const port = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('trust proxy', 1); // behind Railway's HTTPS proxy
app.locals.siteName = process.env.SITE_NAME || 'Care About Cahir';
// dateStrings:true means the db layer hands us plain 'YYYY-MM-DD[ HH:MM:SS]'
// strings — parse the date portion directly instead of going through Date(),
// which would otherwise reinterpret it in the server's local timezone.
function toUTCDate(d) {
  const [y, m, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
app.locals.formatDate = (d) => {
  if (!d) return '';
  return toUTCDate(d).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};
app.locals.formatDateShort = (d) => {
  if (!d) return '';
  return toUTCDate(d).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', timeZone: 'UTC' });
};
app.locals.typePath = { event: 'events', business: 'businesses', news: 'news' };

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET is not set — using an insecure fallback. Set it in your environment.');
}
app.use(session({
  secret: process.env.SESSION_SECRET || 'changeme-in-production',
  resave: false,
  saveUninitialized: false,
  store: new MySQLStore({ expiration: 86400000, createDatabaseTable: true }, db),
  cookie: { secure: 'auto', sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 }
}));

async function initDb() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS listings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      type ENUM('event', 'business', 'news') NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category VARCHAR(100),
      location VARCHAR(255),
      event_date DATE NULL,
      event_time VARCHAR(50) NULL,
      contact_name VARCHAR(255),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(50),
      website_url VARCHAR(500),
      image_url VARCHAR(500),
      source VARCHAR(20) NOT NULL DEFAULT 'community',
      status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
      submitted_by_name VARCHAR(255),
      submitted_by_email VARCHAR(255),
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_at TIMESTAMP NULL,
      reviewed_by VARCHAR(100)
    )
  `);
  await db.query(`CREATE INDEX idx_listings_status ON listings(status)`).catch(() => {});
  await db.query(`CREATE INDEX idx_listings_type ON listings(type)`).catch(() => {});
  await db.query(`CREATE INDEX idx_listings_event_date ON listings(event_date)`).catch(() => {});
  console.log('Database ready');
}

app.use('/', require('./routes/public'));
app.use('/submit', require('./routes/submit'));
app.use('/admin', require('./routes/admin'));

app.use((req, res) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something went wrong. Please try again shortly.');
});

initDb().then(() => {
  app.listen(port, () => console.log(`Care About Cahir running on port ${port}`));
}).catch(err => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});

module.exports = app;
