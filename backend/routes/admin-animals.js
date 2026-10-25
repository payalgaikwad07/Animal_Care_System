const express = require('express');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// Every route in this file is for shelter admins and the Global Admin only.
router.use(needLogin, onlyRole('Admin', 'Global Admin'));

// Which shelter's data can this person see?
// Shelter admin: always their own shelter (taken from the session, never from the browser).
// Global Admin: any shelter, or all of them when no shelter_id is sent.
function shelterOf(req) {
  const u = req.session.user;
  if (u.role === 'Admin') return u.shelter_id;
  // req.body is empty on GET requests, so check it exists first
  const sid = req.query.shelter_id || (req.body && req.body.shelter_id);
  return sid ? Number(sid) : null;
}

// Get one animal, or null if it does not exist or belongs to another shelter.
async function findAnimal(req, id) {
  const [rows] = await db.query('SELECT * FROM animal WHERE animal_id = ?', [id]);
  if (!rows.length) return null;
  const u = req.session.user;
  if (u.role === 'Admin' && rows[0].shelter_id !== u.shelter_id) return null;
  return rows[0];
}

const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d || '');

// Check the animal form fields. Returns an error message, or null if all is fine.
function checkAnimal(b) {
  if (!b.name || b.name.length > 50) return 'Name is required (max 50 characters)';
  if (!b.species || b.species.length > 30) return 'Species is required (max 30 characters)';
  if (b.breed && b.breed.length > 50) return 'Breed is too long (max 50 characters)';
  if (!Number.isInteger(Number(b.age_months)) || Number(b.age_months) < 0) return 'Age (in months) must be 0 or more';
  if (!['Male', 'Female'].includes(b.gender)) return 'Gender must be Male or Female';
  if (b.image_url && b.image_url.length > 255) return 'Image link is too long';
  return null;
}

// Admins may only set these two statuses by hand.
// Adopted and Fostered are set by approving a request (a later feature).
const MANUAL_STATUS = ['Available', 'Under Treatment'];

// ---------- DROPDOWN DATA ----------
// GET /api/admin/options  ->  species list, shelters, vets/staff of the shelter
router.get('/options', async (req, res) => {
  try {
    const sid = shelterOf(req);
    const [species] = await db.query('SELECT DISTINCT species FROM animal ORDER BY species');
    const [shelters] = sid
      ? await db.query('SELECT shelter_id, name, city FROM shelter WHERE shelter_id = ?', [sid])
      : await db.query('SELECT shelter_id, name, city FROM shelter ORDER BY name');
    const [staff] = sid
      ? await db.query("SELECT staff_id, name, role FROM staff WHERE shelter_id = ? AND role IN ('Vet','Caretaker','Admin')", [sid])
      : [[]];
    res.json({ species: species.map((s) => s.species), shelters, staff });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- LIST ----------
// GET /api/admin/animals?status=&species=&name=&due=1&shelter_id=
router.get('/animals', async (req, res) => {
  try {
    const where = [];
    const vals = [];

    const sid = shelterOf(req);
    if (sid) { where.push('a.shelter_id = ?'); vals.push(sid); }
    if (req.query.status) { where.push('a.status = ?'); vals.push(req.query.status); }
    if (req.query.species) { where.push('a.species = ?'); vals.push(req.query.species); }
    if (req.query.name) { where.push('a.name LIKE ?'); vals.push('%' + req.query.name + '%'); }
    if (req.query.due === '1') {
      // vaccination due in the next 30 days
      where.push(`EXISTS (SELECT 1 FROM vaccination v WHERE v.animal_id = a.animal_id
                  AND v.next_due_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY))`);
    }

    const sql = `SELECT a.animal_id, a.name, a.species, a.breed, a.age_months, a.gender,
                        a.status, a.intake_date, a.shelter_id, s.name AS shelter
                 FROM animal a JOIN shelter s ON s.shelter_id = a.shelter_id
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY a.animal_id DESC`;
    const [rows] = await db.query(sql, vals);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- GET ONE ----------
// GET /api/admin/animals/:id  ->  animal + medical records + vaccinations (newest first)
router.get('/animals/:id', async (req, res) => {
  try {
    const a = await findAnimal(req, Number(req.params.id));
    if (!a) return res.status(404).json({ error: 'Animal not found' });

    const [shelter] = await db.query('SELECT name FROM shelter WHERE shelter_id = ?', [a.shelter_id]);
    const [medical] = await db.query(
      `SELECT m.record_id, m.visit_date, m.diagnosis, m.treatment, st.name AS examined_by
       FROM medical_record m LEFT JOIN staff st ON st.staff_id = m.staff_id
       WHERE m.animal_id = ? ORDER BY m.visit_date DESC, m.record_id DESC`, [a.animal_id]);
    const [vaccines] = await db.query(
      'SELECT vaccination_id, vaccine_name, date_given, next_due_date FROM vaccination WHERE animal_id = ? ORDER BY date_given DESC, vaccination_id DESC',
      [a.animal_id]);

    res.json({ ...a, shelter: shelter[0].name, medical, vaccines });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- ADD (intake) ----------
// POST /api/admin/animals
// body: animal fields, plus optional  medical: {visit_date, diagnosis, treatment, staff_id}
// and  vaccines: [{vaccine_name, date_given, next_due_date}]
router.post('/animals', async (req, res) => {

  // Global Admin cannot intake animals directly
  if (req.session.user.role === 'Global Admin') {
    return res.status(403).json({ error: 'Only shelter admins can intake animals.' });
  }

  const b = req.body;
  const msg = checkAnimal(b);
  if (msg) return res.status(400).json({ error: msg });

  const sid = shelterOf(req);
  if (!sid) return res.status(400).json({ error: 'Please choose a shelter' });

  const status = b.status || 'Available';
  if (!MANUAL_STATUS.includes(status)) {
    return res.status(400).json({ error: 'A new animal must be Available or Under Treatment' });
  }
  const intake = b.intake_date || new Date().toISOString().slice(0, 10);
  if (!isDate(intake)) return res.status(400).json({ error: 'Intake date must look like 2026-10-25' });

  // optional first medical record
  const med = b.medical && b.medical.diagnosis ? b.medical : null;
  if (med) {
    if (!isDate(med.visit_date)) return res.status(400).json({ error: 'Medical visit date is required' });
    if (med.diagnosis.length > 255 || (med.treatment || '').length > 255) {
      return res.status(400).json({ error: 'Diagnosis or treatment is too long' });
    }
  }

  // optional vaccinations
  const vacs = (b.vaccines || []).filter((v) => v.vaccine_name);
  for (const v of vacs) {
    if (v.vaccine_name.length > 100) return res.status(400).json({ error: 'Vaccine name is too long' });
    if (!isDate(v.date_given)) return res.status(400).json({ error: 'Vaccination date given is required' });
    if (v.next_due_date && !isDate(v.next_due_date)) return res.status(400).json({ error: 'Next due date is not valid' });
  }

  const conn = await db.getConnection();
  try {
    // the shelter must exist
    const [sh] = await conn.query('SELECT shelter_id FROM shelter WHERE shelter_id = ?', [sid]);
    if (!sh.length) return res.status(400).json({ error: 'Shelter not found' });

    // "examined by" must be staff of this same shelter
    let staffId = null;
    if (med && med.staff_id) {
      const [st] = await conn.query('SELECT staff_id FROM staff WHERE staff_id = ? AND shelter_id = ?', [med.staff_id, sid]);
      if (!st.length) return res.status(400).json({ error: 'Examiner must be staff of this shelter' });
      staffId = st[0].staff_id;
    }

    // all three inserts succeed together, or none are saved
    await conn.beginTransaction();
    const [r] = await conn.query(
      `INSERT INTO animal (name, species, breed, age_months, gender, intake_date, status, image_url, notes, shelter_id)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [b.name, b.species, b.breed || null, Number(b.age_months), b.gender, intake, status,
      b.image_url || null, b.notes || null, sid]);
    const id = r.insertId;

    if (med) {
      await conn.query(
        'INSERT INTO medical_record (animal_id, staff_id, visit_date, diagnosis, treatment) VALUES (?,?,?,?,?)',
        [id, staffId, med.visit_date, med.diagnosis, med.treatment || null]);
    }
    for (const v of vacs) {
      await conn.query(
        'INSERT INTO vaccination (animal_id, vaccine_name, date_given, next_due_date) VALUES (?,?,?,?)',
        [id, v.vaccine_name, v.date_given, v.next_due_date || null]);
    }
    await conn.commit();
    res.status(201).json({ animal_id: id });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ---------- UPDATE ----------
// PUT /api/admin/animals/:id   (send all animal fields; the shelter cannot be changed)
router.put('/animals/:id', async (req, res) => {
  const b = req.body;
  const msg = checkAnimal(b);
  if (msg) return res.status(400).json({ error: msg });

  try {
    const a = await findAnimal(req, Number(req.params.id));
    if (!a) return res.status(404).json({ error: 'Animal not found' });

    // Adopted and Fostered animals are changed from the requests screen, not here.
    let status = a.status;
    if (b.status && b.status !== a.status) {
      if (a.status === 'Adopted' || a.status === 'Fostered') {
        return res.status(400).json({ error: 'This animal is ' + a.status + '. Change it from the requests screen.' });
      }
      if (!MANUAL_STATUS.includes(b.status)) {
        return res.status(400).json({ error: 'Status can only be set to Available or Under Treatment here' });
      }
      status = b.status;
    }

    await db.query(
      `UPDATE animal SET name = ?, species = ?, breed = ?, age_months = ?, gender = ?,
              status = ?, image_url = ?, notes = ? WHERE animal_id = ?`,
      [b.name, b.species, b.breed || null, Number(b.age_months), b.gender,
        status, b.image_url || null, b.notes || null, a.animal_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// There is no DELETE route on purpose: animals are never removed from the system.

module.exports = router;