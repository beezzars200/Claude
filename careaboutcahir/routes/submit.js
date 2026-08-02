const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { CATEGORIES } = require('../lib/constants');

router.get('/', (req, res) => {
  res.render('submit', { categories: CATEGORIES, errors: null, values: {} });
});

router.post('/', async (req, res, next) => {
  try {
    const {
      type, title, description, category, location,
      event_date, event_time, contact_name, contact_email, contact_phone,
      website_url, image_url
    } = req.body;

    const errors = [];
    if (!['event', 'business', 'news'].includes(type)) errors.push('Please choose a valid listing type.');
    if (!title || !title.trim()) errors.push('Please give it a title.');
    if (type === 'event' && !event_date) errors.push('Please give the event a date.');
    if (!contact_email || !contact_email.trim()) errors.push('Please give us an email in case we need to check something with you.');

    if (errors.length) {
      return res.status(400).render('submit', { categories: CATEGORIES, errors, values: req.body });
    }

    await db.query(
      `INSERT INTO listings
        (type, title, description, category, location, event_date, event_time,
         contact_name, contact_email, contact_phone, website_url, image_url,
         source, status, submitted_by_name, submitted_by_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'community', 'pending', ?, ?)`,
      [
        type, title.trim(), description || null, category || null, location || null,
        type === 'event' ? (event_date || null) : null,
        type === 'event' ? (event_time || null) : null,
        contact_name || null, contact_email.trim(), contact_phone || null,
        website_url || null, image_url || null,
        contact_name || null, contact_email.trim()
      ]
    );

    res.redirect('/submit/thanks');
  } catch (err) {
    next(err);
  }
});

router.get('/thanks', (req, res) => {
  res.render('submit-thanks');
});

module.exports = router;
