const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const db = require('../db/connection');

router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  // Check DB-based admin users first
  try {
    const [rows] = await db.query('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (rows.length) {
      const user = rows[0];
      const valid = await bcrypt.compare(password, user.password_hash);
      if (valid) {
        req.session.authenticated = true;
        req.session.username = username;
        req.session.organisationId = user.organisation_id || null;
        req.session.isSuperAdmin = !user.organisation_id;
        return res.redirect(user.organisation_id ? '/admin' : '/manage');
      }
    }
  } catch (e) {}

  // Fallback: env var super admin
  if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
    req.session.authenticated = true;
    req.session.username = username;
    req.session.organisationId = null;
    req.session.isSuperAdmin = true;
    return res.redirect('/manage');
  }

  res.render('login', { error: 'Invalid username or password' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
