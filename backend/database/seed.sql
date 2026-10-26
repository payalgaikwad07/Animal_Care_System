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
(1, 'Paws Care Kothrud', 'Plot 12, Karve Road, Kothrud', 'Pune', '9800000001', 'kothrud@shelter.com', 45),
(2, 'Happy Tails Baner', 'Survey 45, Baner Road, Baner', 'Pune', '9800000002', 'baner@shelter.com', 50),
(3, 'Safe Haven Hadapsar', 'Gate 3, Solapur Road, Hadapsar', 'Pune', '9800000003', 'hadapsar@shelter.com', 40),
(4, 'Furry Friends Wakad', 'Lane 7, Datta Mandir Road, Wakad', 'Pune', '9800000004', 'wakad@shelter.com', 35),
(5, 'Second Chance Shivajinagar', '8, FC Road, Shivajinagar', 'Pune', '9800000005', 'shivajinagar@shelter.com', 55);

-- 2. STAFF
-- Existing staff and Global Admin accounts are retained as requested.
-- The shelter IDs below now refer to the five shelters listed above.
INSERT INTO staff (staff_id, name, email, phone, role, shelter_id, can_login, password_hash) VALUES
(1, 'Global Admin Super', 'global@happypaws.org', '9876543210', 'Global Admin', NULL, 1,
 '$2b$10$f8tJG4ejzt7B7PlEmnwbB.I0nqtzo6QGSgVjUGh/FC3DJ.k8/s.RC'),
(2, 'Admin Rahul', 'admin@happypaws.org', '9876543211', 'Admin', 1, 1,
 '$2b$10$f8tJG4ejzt7B7PlEmnwbB.I0nqtzo6QGSgVjUGh/FC3DJ.k8/s.RC'),
(3, 'Dr. Priya (Vet)', 'priya@happypaws.org', '9876543212', 'Vet', 1, 0, NULL),
(4, 'Suresh Caretaker', 'suresh@happypaws.org', '9876543213', 'Caretaker', 1, 0, NULL),
(5, 'Admin Sneha', 'sneha@haven.org', '9876543220', 'Admin', 2, 1,
 '$2b$10$f8tJG4ejzt7B7PlEmnwbB.I0nqtzo6QGSgVjUGh/FC3DJ.k8/s.RC'),
(6, 'Dr. Amit (Vet)', 'amit.vet@haven.org', '9876543221', 'Vet', 2, 0, NULL);

-- 3. PUBLIC USERS
-- Demo password for every account below: password123
-- The bcrypt hash is the same hash already used for Amit and Neha in the original seed.
INSERT INTO users (user_id, name, email, phone, address, password_hash) VALUES
(1, 'Amit Sharma', 'amit@gmail.com', '9822012345', 'Kothrud, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(2, 'Neha Patil', 'neha@gmail.com', '9822054321', 'Viman Nagar, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(3, 'Rohan Verma', 'rohan@gmail.com', '9822099999', 'Andheri, Mumbai',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(4, 'Kavya Deshmukh', 'kavya@gmail.com', '9822000004', 'Baner, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(5, 'Ishaan Kulkarni', 'ishaan@gmail.com', '9822000005', 'Wakad, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(6, 'Meera Joshi', 'meera@gmail.com', '9822000006', 'Hadapsar, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26'),
(7, 'Arjun Shah', 'arjun@gmail.com', '9822000007', 'Shivajinagar, Pune',
 '$2b$10$SAyYzRgYOkv2qrUPEfU9X.jjeBCB71n7RglNjpzcPRKxcF4C2Go26');

-- 4. ANIMALS (dogs and cats only)
INSERT INTO animal (animal_id, name, species, breed, age_months, gender, intake_date, status, image_url, notes, shelter_id) VALUES
(1, 'Rocky', 'Dog', 'Indie / Mixed', 18, 'Male', '2026-10-01', 'Available', 'images/animals/Rocky.webp', 'Playful and friendly with children', 1),
(2, 'Bella', 'Cat', 'Persian Mix', 12, 'Female', '2026-10-10', 'Available', 'images/animals/Bella.webp', 'Calm, indoor-loving and litter trained', 1),
(3, 'Bruno', 'Dog', 'Labrador Retriever', 24, 'Male', '2026-10-15', 'Under Treatment', 'images/animals/Bruno.webp', 'Recovering from a skin allergy', 1),
(4, 'Luna', 'Cat', 'Domestic Shorthair', 8, 'Female', '2026-10-18', 'Available', 'images/animals/Luna.webp', 'Affectionate kitten', 2),
(5, 'Max', 'Dog', 'German Shepherd Mix', 30, 'Male', '2026-09-20', 'Available', 'images/animals/Max.webp', 'Alert and energetic companion', 2),
(6, 'Milo', 'Cat', 'Domestic Shorthair', 4, 'Male', '2026-09-25', 'Available', 'images/animals/Milo.webp', 'Curious kitten who enjoys toys', 3),
(7, 'Daisy', 'Dog', 'Beagle Mix', 36, 'Female', '2026-09-28', 'Available', 'images/animals/Daisy.webp', 'Gentle and enjoys daily walks', 3),
(8, 'Simba', 'Cat', 'Orange Tabby', 20, 'Male', '2026-10-02', 'Fostered', 'images/animals/Simba.webp', 'Social cat currently in foster care', 3),
(9, 'Coco', 'Dog', 'Indie / Mixed', 10, 'Female', '2026-10-03', 'Available', 'images/animals/Coco.webp', 'Friendly young dog, learning basic commands', 4),
(10, 'Oreo', 'Cat', 'Black and White Shorthair', 16, 'Male', '2026-10-04', 'Available', 'images/animals/Oreo.webp', 'Quiet and affectionate', 4),
(11, 'Buddy', 'Dog', 'Golden Retriever Mix', 48, 'Male', '2026-10-05', 'Available', 'images/animals/Buddy.webp', 'Friendly adult dog who loves company', 5),
(12, 'Misty', 'Cat', 'Grey Domestic Shorthair', 60, 'Female', '2026-10-06', 'Available', 'images/animals/Misty.webp', 'Calm senior cat, prefers a peaceful home', 5),
(13, 'Pepper', 'Dog', 'Indie / Mixed', 6, 'Female', '2026-10-07', 'Available', 'images/animals/Pepper.webp', 'Playful puppy; needs patient training', 2),
(14, 'Nala', 'Cat', 'Domestic Shorthair', 28, 'Female', '2026-10-08', 'Under Treatment', 'images/animals/Nala.webp', 'Being monitored for a minor digestive issue', 4),
(15, 'Toby', 'Dog', 'Cocker Spaniel Mix', 90, 'Male', '2026-10-09', 'Available', 'images/animals/Toby.jpg', 'Senior dog who enjoys calm walks', 1);

-- 5. MEDICAL RECORDS
INSERT INTO medical_record (record_id, animal_id, staff_id, visit_date, diagnosis, treatment) VALUES
(1, 1, 3, '2026-10-02', 'General intake health checkup', 'Deworming tablet administered'),
(2, 2, 3, '2026-10-11', 'Mild ear mite irritation', 'Ear drops prescribed for five days'),
(3, 3, 3, '2026-10-16', 'Allergic dermatitis', 'Antihistamine and medicated bath weekly'),
(4, 4, 6, '2026-10-19', 'Routine kitten examination', 'Kitten wellness check completed'),
(5, 6, 6, '2026-10-01', 'Routine intake examination', 'Deworming and nutrition guidance'),
(6, 7, 3, '2026-10-02', 'Routine health check', 'No major concerns found'),
(7, 9, 6, '2026-10-04', 'Minor paw irritation', 'Paw cleaned and monitored'),
(8, 11, 3, '2026-10-06', 'Routine senior health check', 'Joint mobility monitored'),
(9, 14, 6, '2026-10-09', 'Mild digestive upset', 'Diet adjustment and observation'),
(10, 15, 3, '2026-10-10', 'Senior wellness check', 'Routine monitoring recommended');

-- 6. VACCINATIONS
INSERT INTO vaccination (vaccination_id, animal_id, vaccine_name, date_given, next_due_date) VALUES
(1, 1, 'Anti-Rabies', '2026-10-02', '2027-10-02'),
(2, 1, 'DHPP', '2026-10-02', '2027-10-02'),
(3, 2, 'FVRCP', '2026-10-11', DATE_ADD(CURDATE(), INTERVAL 15 DAY)),
(4, 3, 'DHPP Booster', '2026-10-16', DATE_ADD(CURDATE(), INTERVAL 20 DAY)),
(5, 4, 'Rabies', '2026-10-18', '2027-10-18'),
(6, 5, 'Anti-Rabies', '2026-09-22', '2027-09-22'),
(7, 6, 'FVRCP', '2026-10-03', '2026-11-03'),
(8, 7, 'Anti-Rabies', '2026-10-03', '2027-10-03'),
(9, 9, 'DHPP', '2026-10-05', '2027-10-05'),
(10, 10, 'FVRCP', '2026-10-05', '2027-10-05'),
(11, 11, 'Anti-Rabies', '2026-10-07', '2027-10-07'),
(12, 13, 'Puppy DHPP', '2026-10-08', '2026-11-08'),
(13, 15, 'Anti-Rabies', '2026-10-11', '2027-10-11');

-- 7. DONORS & DONATIONS
INSERT INTO donor (donor_id, name, email, phone, address) VALUES
(1, 'Vikram Malhotra', 'vikram@yahoo.com', '9811122233', 'FC Road, Pune'),
(2, 'Ananya Sen', 'ananya@gmail.com', '9822233344', 'Bandra West, Mumbai'),
(3, 'Kavya Deshmukh', 'kavya@gmail.com', '9822000004', 'Baner, Pune'),
(4, 'Ishaan Kulkarni', 'ishaan@gmail.com', '9822000005', 'Wakad, Pune'),
(5, 'Meera Joshi', 'meera@gmail.com', '9822000006', 'Hadapsar, Pune');

INSERT INTO donation (donation_id, donor_id, shelter_id, amount, donated_on) VALUES
(1, 1, 1, 5000.00, '2026-10-05'),
(2, 2, 2, 10000.00, '2026-10-12'),
(3, 1, 1, 2500.00, '2026-10-20'),
(4, 3, 2, 1500.00, '2026-10-21'),
(5, 4, 4, 2000.00, '2026-10-22'),
(6, 5, 3, 750.00, '2026-10-23');

-- 8. ADOPTION REQUESTS (sample test requests)
INSERT INTO adoption (adoption_id, animal_id, user_id, request_date, status, adopted_date, notes) VALUES
(1, 1, 1, '2026-10-22', 'Pending', NULL, 'Applicant has a spacious home with fenced yard'),
(2, 5, 4, '2026-10-23', 'Pending', NULL, 'Applicant has experience with active dogs'),
(3, 10, 5, '2026-10-24', 'Rejected', NULL, 'Sample rejected request for dashboard testing');

-- 9. FOSTER REQUESTS (sample test requests)
INSERT INTO foster_assignment (foster_record_id, animal_id, user_id, request_date, start_date, end_date, status, notes) VALUES
(1, 2, 2, '2026-10-23', '2026-11-01', '2026-12-01', 'Pending', 'Experienced with cats, looking to foster temporarily'),
(2, 8, 6, '2026-10-24', '2026-10-20', '2026-11-20', 'Approved', 'Current foster placement for sample data');
