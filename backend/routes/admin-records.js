const express = require('express');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// Only shelter admins can add or edit records (the Global Admin can only view them).
// The check is put on each route, not with router.use, so it can never block
// other /api/admin routes that live in other files.
const only = [needLogin, onlyRole('Admin')];

// A real calendar date like 2026-10-25 (2026-02-31 is rejected)
function isDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const x = new Date(d + 'T00:00:00Z');
  return !isNaN(x) && x.toISOString().slice(0, 10) === d;
}

// The animal, only if it belongs to this admin's shelter
async function myAnimal(req, id) {
  const [rows] = await db.query(
    'SELECT animal_id FROM animal WHERE animal_id = ? AND shelter_id = ?',
    [id, req.session.user.shelter_id]);
  return rows[0] || null;
}

// Returns an error message, or null if the medical fields are fine
async function checkMedical(b, sid) {
  if (!isDate(b.visit_date)) return 'Visit date is required (like 2026-10-25)';
  if (!b.diagnosis || b.diagnosis.length > 255) return 'Diagnosis is required (max 255 characters)';
  if (b.treatment && b.treatment.length > 255) return 'Treatment is too long (max 255 characters)';
  if (b.staff_id) {
    // "examined by" must be staff of this same shelter
    const [st] = await db.query('SELECT staff_id FROM staff WHERE staff_id = ? AND shelter_id = ?', [b.staff_id, sid]);
    if (!st.length) return 'Examiner must be staff of this shelter';
  }
  return null;
}

// Returns an error message, or null if the vaccination fields are fine
function checkVaccine(b) {
  if (!b.vaccine_name || b.vaccine_name.length > 100) return 'Vaccine name is required (max 100 characters)';
  if (!isDate(b.date_given)) return 'Date given is required (like 2026-10-25)';
  if (b.next_due_date) {
    if (!isDate(b.next_due_date)) return 'Next due date is not a valid date';
    if (b.next_due_date < b.date_given) return 'Next due date cannot be before the date given';
  }
  return null;
}

// ---------- MEDICAL RECORDS ----------

// POST /api/admin/animals/:id/medical
router.post('/animals/:id/medical', ...only, async (req, res) => {
  try {
    const a = await myAnimal(req, Number(req.params.id));
    if (!a) return res.status(404).json({ error: 'Animal not found' });

    const b = req.body;
    const msg = await checkMedical(b, req.session.user.shelter_id);
    if (msg) return res.status(400).json({ error: msg });

    const [r] = await db.query(
      'INSERT INTO medical_record (animal_id, staff_id, visit_date, diagnosis, treatment) VALUES (?,?,?,?,?)',
      [a.animal_id, b.staff_id || null, b.visit_date, b.diagnosis, b.treatment || null]);
    res.status(201).json({ record_id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/medical/:rid   (send all fields)
router.put('/medical/:rid', ...only, async (req, res) => {
  try {
    // the record must belong to an animal of this admin's shelter
    const [rows] = await db.query(
      `SELECT m.record_id FROM medical_record m JOIN animal a ON a.animal_id = m.animal_id
       WHERE m.record_id = ? AND a.shelter_id = ?`,
      [Number(req.params.rid), req.session.user.shelter_id]);
    if (!rows.length) return res.status(404).json({ error: 'Record not found' });

    const b = req.body;
    const msg = await checkMedical(b, req.session.user.shelter_id);
    if (msg) return res.status(400).json({ error: msg });

    await db.query(
      'UPDATE medical_record SET staff_id = ?, visit_date = ?, diagnosis = ?, treatment = ? WHERE record_id = ?',
      [b.staff_id || null, b.visit_date, b.diagnosis, b.treatment || null, rows[0].record_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- VACCINATIONS ----------

// POST /api/admin/animals/:id/vaccines
router.post('/animals/:id/vaccines', ...only, async (req, res) => {
  try {
    const a = await myAnimal(req, Number(req.params.id));
    if (!a) return res.status(404).json({ error: 'Animal not found' });

    const b = req.body;
    const msg = checkVaccine(b);
    if (msg) return res.status(400).json({ error: msg });

    const [r] = await db.query(
      'INSERT INTO vaccination (animal_id, vaccine_name, date_given, next_due_date) VALUES (?,?,?,?)',
      [a.animal_id, b.vaccine_name, b.date_given, b.next_due_date || null]);
    res.status(201).json({ vaccination_id: r.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/vaccines/:vid   (send all fields)
router.put('/vaccines/:vid', ...only, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT v.vaccination_id FROM vaccination v JOIN animal a ON a.animal_id = v.animal_id
       WHERE v.vaccination_id = ? AND a.shelter_id = ?`,
      [Number(req.params.vid), req.session.user.shelter_id]);
    if (!rows.length) return res.status(404).json({ error: 'Vaccination not found' });

    const b = req.body;
    const msg = checkVaccine(b);
    if (msg) return res.status(400).json({ error: msg });

    await db.query(
      'UPDATE vaccination SET vaccine_name = ?, date_given = ?, next_due_date = ? WHERE vaccination_id = ?',
      [b.vaccine_name, b.date_given, b.next_due_date || null, rows[0].vaccination_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// No DELETE routes on purpose: records can be corrected, but the history is kept.

module.exports = router;