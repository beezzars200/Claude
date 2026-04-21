const express = require('express');
const router = express.Router();
const db = require('../db/connection');

const requireAuth = (req, res, next) => {
  if (!req.session.authenticated) return res.redirect('/auth/login');
  next();
};

router.get('/', (req, res) => res.redirect('/events'));

router.get('/events', async (req, res) => {
  let query = `
    SELECT e.*, o.name as org_name, o.slug as org_slug,
      COUNT(t.id) as total_tickets, SUM(t.scanned) as scanned_tickets
    FROM events e
    JOIN organisations o ON e.organisation_id = o.id
    LEFT JOIN tickets t ON t.event_id = e.id
    WHERE e.is_active = 1
  `;
  const params = [];
  if (req.session && req.session.organisationId) {
    query += ' AND e.organisation_id = ?';
    params.push(req.session.organisationId);
  }
  query += ' GROUP BY e.id ORDER BY e.event_date DESC';
  const [events] = await db.query(query, params);
  res.render('events-list', { events });
});

router.get('/events/:slug/scan', async (req, res) => {
  const [rows] = await db.query(
    `SELECT e.*, o.name as org_name FROM events e
     JOIN organisations o ON e.organisation_id = o.id
     WHERE e.slug = ? AND e.is_active = 1`,
    [req.params.slug]
  );
  if (!rows.length) return res.status(404).send('Event not found');
  res.render('scanner', { event: rows[0], baseUrl: process.env.BASE_URL || '' });
});

router.get('/verify/:ticketNumber', async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.*, a.name, a.company, e.name as event_name, e.event_date
     FROM tickets t JOIN attendees a ON t.attendee_id = a.id
     JOIN events e ON t.event_id = e.id
     WHERE t.ticket_number = ?`,
    [req.params.ticketNumber]
  );
  if (!rows.length) return res.status(404).json({ valid: false, message: 'Ticket not found' });
  const t = rows[0];
  res.json({ valid: true, scanned: !!t.scanned, name: t.name, company: t.company, event: t.event_name, ticketNumber: t.ticket_number, scannedAt: t.scanned_at });
});

router.get('/admin', requireAuth, async (req, res) => {
  let eventsQuery = `
    SELECT e.*, o.name as org_name,
      COUNT(t.id) as total_tickets, SUM(t.scanned) as scanned_tickets
    FROM events e JOIN organisations o ON e.organisation_id = o.id
    LEFT JOIN tickets t ON t.event_id = e.id
  `;
  const params = [];
  if (req.session.organisationId) {
    eventsQuery += ' WHERE e.organisation_id = ?';
    params.push(req.session.organisationId);
  }
  eventsQuery += ' GROUP BY e.id ORDER BY e.created_at DESC';
  const [events] = await db.query(eventsQuery, params);
  const [orgs] = await db.query('SELECT * FROM organisations ORDER BY name');
  res.render('admin', { events, orgs, username: req.session.username, isSuperAdmin: req.session.isSuperAdmin });
});

module.exports = router;
