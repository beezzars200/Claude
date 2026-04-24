const express = require('express');
const router = express.Router();

const requireSuperAdmin = (req, res, next) => {
  if (!req.session.authenticated || !req.session.isSuperAdmin) {
    return res.redirect('/auth/login');
  }
  next();
};

router.get('/manage', requireSuperAdmin, (req, res) => {
  res.render('manage', { username: req.session.username });
});

module.exports = router;
