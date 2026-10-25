const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// The check is put on each route (not with router.use), so it can never block
// other /api/admin routes that live in other files.
const viewers = [needLogin, onlyRole('Admin', 'Global Admin')]; // can see the staff list
const creators = [needLogin, onlyRole('Admin', 'Global Admin')]; // can add staff
const editors = [needLogin, onlyRole('Admin')];                    // shelter admin can edit local staff

// A shelter admin can only add these two roles. They can never create another admin.
const LOCAL_ROLES = ['Vet', 'Caretaker'];

// Clean up and check the form fields.
// Returns { error } if something is wrong, or the clean values.
function check(b) {
  const name = (b.name || '').trim();
  const email = (b.email || '').trim().toLowerCase();
  const phone = (b.phone || '').trim();

  if (!name || name.length > 100) return { error: 'Name is required (max 100 characters)' };
  if (email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'A valid email is required' };
  if (phone.length > 15) return { error: 'Phone is too long (max 15 characters)' };
  if (!LOCAL_ROLES.includes(b.role)) return { error: 'Role must be Vet or Caretaker' };
  return { name, email, phone, role: b.role };
}

// ---------- LIST ----------
// GET /api/admin/staff?shelter_id=2
// Shelter admin: staff of their own shelter. Global Admin: all staff, or one shelter.
// The password is never sent to the browser.
router.get('/staff', ...viewers, async (req, res) => {
  try {
    const u = req.session.user;
    const sid = u.role === 'Admin' ? u.shelter_id : Number(req.query.shelter_id) || null;

    const [rows] = await db.query(
      `SELECT st.staff_id, st.name, st.email, st.phone, st.role, st.can_login,
              st.shelter_id, s.name AS shelter
       FROM staff st LEFT JOIN shelter s ON s.shelter_id = st.shelter_id
       ${sid ? 'WHERE st.shelter_id = ?' : ''}
       ORDER BY s.name, st.role, st.name`,
      sid ? [sid] : []);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- ADD ----------
// POST /api/admin/staff
// Global Admin: creates Shelter Admin with login access, assigned shelter, and temporary password.
// Shelter Admin: adds local staff (Vet, Caretaker) for their own shelter without login access.
router.post('/staff', ...creators, async (req, res) => {
  const user = req.session.user;

  // Case 1: Global Admin creating a Shelter Admin
  if (user.role === 'Global Admin') {
    const name = (req.body.name || '').trim();
    const email = (req.body.email || '').trim().toLowerCase();
    const phone = (req.body.phone || '').trim();
    const password = req.body.password || '';
    const shelter_id = Number(req.body.shelter_id);

    if (!name || name.length > 100) return res.status(400).json({ error: 'Name is required (max 100 characters)' });
    if (!email || email.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    if (phone.length > 15) return res.status(400).json({ error: 'Phone is too long (max 15 characters)' });
    if (!shelter_id || !Number.isInteger(shelter_id)) {
      return res.status(400).json({ error: 'Please choose a valid shelter' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Temporary password must be at least 6 characters' });
    }

    try {
      const [sh] = await db.query('SELECT shelter_id FROM shelter WHERE shelter_id = ?', [shelter_id]);
      if (!sh.length) return res.status(400).json({ error: 'Shelter not found' });

      const [dupStaff] = await db.query('SELECT staff_id FROM staff WHERE email = ?', [email]);
      const [dupUser] = await db.query('SELECT user_id FROM users WHERE email = ?', [email]);
      if (dupStaff.length || dupUser.length) {
        return res.status(409).json({ error: 'A user or staff member with this email already exists' });
      }

      const hash = await bcrypt.hash(password, 10);
      const [r] = await db.query(
        `INSERT INTO staff (name, email, phone, role, shelter_id, can_login, password_hash)
         VALUES (?, ?, ?, 'Admin', ?, 1, ?)`,
        [name, email, phone || null, shelter_id, hash]
      );
      return res.status(201).json({ staff_id: r.insertId, ok: true });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A staff member with this email already exists' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  // Case 2: Shelter Admin adding Vet or Caretaker
  if (user.role === 'Admin') {
    const c = check(req.body);
    if (c.error) return res.status(400).json({ error: c.error });

    try {
      const [dup] = await db.query('SELECT staff_id FROM staff WHERE email = ?', [c.email]);
      if (dup.length) return res.status(409).json({ error: 'A staff member with this email already exists' });

      const [r] = await db.query(
        `INSERT INTO staff (name, email, phone, role, shelter_id, can_login, password_hash)
         VALUES (?,?,?,?,?,0,NULL)`,
        [c.name, c.email, c.phone || null, c.role, user.shelter_id]);
      return res.status(201).json({ staff_id: r.insertId, ok: true });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'A staff member with this email already exists' });
      }
      console.error(err);
      return res.status(500).json({ error: 'Server error' });
    }
  }

  return res.status(403).json({ error: 'Not allowed' });
});

// ---------- EDIT ----------
// PUT /api/admin/staff/:id   (send all fields)
// Only Vet and Caretaker rows of the admin's own shelter can be edited.
router.put('/staff/:id', ...editors, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(404).json({ error: 'Staff member not found' });

  const c = check(req.body);
  if (c.error) return res.status(400).json({ error: c.error });

  try {
    const [rows] = await db.query(
      "SELECT staff_id FROM staff WHERE staff_id = ? AND shelter_id = ? AND role IN ('Vet','Caretaker')",
      [id, req.session.user.shelter_id]);
    if (!rows.length) return res.status(404).json({ error: 'Staff member not found' });

    // the email must not belong to someone else
    const [dup] = await db.query('SELECT staff_id FROM staff WHERE email = ? AND staff_id <> ?', [c.email, id]);
    if (dup.length) return res.status(409).json({ error: 'A staff member with this email already exists' });

    await db.query(
      'UPDATE staff SET name = ?, email = ?, phone = ?, role = ? WHERE staff_id = ?',
      [c.name, c.email, c.phone || null, c.role, id]);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A staff member with this email already exists' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// No DELETE route on purpose: old medical records point to the staff member who examined.

module.exports = router;