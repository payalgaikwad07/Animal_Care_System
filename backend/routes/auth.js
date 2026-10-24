const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// REGISTER: public users only. Staff and admins are never created here.
router.post('/register', async (req, res) => {
  const { name, phone, address, password } = req.body;
  const email = (req.body.email || '').trim().toLowerCase();

  if (!name || !email || !phone || !address || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    // the email must not exist in users OR staff
    const [u] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
    const [s] = await db.query('SELECT staff_id FROM staff WHERE email = ?', [email]);
    if (u.length || s.length) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO users (name, email, phone, address, password_hash) VALUES (?,?,?,?,?)',
      [name, email, phone, address, hash]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN: staff (with can_login = 1) first, then public users
router.post('/login', async (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const bad = { error: 'Invalid email or password' };

  try {
    const [st] = await db.query('SELECT * FROM staff WHERE email = ? AND can_login = 1', [email]);
    if (st.length) {
      const s = st[0];
      if (!s.password_hash || !(await bcrypt.compare(password, s.password_hash))) {
        return res.status(401).json(bad);
      }
      req.session.user = { id: s.staff_id, name: s.name, role: s.role, shelter_id: s.shelter_id };
      return res.json({ role: s.role });
    }

    const [us] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (!us.length || !(await bcrypt.compare(password, us[0].password_hash))) {
      return res.status(401).json(bad);
    }
    req.session.user = { id: us[0].user_id, name: us[0].name, role: 'user', shelter_id: null };
    res.json({ role: 'user' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGOUT
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// ME: used by the navbar
router.get('/me', (req, res) => {
  const u = req.session.user;
  if (!u) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, name: u.name, role: u.role });
});

// TEMPORARY test route. Delete before the final merge.
router.get('/admin-test', needLogin, onlyRole('Admin', 'Global Admin'), (req, res) => {
  res.json({ ok: true, role: req.session.user.role });
});

module.exports = router;