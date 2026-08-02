const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { CATEGORIES, TYPE_LABELS } = require('../lib/constants');

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.redirect('/admin/login');
}

router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/admin');
  res.render('admin/login', { error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.redirect('/admin');
  }
  res.render('admin/login', { error: 'Invalid username or password' });
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin/login'));
});

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const [pending] = await db.query(
      `SELECT * FROM listings WHERE status = 'pending' ORDER BY created_at ASC`
    );
    res.render('admin/queue', { pending, typeLabels: TYPE_LABELS });
  } catch (err) {
    next(err);
  }
});

router.post('/listings/:id/approve', async (req, res, next) => {
  try {
    await db.query(
      `UPDATE listings SET status = 'approved', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [req.session.username, req.params.id]
    );
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.post('/listings/:id/reject', async (req, res, next) => {
  try {
    await db.query(
      `UPDATE listings SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [req.session.username, req.params.id]
    );
    res.redirect('/admin');
  } catch (err) {
    next(err);
  }
});

router.get('/listings', async (req, res, next) => {
  try {
    const status = ['approved', 'rejected'].includes(req.query.status) ? req.query.status : 'approved';
    const [listings] = await db.query(
      `SELECT * FROM listings WHERE status = ? ORDER BY created_at DESC`,
      [status]
    );
    res.render('admin/listings', { listings, status, typeLabels: TYPE_LABELS });
  } catch (err) {
    next(err);
  }
});

router.get('/listings/new', (req, res) => {
  res.render('admin/form', { mode: 'new', listing: {}, categories: CATEGORIES, errors: null });
});

router.post('/listings/new', async (req, res, next) => {
  try {
    const listing = extractListingFields(req.body);
    const errors = validateListing(listing);
    if (errors.length) {
      return res.status(400).render('admin/form', { mode: 'new', listing: req.body, categories: CATEGORIES, errors });
    }
    await db.query(
      `INSERT INTO listings
        (type, title, description, category, location, event_date, event_time,
         contact_name, contact_email, contact_phone, website_url, image_url,
         source, status, reviewed_at, reviewed_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'curated', 'approved', NOW(), ?)`,
      [
        listing.type, listing.title, listing.description, listing.category, listing.location,
        listing.event_date, listing.event_time, listing.contact_name, listing.contact_email,
        listing.contact_phone, listing.website_url, listing.image_url, req.session.username
      ]
    );
    res.redirect('/admin/listings');
  } catch (err) {
    next(err);
  }
});

router.get('/listings/:id/edit', async (req, res, next) => {
  try {
    const [rows] = await db.query('SELECT * FROM listings WHERE id = ?', [req.params.id]);
    if (!rows.length) return res.status(404).render('404');
    res.render('admin/form', { mode: 'edit', listing: rows[0], categories: CATEGORIES, errors: null });
  } catch (err) {
    next(err);
  }
});

router.post('/listings/:id/edit', async (req, res, next) => {
  try {
    const listing = extractListingFields(req.body);
    const errors = validateListing(listing);
    if (errors.length) {
      return res.status(400).render('admin/form', { mode: 'edit', listing: { ...req.body, id: req.params.id }, categories: CATEGORIES, errors });
    }
    await db.query(
      `UPDATE listings SET type = ?, title = ?, description = ?, category = ?, location = ?,
         event_date = ?, event_time = ?, contact_name = ?, contact_email = ?, contact_phone = ?,
         website_url = ?, image_url = ? WHERE id = ?`,
      [
        listing.type, listing.title, listing.description, listing.category, listing.location,
        listing.event_date, listing.event_time, listing.contact_name, listing.contact_email,
        listing.contact_phone, listing.website_url, listing.image_url, req.params.id
      ]
    );
    res.redirect('/admin/listings');
  } catch (err) {
    next(err);
  }
});

router.post('/listings/:id/delete', async (req, res, next) => {
  try {
    await db.query('DELETE FROM listings WHERE id = ?', [req.params.id]);
    const status = req.body.redirect_status === 'rejected' ? 'rejected' : 'approved';
    res.redirect(`/admin/listings?status=${status}`);
  } catch (err) {
    next(err);
  }
});

function extractListingFields(body) {
  const {
    type, title, description, category, location,
    event_date, event_time, contact_name, contact_email, contact_phone,
    website_url, image_url
  } = body;
  return {
    type,
    title: (title || '').trim(),
    description: description || null,
    category: category || null,
    location: location || null,
    event_date: type === 'event' ? (event_date || null) : null,
    event_time: type === 'event' ? (event_time || null) : null,
    contact_name: contact_name || null,
    contact_email: contact_email || null,
    contact_phone: contact_phone || null,
    website_url: website_url || null,
    image_url: image_url || null
  };
}

function validateListing(listing) {
  const errors = [];
  if (!['event', 'business', 'news'].includes(listing.type)) errors.push('Please choose a valid listing type.');
  if (!listing.title) errors.push('Please give it a title.');
  if (listing.type === 'event' && !listing.event_date) errors.push('Please give the event a date.');
  return errors;
}

module.exports = router;
