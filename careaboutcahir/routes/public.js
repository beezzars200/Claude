const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { CATEGORIES, TYPE_LABELS } = require('../lib/constants');

router.get('/', async (req, res, next) => {
  try {
    const [events] = await db.query(
      `SELECT * FROM listings WHERE type = 'event' AND status = 'approved'
       AND (event_date IS NULL OR event_date >= CURDATE())
       ORDER BY event_date ASC LIMIT 4`
    );
    const [businesses] = await db.query(
      `SELECT * FROM listings WHERE type = 'business' AND status = 'approved'
       ORDER BY created_at DESC LIMIT 4`
    );
    const [news] = await db.query(
      `SELECT * FROM listings WHERE type = 'news' AND status = 'approved'
       ORDER BY created_at DESC LIMIT 3`
    );
    res.render('index', { events, businesses, news });
  } catch (err) {
    next(err);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const category = req.query.category || '';
    const params = ['event', 'approved'];
    let sql = `SELECT * FROM listings WHERE type = ? AND status = ?`;
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY (event_date IS NULL), event_date ASC';
    const [events] = await db.query(sql, params);
    res.render('events', { events, category, categories: CATEGORIES.event });
  } catch (err) {
    next(err);
  }
});

router.get('/businesses', async (req, res, next) => {
  try {
    const category = req.query.category || '';
    const params = ['business', 'approved'];
    let sql = `SELECT * FROM listings WHERE type = ? AND status = ?`;
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY title ASC';
    const [businesses] = await db.query(sql, params);
    res.render('businesses', { businesses, category, categories: CATEGORIES.business });
  } catch (err) {
    next(err);
  }
});

router.get('/news', async (req, res, next) => {
  try {
    const category = req.query.category || '';
    const params = ['news', 'approved'];
    let sql = `SELECT * FROM listings WHERE type = ? AND status = ?`;
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY created_at DESC';
    const [news] = await db.query(sql, params);
    res.render('news', { news, category, categories: CATEGORIES.news });
  } catch (err) {
    next(err);
  }
});

router.get('/listing/:id', async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM listings WHERE id = ? AND status = 'approved'`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).render('404');
    res.render('listing', { listing: rows[0], typeLabel: TYPE_LABELS[rows[0].type] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
