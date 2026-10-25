const express = require('express');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// Both Shelter Admin and Global Admin (Main Admin) can view donations
const viewers = [needLogin, onlyRole('Admin', 'Global Admin')];

function shelterOf(req) {
  const u = req.session.user;
  if (u.role === 'Admin') return u.shelter_id;
  const sid = req.query.shelter_id;
  return sid ? Number(sid) : null;
}

// ---------- LIST DONATIONS & DONORS ----------
// GET /api/admin/donations
// Shelter Admin: views donations to their own shelter only.
// Global Admin: views donations across all shelters, or filtered by ?shelter_id.
router.get('/donations', ...viewers, async (req, res) => {
  try {
    const sid = shelterOf(req);
    const search = (req.query.search || '').trim();

    const where = [];
    const vals = [];

    if (sid) {
      where.push('d.shelter_id = ?');
      vals.push(sid);
    }

    if (search) {
      where.push('(dn.name LIKE ? OR dn.email LIKE ? OR dn.phone LIKE ?)');
      vals.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const sql = `
      SELECT d.donation_id, d.amount, d.donated_on, d.shelter_id, s.name AS shelter_name,
             dn.donor_id, dn.name AS donor_name, dn.email AS donor_email,
             dn.phone AS donor_phone, dn.address AS donor_address
      FROM donation d
      JOIN donor dn ON dn.donor_id = d.donor_id
      JOIN shelter s ON s.shelter_id = d.shelter_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY d.donated_on DESC, d.donation_id DESC
    `;

    const [rows] = await db.query(sql, vals);

    // Summary calculations
    const totalAmount = rows.reduce((sum, r) => sum + Number(r.amount), 0);
    const uniqueDonors = new Set(rows.map((r) => r.donor_id)).size;

    res.json({
      donations: rows,
      total_amount: totalAmount,
      total_donations: rows.length,
      unique_donors: uniqueDonors
    });
  } catch (err) {
    console.error('Error fetching admin donations:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
