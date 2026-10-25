const express = require('express');
const db = require('../db');

const router = express.Router();

// -------------------------------------------------------------
// 1. GET /api/shelters
// Helper endpoint to populate the shelter dropdown for donations
// -------------------------------------------------------------
router.get('/shelters', async (req, res) => {
    try {
        const [shelters] = await db.query(
            'SELECT shelter_id, name, city FROM shelter ORDER BY name'
        );
        res.json(shelters);
    } catch (err) {
        console.error('Error fetching shelters:', err);
        res.status(500).json({ error: 'Failed to load shelters' });
    }
});

// -------------------------------------------------------------
// 2. POST /api/donate
// Public route (needs no login).
// - Reuses donor by email if they already exist, or inserts a new donor.
// - Saves the donation with amount > 0 and a chosen shelter.
// -------------------------------------------------------------
router.post('/donate', async (req, res) => {
    try {
        const { name, phone, address, amount, shelter_id } = req.body;
        const email = (req.body.email || '').trim().toLowerCase();

        // 1. Validation checks
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Name is required' });
        }
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'A valid email address is required' });
        }
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            return res.status(400).json({ error: 'Donation amount must be greater than 0' });
        }
        if (!shelter_id) {
            return res.status(400).json({ error: 'Please choose a shelter to support' });
        }

        // Verify the shelter exists
        const [shelterCheck] = await db.query(
            'SELECT shelter_id, name FROM shelter WHERE shelter_id = ?',
            [shelter_id]
        );
        if (shelterCheck.length === 0) {
            return res.status(400).json({ error: 'Selected shelter does not exist' });
        }

        // 2. Reuse donor by email or create a new donor row
        let donorId;
        const [existing] = await db.query(
            'SELECT donor_id FROM donor WHERE email = ?',
            [email]
        );

        if (existing.length > 0) {
            // Reuse existing donor (and update contact info if provided)
            donorId = existing[0].donor_id;
            await db.query(
                `UPDATE donor 
         SET name = ?, phone = COALESCE(?, phone), address = COALESCE(?, address) 
         WHERE donor_id = ?`,
                [name.trim(), phone ? phone.trim() : null, address ? address.trim() : null, donorId]
            );
        } else {
            // Create new donor
            const [insertDonor] = await db.query(
                'INSERT INTO donor (name, email, phone, address) VALUES (?, ?, ?, ?)',
                [name.trim(), email, phone ? phone.trim() : null, address ? address.trim() : null]
            );
            donorId = insertDonor.insertId;
        }

        // 3. Save the donation with today's date
        const [donationResult] = await db.query(
            'INSERT INTO donation (donor_id, shelter_id, amount, donated_on) VALUES (?, ?, ?, CURDATE())',
            [donorId, shelter_id, numAmount]
        );

        res.json({
            ok: true,
            donation_id: donationResult.insertId,
            shelter_name: shelterCheck[0].name,
            amount: numAmount
        });
    } catch (err) {
        console.error('Error processing donation:', err);
        res.status(500).json({ error: 'Failed to process donation. Please try again.' });
    }
});

module.exports = router;
