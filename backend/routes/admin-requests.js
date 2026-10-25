const express = require('express');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// The check is put on each route (not with router.use), so it can never block
// other /api/admin routes that live in other files.
const viewers = [needLogin, onlyRole('Admin', 'Global Admin')]; // can look at requests
const only = [needLogin, onlyRole('Admin')];                    // can approve / reject / end

// The two kinds of request. Table and column names come from this list only,
// never from the browser, so they are safe to put into the SQL text.
const KINDS = {
  adoption: {
    table: 'adoption',
    id: 'adoption_id',
    animalStatus: 'Adopted',
    approveSet: "status = 'Approved', adopted_date = CURDATE()"
  },
  foster: {
    table: 'foster_assignment',
    id: 'foster_record_id',
    animalStatus: 'Fostered',
    approveSet: "status = 'Approved', start_date = IFNULL(start_date, CURDATE())"
  }
};

// ---------- LIST ----------
// GET /api/admin/requests?type=adoption|foster&status=Pending&shelter_id=2
// Shelter admin: own shelter only. Global Admin: all shelters, or one with shelter_id.
router.get('/requests', ...viewers, async (req, res) => {
  try {
    const u = req.session.user;
    const sid = u.role === 'Admin' ? u.shelter_id : Number(req.query.shelter_id) || null;

    const out = [];
    for (const type of ['adoption', 'foster']) {
      if (req.query.type && req.query.type !== type) continue;
      const k = KINDS[type];

      const where = [];
      const vals = [];
      if (sid) { where.push('a.shelter_id = ?'); vals.push(sid); }
      if (req.query.status) { where.push('r.status = ?'); vals.push(req.query.status); }

      // adoption has adopted_date; foster has start_date and end_date
      const dates = type === 'adoption'
        ? 'r.adopted_date, NULL AS start_date, NULL AS end_date'
        : 'NULL AS adopted_date, r.start_date, r.end_date';

      const [rows] = await db.query(
        `SELECT r.${k.id} AS id, r.status, r.request_date, ${dates}, r.notes,
                a.animal_id, a.name AS animal, a.status AS animal_status,
                a.shelter_id, s.name AS shelter,
                u.user_id, u.name AS applicant, u.email, u.phone, u.address
         FROM ${k.table} r
         JOIN animal a  ON a.animal_id  = r.animal_id
         JOIN shelter s ON s.shelter_id = a.shelter_id
         JOIN users u   ON u.user_id    = r.user_id
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
        vals);
      rows.forEach((r) => out.push({ type, ...r }));
    }

    // newest first
    out.sort((x, y) => String(y.request_date).localeCompare(String(x.request_date)) || y.id - x.id);
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- APPROVE ----------
// POST /api/admin/requests/adoption/:id/approve   (or /foster/:id/approve)
// In ONE transaction: approve the request, change the animal's status, and reject the
// other Pending requests for the same animal. If anything fails, nothing is saved.
router.post('/requests/:type/:id/approve', ...only, async (req, res) => {
  const k = KINDS[req.params.type];
  if (!k) return res.status(404).json({ error: 'Unknown request type' });
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(404).json({ error: 'Request not found' });

  const conn = await db.getConnection();
  try {
    // 1. find the request's animal, and check it is in this admin's shelter
    const [x] = await conn.query(
      `SELECT r.animal_id FROM ${k.table} r JOIN animal a ON a.animal_id = r.animal_id
       WHERE r.${k.id} = ? AND a.shelter_id = ?`,
      [rid, req.session.user.shelter_id]);
    if (!x.length) return res.status(404).json({ error: 'Request not found' });
    const animalId = x[0].animal_id;

    await conn.beginTransaction();

    // 2. lock the animal first, then the request, so two admins clicking at the same
    //    time cannot both approve for the same animal
    const [an] = await conn.query('SELECT status FROM animal WHERE animal_id = ? FOR UPDATE', [animalId]);
    const [rq] = await conn.query(`SELECT status FROM ${k.table} WHERE ${k.id} = ? FOR UPDATE`, [rid]);

    if (rq[0].status !== 'Pending') {
      await conn.rollback();
      return res.status(400).json({ error: 'This request is already ' + rq[0].status });
    }
    if (an[0].status !== 'Available') {
      await conn.rollback();
      return res.status(400).json({ error: 'This animal is not available (status: ' + an[0].status + ')' });
    }

    // 3. approve it, update the animal
    await conn.query(`UPDATE ${k.table} SET ${k.approveSet} WHERE ${k.id} = ?`, [rid]);
    await conn.query('UPDATE animal SET status = ? WHERE animal_id = ?', [k.animalStatus, animalId]);

    // 4. reject every other Pending request for this animal, adoption and foster
    const [r1] = await conn.query("UPDATE adoption SET status = 'Rejected' WHERE animal_id = ? AND status = 'Pending'", [animalId]);
    const [r2] = await conn.query("UPDATE foster_assignment SET status = 'Rejected' WHERE animal_id = ? AND status = 'Pending'", [animalId]);

    await conn.commit();
    res.json({ ok: true, auto_rejected: r1.affectedRows + r2.affectedRows });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// ---------- REJECT ----------
// POST /api/admin/requests/adoption/:id/reject   (or /foster/:id/reject)
// Only a Pending request can be rejected. The animal stays as it is.
router.post('/requests/:type/:id/reject', ...only, async (req, res) => {
  const k = KINDS[req.params.type];
  if (!k) return res.status(404).json({ error: 'Unknown request type' });
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(404).json({ error: 'Request not found' });

  try {
    const [x] = await db.query(
      `SELECT r.status FROM ${k.table} r JOIN animal a ON a.animal_id = r.animal_id
       WHERE r.${k.id} = ? AND a.shelter_id = ?`,
      [rid, req.session.user.shelter_id]);
    if (!x.length) return res.status(404).json({ error: 'Request not found' });

    // "AND status = 'Pending'" makes this safe even if someone else just decided it
    const [r] = await db.query(
      `UPDATE ${k.table} SET status = 'Rejected' WHERE ${k.id} = ? AND status = 'Pending'`, [rid]);
    if (r.affectedRows === 0) {
      return res.status(400).json({ error: 'Only a Pending request can be rejected' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ---------- END A FOSTER ----------
// POST /api/admin/requests/foster/:id/end
// Marks the foster as Ended, saves today as the end date, and the animal is Available again.
router.post('/requests/foster/:id/end', ...only, async (req, res) => {
  const rid = Number(req.params.id);
  if (!Number.isInteger(rid)) return res.status(404).json({ error: 'Request not found' });
  const conn = await db.getConnection();
  try {
    const [x] = await conn.query(
      `SELECT r.animal_id FROM foster_assignment r JOIN animal a ON a.animal_id = r.animal_id
       WHERE r.foster_record_id = ? AND a.shelter_id = ?`,
      [rid, req.session.user.shelter_id]);
    if (!x.length) return res.status(404).json({ error: 'Request not found' });
    const animalId = x[0].animal_id;

    await conn.beginTransaction();
    await conn.query('SELECT status FROM animal WHERE animal_id = ? FOR UPDATE', [animalId]);
    const [rq] = await conn.query('SELECT status FROM foster_assignment WHERE foster_record_id = ? FOR UPDATE', [rid]);

    if (rq[0].status !== 'Approved') {
      await conn.rollback();
      return res.status(400).json({ error: 'Only an approved foster can be ended (this one is ' + rq[0].status + ')' });
    }

    await conn.query("UPDATE foster_assignment SET status = 'Ended', end_date = CURDATE() WHERE foster_record_id = ?", [rid]);
    await conn.query("UPDATE animal SET status = 'Available' WHERE animal_id = ? AND status = 'Fostered'", [animalId]);

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;