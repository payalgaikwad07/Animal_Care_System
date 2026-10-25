const express = require('express');
const db = require('../db');

const router = express.Router();

// -------------------------------------------------------------
// 1. GET /api/filters
// Supplies dropdown data: species, breeds, and shelters.
// If ?species=Dog is passed, returns only breeds for dogs.
// -------------------------------------------------------------
router.get('/filters', async (req, res) => {
    try {
        const { species } = req.query;

        // Distinct species for active animals
        const [speciesRows] = await db.query(
            `SELECT DISTINCT species FROM animal 
       WHERE status IN ('Available', 'Fostered', 'Under Treatment') 
       ORDER BY species`
        );

        // Breeds (filtered by species if one was selected)
        let breedSql = `SELECT DISTINCT breed FROM animal 
                    WHERE status IN ('Available', 'Fostered', 'Under Treatment') 
                      AND breed IS NOT NULL AND breed != ''`;
        const breedParams = [];
        if (species) {
            breedSql += ` AND species = ?`;
            breedParams.push(species);
        }
        breedSql += ` ORDER BY breed`;
        const [breedRows] = await db.query(breedSql, breedParams);

        // All shelters for the location filter
        const [shelterRows] = await db.query(
            `SELECT shelter_id, name, city FROM shelter ORDER BY name`
        );

        res.json({
            species: speciesRows.map(r => r.species),
            breeds: breedRows.map(r => r.breed),
            shelters: shelterRows
        });
    } catch (err) {
        console.error('Error fetching filters:', err);
        res.status(500).json({ error: 'Failed to load filters' });
    }
});

// -------------------------------------------------------------
// 2. GET /api/animals
// Lists animals with status Available, Fostered, or Under Treatment.
// Joined with shelter's name and city.
// Optional filters: species, breed, age_group, shelter_id
// -------------------------------------------------------------
router.get('/animals', async (req, res) => {
    try {
        const { species, breed, age_group, shelter_id } = req.query;

        let sql = `
      SELECT a.animal_id, a.name, a.species, a.breed, a.age_months, 
             a.gender, a.status, a.image_url, a.notes,
             s.shelter_id, s.name AS shelter_name, s.city AS shelter_city
      FROM animal a
      JOIN shelter s ON a.shelter_id = s.shelter_id
      WHERE a.status IN ('Available', 'Fostered', 'Under Treatment')
    `;
        const params = [];

        // Filter by species
        if (species) {
            sql += ` AND a.species = ?`;
            params.push(species);
        }

        // Filter by breed
        if (breed) {
            sql += ` AND a.breed = ?`;
            params.push(breed);
        }

        // Filter by shelter location
        if (shelter_id) {
            sql += ` AND a.shelter_id = ?`;
            params.push(shelter_id);
        }

        // Filter by age groups using age_months:
        // Baby: 0–11, Young: 12–35, Adult: 36–83, Senior: 84+
        if (age_group === 'Baby') {
            sql += ` AND a.age_months BETWEEN 0 AND 11`;
        } else if (age_group === 'Young') {
            sql += ` AND a.age_months BETWEEN 12 AND 35`;
        } else if (age_group === 'Adult') {
            sql += ` AND a.age_months BETWEEN 36 AND 83`;
        } else if (age_group === 'Senior') {
            sql += ` AND a.age_months >= 84`;
        }

        sql += ` ORDER BY a.animal_id DESC`;

        const [animals] = await db.query(sql, params);
        res.json(animals);
    } catch (err) {
        console.error('Error fetching animals:', err);
        res.status(500).json({ error: 'Failed to load animals' });
    }
});

// -------------------------------------------------------------
// 3. GET /api/animals/:id
// Returns one animal with its medical summary and vaccinations
// -------------------------------------------------------------
router.get('/animals/:id', async (req, res) => {
    try {
        const animalId = req.params.id;

        // Fetch the animal and shelter details
        const [animals] = await db.query(
            `SELECT a.animal_id, a.name, a.species, a.breed, a.age_months,
              a.gender, a.intake_date, a.status, a.image_url, a.notes,
              s.shelter_id, s.name AS shelter_name, s.city AS shelter_city,
              s.address AS shelter_address, s.phone AS shelter_phone, s.email AS shelter_email
       FROM animal a
       JOIN shelter s ON a.shelter_id = s.shelter_id
       WHERE a.animal_id = ?`,
            [animalId]
        );

        if (animals.length === 0) {
            return res.status(404).json({ error: 'Animal not found' });
        }

        const animal = animals[0];

        // Fetch medical records (summary history)
        const [medicalRecords] = await db.query(
            `SELECT m.record_id, m.visit_date, m.diagnosis, m.treatment, st.name AS vet_name
       FROM medical_record m
       LEFT JOIN staff st ON m.staff_id = st.staff_id
       WHERE m.animal_id = ?
       ORDER BY m.visit_date DESC`,
            [animalId]
        );

        // Fetch vaccinations
        const [vaccinations] = await db.query(
            `SELECT vaccination_id, vaccine_name, date_given, next_due_date
       FROM vaccination
       WHERE animal_id = ?
       ORDER BY date_given DESC`,
            [animalId]
        );

        // Attach to the animal object
        animal.medical_records = medicalRecords;
        animal.vaccinations = vaccinations;

        res.json(animal);
    } catch (err) {
        console.error('Error fetching animal details:', err);
        res.status(500).json({ error: 'Failed to load animal details' });
    }
});

module.exports = router;