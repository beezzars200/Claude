const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.authenticated) return res.redirect('/admin');
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const validUser = username === process.env.ADMIN_USERNAME;
  const validPass = await bcrypt.compare(password, await bcrypt.hash(process.env.ADMIN_PASSWORD, 10))
    .catch(() => password === process.env.ADMIN_PASSWORD);

  if (validUser && (password === process.env.ADMIN_PASSWORD)) {
    req.session.authenticated = true;
    req.session.username = username;
    return res.redirect('/admin');
  }
  res.render('login', { error: 'Invalid username or password' });
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;
