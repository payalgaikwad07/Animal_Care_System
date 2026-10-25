const express = require('express');
const db = require('../db');
const { needLogin, onlyRole } = require('../middleware/auth');

const router = express.Router();

// The check is put on each route (not with router.use), so it can never block
// other /api routes that live in other files.
const onlyUser = [needLogin, onlyRole('user')];

// -------------------------------------------------------------
// 1. GET /api/user/profile
// Fetches the logged-in user's details to pre-fill Adopt and Foster forms
// -------------------------------------------------------------
router.get('/user/profile', ...onlyUser, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const [rows] = await db.query(
            'SELECT user_id, name, email, phone, address FROM users WHERE user_id = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        res.json(rows[0]);
    } catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).json({ error: 'Failed to load profile' });
    }
});

// Helper: If the user updated their name, phone, or address in the form, update their users table row
async function syncUserDetails(userId, req, { name, phone, address }) {
    if (name || phone || address) {
        await db.query(
            `UPDATE users 
       SET name = COALESCE(?, name), 
           phone = COALESCE(?, phone), 
           address = COALESCE(?, address) 
       WHERE user_id = ?`,
            [name ? name.trim() : null, phone ? phone.trim() : null, address ? address.trim() : null, userId]
        );

        if (name) {
            req.session.user.name = name.trim();
        }
    }
}

// -------------------------------------------------------------
// 2. POST /api/adopt
// Submits an adoption request.
// Rules:
// - User ID taken from session (never from browser).
// - Animal must be 'Available'.
// - User cannot submit a second active request for the same animal.
// - Saves as 'Pending' with today's date.
// -------------------------------------------------------------
router.post('/adopt', ...onlyUser, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { animal_id, name, phone, address, notes } = req.body;

        if (!animal_id) {
            return res.status(400).json({ error: 'Animal ID is required' });
        }

        // 1. Verify the animal exists and is Available
        const [animals] = await db.query(
            'SELECT animal_id, name, status FROM animal WHERE animal_id = ?',
            [animal_id]
        );

        if (animals.length === 0) {
            return res.status(404).json({ error: 'Animal not found' });
        }

        if (animals[0].status !== 'Available') {
            return res.status(400).json({
                error: `Cannot adopt ${animals[0].name}. Status is currently '${animals[0].status}'.`
            });
        }

        // 2. Ensure user does not already have an active (Pending/Approved) request for this animal
        const [existing] = await db.query(
            `SELECT adoption_id FROM adoption 
       WHERE animal_id = ? AND user_id = ? AND status IN ('Pending', 'Approved')`,
            [animal_id, userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'You already have an active adoption request for this animal.'
            });
        }

        // 3. Update user contact info in the users table if modified
        await syncUserDetails(userId, req, { name, phone, address });

        // 4. Insert adoption request as 'Pending' with today's date (CURDATE())
        const [result] = await db.query(
            `INSERT INTO adoption (animal_id, user_id, request_date, status, notes) 
       VALUES (?, ?, CURDATE(), 'Pending', ?)`,
            [animal_id, userId, notes ? notes.trim() : null]
        );

        res.json({
            ok: true,
            adoption_id: result.insertId,
            message: 'Adoption request submitted successfully!'
        });
    } catch (err) {
        console.error('Error submitting adoption request:', err);
        res.status(500).json({ error: 'Failed to submit adoption request' });
    }
});

// -------------------------------------------------------------
// 3. POST /api/foster
// Submits a foster request.
// Rules:
// - Takes expected start and end dates.
// - Animal must be 'Available'.
// - Cannot submit a second active foster request for the same animal.
// - Saves as 'Pending' with today's date.
// -------------------------------------------------------------
router.post('/foster', ...onlyUser, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { animal_id, name, phone, address, start_date, end_date, notes } = req.body;

        if (!animal_id) {
            return res.status(400).json({ error: 'Animal ID is required' });
        }
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'Expected start date and end date are required for fostering' });
        }
        if (new Date(end_date) < new Date(start_date)) {
            return res.status(400).json({ error: 'End date cannot be earlier than start date' });
        }

        // 1. Verify the animal exists and is Available
        const [animals] = await db.query(
            'SELECT animal_id, name, status FROM animal WHERE animal_id = ?',
            [animal_id]
        );

        if (animals.length === 0) {
            return res.status(404).json({ error: 'Animal not found' });
        }

        if (animals[0].status !== 'Available') {
            return res.status(400).json({
                error: `Cannot foster ${animals[0].name}. Status is currently '${animals[0].status}'.`
            });
        }

        // 2. Ensure user does not already have an active foster request for this animal
        const [existing] = await db.query(
            `SELECT foster_record_id FROM foster_assignment 
       WHERE animal_id = ? AND user_id = ? AND status IN ('Pending', 'Approved')`,
            [animal_id, userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'You already have an active foster request for this animal.'
            });
        }

        // 3. Update user contact info in the users table if modified
        await syncUserDetails(userId, req, { name, phone, address });

        // 4. Insert foster request as 'Pending' with today's date
        const [result] = await db.query(
            `INSERT INTO foster_assignment (animal_id, user_id, request_date, start_date, end_date, status, notes) 
       VALUES (?, ?, CURDATE(), ?, ?, 'Pending', ?)`,
            [animal_id, userId, start_date, end_date, notes ? notes.trim() : null]
        );

        res.json({
            ok: true,
            foster_record_id: result.insertId,
            message: 'Foster request submitted successfully!'
        });
    } catch (err) {
        console.error('Error submitting foster request:', err);
        res.status(500).json({ error: 'Failed to submit foster request' });
    }
});

// -------------------------------------------------------------
// 4. GET /api/my-requests
// Returns all adoption and foster requests submitted by the current user
// -------------------------------------------------------------
router.get('/my-requests', ...onlyUser, async (req, res) => {
    try {
        const userId = req.session.user.id;

        // Adoption requests
        const [adoptions] = await db.query(
            `SELECT a.adoption_id AS id, 'Adoption' AS request_type, a.status, a.request_date,
              a.adopted_date, NULL AS start_date, NULL AS end_date, a.notes,
              an.animal_id, an.name AS animal_name, an.species, an.breed, an.image_url,
              s.name AS shelter_name, s.city AS shelter_city
       FROM adoption a
       JOIN animal an ON an.animal_id = a.animal_id
       JOIN shelter s  ON s.shelter_id = an.shelter_id
       WHERE a.user_id = ?`,
            [userId]
        );

        // Foster requests
        const [fosters] = await db.query(
            `SELECT f.foster_record_id AS id, 'Foster' AS request_type, f.status, f.request_date,
              NULL AS adopted_date, f.start_date, f.end_date, f.notes,
              an.animal_id, an.name AS animal_name, an.species, an.breed, an.image_url,
              s.name AS shelter_name, s.city AS shelter_city
       FROM foster_assignment f
       JOIN animal an ON an.animal_id = f.animal_id
       JOIN shelter s  ON s.shelter_id = an.shelter_id
       WHERE f.user_id = ?`,
            [userId]
        );

        // Combine and sort newest request_date first
        const all = [...adoptions, ...fosters];
        all.sort((x, y) => String(y.request_date).localeCompare(String(x.request_date)) || y.id - x.id);

        res.json(all);
    } catch (err) {
        console.error('Error fetching my-requests:', err);
        res.status(500).json({ error: 'Failed to load your requests' });
    }
});

module.exports = router;
