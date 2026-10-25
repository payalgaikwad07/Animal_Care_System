const express = require('express');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// Only Global Admin can access shelter management
const onlyGlobal = [needLogin, onlyRole('Global Admin')];

// ---------- LIST SHELTERS ----------
// GET /api/admin/shelters
// Returns all shelters with animal counts and assigned admin details
router.get('/shelters', ...onlyGlobal, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT s.shelter_id, s.name, s.address, s.city, s.phone, s.email, s.capacity,
             COUNT(DISTINCT a.animal_id) AS animal_count,
             (SELECT name FROM staff WHERE shelter_id = s.shelter_id AND role = 'Admin' AND can_login = 1 LIMIT 1) AS admin_name,
             (SELECT email FROM staff WHERE shelter_id = s.shelter_id AND role = 'Admin' AND can_login = 1 LIMIT 1) AS admin_email
      FROM shelter s
      LEFT JOIN animal a ON a.shelter_id = s.shelter_id
      GROUP BY s.shelter_id
      ORDER BY s.name
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- ADD SHELTER ----------
// POST /api/admin/shelters
// body: { name, address, city, phone, email, capacity }
router.post('/shelters', ...onlyGlobal, async (req, res) => {
  const name = (req.body.name || '').trim();
  const address = (req.body.address || '').trim();
  const city = (req.body.city || '').trim();
  const phone = (req.body.phone || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const capacity = Number(req.body.capacity) || 50;

  if (!name || name.length > 100) return res.status(400).json({ error: 'Shelter name is required (max 100 characters)' });
  if (!address || address.length > 255) return res.status(400).json({ error: 'Address is required (max 255 characters)' });
  if (!city || city.length > 50) return res.status(400).json({ error: 'City is required (max 50 characters)' });
  if (!phone || phone.length > 15) return res.status(400).json({ error: 'Valid phone number is required (max 15 characters)' });
  if (email && email.length > 100) return res.status(400).json({ error: 'Email is too long (max 100 characters)' });
  if (capacity <= 0 || !Number.isInteger(capacity)) return res.status(400).json({ error: 'Capacity must be a positive number' });

  try {
    const [dup] = await db.query('SELECT shelter_id FROM shelter WHERE name = ? AND city = ?', [name, city]);
    if (dup.length) return res.status(409).json({ error: 'A shelter with this name already exists in ' + city });

    const [r] = await db.query(
      'INSERT INTO shelter (name, address, city, phone, email, capacity) VALUES (?, ?, ?, ?, ?, ?)',
      [name, address, city, phone, email || null, capacity]
    );

    res.status(201).json({ shelter_id: r.insertId, ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
