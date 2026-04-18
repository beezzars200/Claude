const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const { v4: uuidv4 } = require('crypto');

const requireApiKey = (req, res, next) => {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// --- Scan endpoint (no API key needed — used by door scanner) ---
router.post('/scan/:ticketNumber', async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.*, a.name, a.company, e.name as event_name, e.primary_color, e.accent_color
     FROM tickets t
     JOIN attendees a ON t.attendee_id = a.id
     JOIN events e ON t.event_id = e.id
     WHERE t.ticket_number = ?`,
    [req.params.ticketNumber]
  );

  if (!rows.length) {
    return res.json({ valid: false, message: 'Ticket not found' });
  }

  const ticket = rows[0];

  if (ticket.scanned) {
    return res.json({
      valid: false,
      alreadyUsed: true,
      name: ticket.name,
      company: ticket.company,
      event: ticket.event_name,
      scannedAt: ticket.scanned_at,
      message: 'Ticket already used'
    });
  }

  await db.query(
    'UPDATE tickets SET scanned = 1, scanned_at = NOW() WHERE ticket_number = ?',
    [req.params.ticketNumber]
  );

  return res.json({
    valid: true,
    name: ticket.name,
    company: ticket.company,
    event: ticket.event_name,
    ticketNumber: ticket.ticket_number,
    message: 'Welcome!'
  });
});

// --- Admin API endpoints (API key required — used by Electron app) ---

router.get('/organisations', requireApiKey, async (req, res) => {
  const [rows] = await db.query('SELECT * FROM organisations ORDER BY name');
  res.json(rows);
});

router.post('/organisations', requireApiKey, async (req, res) => {
  const { name, slug, logo_url, primary_color, secondary_color, accent_color } = req.body;
  const [result] = await db.query(
    'INSERT INTO organisations (name, slug, logo_url, primary_color, secondary_color, accent_color) VALUES (?, ?, ?, ?, ?, ?)',
    [name, slug, logo_url || null, primary_color || '#1a1a2e', secondary_color || '#ffffff', accent_color || '#e94560']
  );
  res.json({ id: result.insertId, name, slug });
});

router.get('/events', requireApiKey, async (req, res) => {
  const [rows] = await db.query(`
    SELECT e.*, o.name as org_name,
      COUNT(t.id) as total_tickets,
      SUM(t.scanned) as scanned_tickets
    FROM events e
    JOIN organisations o ON e.organisation_id = o.id
    LEFT JOIN tickets t ON t.event_id = e.id
    GROUP BY e.id
    ORDER BY e.event_date DESC
  `);
  res.json(rows);
});

router.post('/events', requireApiKey, async (req, res) => {
  const { organisation_id, name, event_date, event_time, venue, slug, logo_url, primary_color, secondary_color, accent_color } = req.body;
  const [result] = await db.query(
    `INSERT INTO events (organisation_id, name, event_date, event_time, venue, slug, logo_url, primary_color, secondary_color, accent_color)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [organisation_id, name, event_date, event_time || null, venue, slug, logo_url || null,
     primary_color || '#1a1a2e', secondary_color || '#ffffff', accent_color || '#e94560']
  );
  res.json({ id: result.insertId, name, slug });
});

router.post('/events/:eventId/import', requireApiKey, async (req, res) => {
  const { attendees } = req.body;
  const eventId = req.params.eventId;

  const tickets = [];
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (const a of attendees) {
      const [attResult] = await conn.query(
        'INSERT INTO attendees (event_id, name, email, mobile, company) VALUES (?, ?, ?, ?, ?)',
        [eventId, a.name, a.email || null, a.mobile || null, a.company || null]
      );
      const attendeeId = attResult.insertId;
      const qty = parseInt(a.tickets) || 1;
      for (let i = 0; i < qty; i++) {
        const ticketNumber = require('crypto').randomUUID();
        await conn.query(
          'INSERT INTO tickets (attendee_id, event_id, ticket_number) VALUES (?, ?, ?)',
          [attendeeId, eventId, ticketNumber]
        );
        tickets.push({ attendeeId, name: a.name, company: a.company, ticketNumber });
      }
    }
    await conn.commit();
    res.json({ success: true, ticketsCreated: tickets.length, tickets });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

router.get('/events/:eventId/tickets', requireApiKey, async (req, res) => {
  const [rows] = await db.query(
    `SELECT t.ticket_number, t.scanned, t.scanned_at, a.name, a.company, a.email, a.mobile
     FROM tickets t
     JOIN attendees a ON t.attendee_id = a.id
     WHERE t.event_id = ?
     ORDER BY a.name`,
    [req.params.eventId]
  );
  res.json(rows);
});

router.get('/events/:eventId/stats', requireApiKey, async (req, res) => {
  const [[stats]] = await db.query(
    `SELECT COUNT(*) as total, SUM(scanned) as scanned FROM tickets WHERE event_id = ?`,
    [req.params.eventId]
  );
  res.json(stats);
});

module.exports = router;
