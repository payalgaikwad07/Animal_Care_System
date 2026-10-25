-- Animal Adoption and Foster Care System
-- schema.sql: creates the database and all tables.
-- Safe to re-run: it drops the old tables first (this deletes all data).
-- After running this, run seed.sql to load the sample data.

CREATE DATABASE IF NOT EXISTS animal_shelter;
USE animal_shelter;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS foster_assignment;
DROP TABLE IF EXISTS adoption;
DROP TABLE IF EXISTS vaccination;
DROP TABLE IF EXISTS medical_record;
DROP TABLE IF EXISTS donation;
DROP TABLE IF EXISTS donor;
DROP TABLE IF EXISTS foster_parent;
DROP TABLE IF EXISTS adopter;
DROP TABLE IF EXISTS animal;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS shelter;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. SHELTER (4-5 rows, loaded from seed.sql)
CREATE TABLE shelter (
  shelter_id INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  address    VARCHAR(255) NOT NULL,
  city       VARCHAR(50)  NOT NULL,
  phone      VARCHAR(15)  NOT NULL,
  email      VARCHAR(100),
  capacity   INT NOT NULL DEFAULT 50
);

-- 2. USERS (public login: people who adopt or foster)
CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(100) NOT NULL UNIQUE,
  phone         VARCHAR(15),
  address       VARCHAR(255),
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. STAFF (shelter admins, global admin, and staff with no login like vets)
-- Global Admin: role = 'Global Admin' and shelter_id is NULL.
-- can_login = 0 means the person is only a name in lists (e.g. "examined by").
CREATE TABLE staff (
  staff_id      INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(100) NOT NULL UNIQUE,
  phone         VARCHAR(15),
  role          ENUM('Global Admin','Admin','Vet','Caretaker') NOT NULL,
  shelter_id    INT NULL,
  can_login     BOOLEAN NOT NULL DEFAULT 0,
  password_hash VARCHAR(100) NULL,
  FOREIGN KEY (shelter_id) REFERENCES shelter(shelter_id)
);

-- 4. ANIMAL (never deleted, only the status changes)
CREATE TABLE animal (
  animal_id   INT AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50) NOT NULL,
  species     VARCHAR(30) NOT NULL,
  breed       VARCHAR(50),
  age_months  INT NOT NULL,
  gender      ENUM('Male','Female') NOT NULL,
  intake_date DATE NOT NULL,
  status      ENUM('Available','Under Treatment','Fostered','Adopted') NOT NULL DEFAULT 'Available',
  image_url   VARCHAR(255),
  notes       TEXT,
  shelter_id  INT NOT NULL,
  FOREIGN KEY (shelter_id) REFERENCES shelter(shelter_id)
);

-- 5. MEDICAL_RECORD (history: add new rows, never overwrite)
-- staff_id = who examined the animal (can be NULL)
CREATE TABLE medical_record (
  record_id  INT AUTO_INCREMENT PRIMARY KEY,
  animal_id  INT NOT NULL,
  staff_id   INT NULL,
  visit_date DATE NOT NULL,
  diagnosis  VARCHAR(255) NOT NULL,
  treatment  VARCHAR(255),
  FOREIGN KEY (animal_id) REFERENCES animal(animal_id),
  FOREIGN KEY (staff_id)  REFERENCES staff(staff_id)
);

-- 6. VACCINATION (history: add new rows, never overwrite)
CREATE TABLE vaccination (
  vaccination_id INT AUTO_INCREMENT PRIMARY KEY,
  animal_id      INT NOT NULL,
  vaccine_name   VARCHAR(100) NOT NULL,
  date_given     DATE NOT NULL,
  next_due_date  DATE NULL,
  FOREIGN KEY (animal_id) REFERENCES animal(animal_id)
);

-- 7. DONOR (donating needs no login)
CREATE TABLE donor (
  donor_id INT AUTO_INCREMENT PRIMARY KEY,
  name     VARCHAR(100) NOT NULL,
  email    VARCHAR(100) NOT NULL,
  phone    VARCHAR(15),
  address  VARCHAR(255)
);

-- 8. DONATION
CREATE TABLE donation (
  donation_id INT AUTO_INCREMENT PRIMARY KEY,
  donor_id    INT NOT NULL,
  shelter_id  INT NOT NULL,
  amount      DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  donated_on  DATE NOT NULL,
  FOREIGN KEY (donor_id)   REFERENCES donor(donor_id),
  FOREIGN KEY (shelter_id) REFERENCES shelter(shelter_id)
);

-- 9. ADOPTION (one row per adoption request)
-- The adopter is a registered user, so this points to users (name, email,
-- phone and address are read from users with a join, not copied).
-- Rules kept in the backend code:
--   * only an 'Available' animal can get a new request
--   * a user cannot have two active requests for the same animal
--   * approving one request rejects the other Pending ones for that animal
CREATE TABLE adoption (
  adoption_id  INT AUTO_INCREMENT PRIMARY KEY,
  animal_id    INT NOT NULL,
  user_id      INT NOT NULL,
  request_date DATE NOT NULL,
  status       ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
  adopted_date DATE NULL,
  notes        VARCHAR(255),
  FOREIGN KEY (animal_id) REFERENCES animal(animal_id),
  FOREIGN KEY (user_id)   REFERENCES users(user_id)
);

-- 10. FOSTER_ASSIGNMENT (one row per foster request)
-- The foster parent is a registered user, so this table points to users.
-- start_date and end_date are the expected dates until the admin approves.
-- 'Ended' = foster period finished and the animal went back to Available.
CREATE TABLE foster_assignment (
  foster_record_id INT AUTO_INCREMENT PRIMARY KEY,
  animal_id        INT NOT NULL,
  user_id          INT NOT NULL,
  request_date     DATE NOT NULL,
  start_date       DATE NULL,
  end_date         DATE NULL,
  status           ENUM('Pending','Approved','Rejected','Ended') NOT NULL DEFAULT 'Pending',
  notes            VARCHAR(255),
  FOREIGN KEY (animal_id) REFERENCES animal(animal_id),
  FOREIGN KEY (user_id)   REFERENCES users(user_id)
);