-- Animal Adoption and Foster Care System
-- seed.sql: Sample initial data for testing and development.
-- Prerequisites: Run schema.sql first.
--
-- Passwords:
--   Staff (Admin & Global Admin): admin123
--   Public Users (amit, neha): password123

USE animal_shelter;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE foster_assignment;
TRUNCATE TABLE adoption;
TRUNCATE TABLE vaccination;
TRUNCATE TABLE medical_record;
TRUNCATE TABLE donation;
TRUNCATE TABLE donor;
TRUNCATE TABLE animal;
TRUNCATE TABLE staff;
TRUNCATE TABLE users;
TRUNCATE TABLE shelter;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. SHELTERS
INSERT INTO shelter (shelter_id, name, address, city, phone, email, capacity) VALUES
(1, 'Pune Happy Paws', '123 MG Road, Camp', 'Pune', '020-12345678', 'pune@happypaws.org', 50),
(2, 'Mumbai Animal Haven', '45 Linking Road, Bandra', 'Mumbai', '022-87654321', 'mumbai@haven.org', 60),
(3, 'PCMC Paws Sanctuary', '78 Old Mumbai Highway, Nigdi', 'PCMC', '020-99887766', 'pcmc@paws.org', 40);

-- 2. STAFF
-- Global Admin (shelter_id is NULL)
INSERT INTO staff (staff_id, name, email, phone, role, shelter_id, can_login, password_hash) VALUES
(1, 'Global Admin Super', 'global@happypaws.org', '9876543210', 'Global Admin', NULL, 1,
 '$2b$10$f8tJG4ejzt7B7PlEmnwbB.I0nqtzo6QGSgVjUGh/FC3DJ.k8/s.RC');

-- Shelter 1 Staff
INSERT INTO staff (staff_id, name, email, phone, role, shelter_id, can_login, password_hash) VALUES
(2, 'Admin Rahul', 'admin@happypaws.org', '9876543211', 'Admin', 1, 1,
 '$2b$10$f8tJG4ejzt7B7PlEmnwbB.I0nqtzo6QGSgVjUGh/FC3DJ.k8/s.RC'),
(3, 'Dr. Priya (Vet)', 'priya@happypaws.org', '9876543212', 'Vet', 1, 0, NULL),
(4, 'Suresh Caretaker', 'suresh@happypaws.org', '9876543213', 'Caretaker', 1, 0, NULL);

-- Shelter 2 Staff
INSERT INTO staff (staff_id, name, email, phone, role, shelter_id, can_login, password_hash) VALUES
(5, 'Admin Sneha', 'sneha@haven.org', '9876543220', 'Admin', 2, 1,
 '$2b$10$f8tJG4ejzt7B7PlEmnwbB.I0nqtzo6QGSgVjUGh/FC3DJ.k8/s.RC'),
(6, 'Dr. Amit (Vet)', 'amit.vet@haven.org', '9876543221', 'Vet', 2, 0, NULL);

-- 3. PUBLIC USERS (People who adopt or foster)
INSERT INTO users (user_id, name, email, phone, address, password_hash) VALUES
(1, 'Amit Sharma', 'amit@gmail.com', '9822012345', 'Kothrud, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(2, 'Neha Patil', 'neha@gmail.com', '9822054321', 'Viman Nagar, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(3, 'Rohan Verma', 'rohan@gmail.com', '9822099999', 'Andheri, Mumbai',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26');

-- 4. ANIMALS
INSERT INTO animal (animal_id, name, species, breed, age_months, gender, intake_date, status, image_url, notes, shelter_id) VALUES
(1, 'Rocky', 'Dog', 'Indie / Mixed', 18, 'Male', '2026-10-01', 'Available', 'https://images.unsplash.com/photo-1543466835-00a7907e9de1', 'Playful, friendly with children, fully active', 1),
(2, 'Bella', 'Cat', 'Persian Mix', 12, 'Female', '2026-10-10', 'Available', 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba', 'Calm and indoor loving, litter trained', 1),
(3, 'Bruno', 'Dog', 'Labrador Retriever', 24, 'Male', '2026-10-15', 'Under Treatment', 'https://images.unsplash.com/photo-1552053831-71594a27632d', 'Under skin allergy treatment, recovering well', 1),
(4, 'Luna', 'Cat', 'Domestic Shorthair', 8, 'Female', '2026-10-18', 'Available', 'https://images.unsplash.com/photo-1573865526739-10659fec78a5', 'Very affectionate kitten, vaccinated', 2),
(5, 'Max', 'Dog', 'German Shepherd Mix', 30, 'Male', '2026-09-20', 'Available', 'https://images.unsplash.com/photo-1589941013453-ec89f33b5e95', 'Alert, trained, great companion dog', 2);

-- 5. MEDICAL RECORDS
INSERT INTO medical_record (record_id, animal_id, staff_id, visit_date, diagnosis, treatment) VALUES
(1, 1, 3, '2026-10-02', 'General intake health checkup', 'Deworming tablet administered'),
(2, 2, 3, '2026-10-11', 'Mild ear mite irritation', 'Ear drops prescribed for 5 days'),
(3, 3, 3, '2026-10-16', 'Allergic dermatitis', 'Antihistamine and medicated bath weekly');

-- 6. VACCINATIONS
-- Note: Bella and Bruno have vaccines due within 30 days to test the ?due=1 filter
INSERT INTO vaccination (vaccination_id, animal_id, vaccine_name, date_given, next_due_date) VALUES
(1, 1, 'Anti-Rabies', '2026-10-02', '2027-10-02'),
(2, 1, 'DHPP', '2026-10-02', '2027-10-02'),
(3, 2, 'FVRCP', '2026-10-11', DATE_ADD(CURDATE(), INTERVAL 15 DAY)),
(4, 3, 'DHPP Booster', '2026-10-16', DATE_ADD(CURDATE(), INTERVAL 20 DAY)),
(5, 4, 'Rabies', '2026-10-18', '2027-10-18');

-- 7. DONORS & DONATIONS
INSERT INTO donor (donor_id, name, email, phone, address) VALUES
(1, 'Vikram Malhotra', 'vikram@yahoo.com', '9811122233', 'FC Road, Pune'),
(2, 'Ananya Sen', 'ananya@gmail.com', '9822233344', 'Bandra West, Mumbai');

INSERT INTO donation (donation_id, donor_id, shelter_id, amount, donated_on) VALUES
(1, 1, 1, 5000.00, '2026-10-05'),
(2, 2, 2, 10000.00, '2026-10-12'),
(3, 1, 1, 2500.00, '2026-10-20');

-- 8. ADOPTION REQUESTS (Sample test requests)
INSERT INTO adoption (adoption_id, animal_id, user_id, request_date, status, adopted_date, notes) VALUES
(1, 1, 1, '2026-10-22', 'Pending', NULL, 'Applicant has a spacious home with fenced yard');

-- 9. FOSTER REQUESTS (Sample test requests)
INSERT INTO foster_assignment (foster_record_id, animal_id, user_id, request_date, start_date, end_date, status, notes) VALUES
(1, 2, 2, '2026-10-23', '2026-11-01', '2026-12-01', 'Pending', 'Experienced with cats, looking to foster temporarily');
