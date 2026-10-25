# Animal Adoption and Foster Care System

A comprehensive, full-stack web application designed for animal shelters in Pune and surrounding regions. The platform connects animal lovers with rescue pets for adoption and temporary foster care, facilitates direct donations to local shelters, and equips shelter administrators with tools to track animals, medical histories, vaccination schedules, and care applications.

---

## 🌟 Key Features & Division of Work

### 🐾 Public Portal (Person 2 - Aditi Kadam)

- **Browse Animals & Multi-Criteria Filtering (`animals.html`)**:
  - Filter adoptable animals by **Species**, **Breed** (dynamically updated per species), **Age Group**, and **Shelter Location**.
  - Age groups calculated dynamically from `age_months`:
    - **Baby**: 0–11 months
    - **Young**: 12–35 months (1–2 years)
    - **Adult**: 36–83 months (3–6 years)
    - **Senior**: 84+ months (7+ years)
  - Displays dynamic badges for pets currently **Fostered** or **Under Treatment**.
  - One-click "Clear Filters" and intuitive empty states.

- **Animal Detail View (`animal.html`)**:
  - Detailed profiles displaying breed, age, shelter contact details, and personality notes.
  - Complete **Medical Summary** (visit dates, diagnoses, treatments, examining vets).
  - Complete **Vaccination History** (vaccines given, dates, and upcoming due dates).
  - Contextual action buttons: **Adopt Me** and **Foster Me** appear only when animal status is `Available`.

- **Public Donations with Donor Lookup (`donate.html`)**:
  - Requires no login; donors can support any shelter of their choice.
  - Automatically reuses donor profiles based on unique email addresses or creates a new donor row.
  - Quick donation amounts (₹500, ₹1,000, ₹2,500, ₹5,000) or custom input with strict validation (`amount > 0`).
  - Interactive Thank-You confirmation card with reference ID upon donation.

- **Adoption Applications (`adopt.html`)**:
  - Requires login (role `user`).
  - Read-only pet summary card.
  - Automatically pre-fills user details from their profile; updates their database record if modified.
  - Prevents duplicate active applications for the same animal.
  - Submits request with status `Pending` and today's date.

- **Foster Care Applications (`foster.html`)**:
  - Requires login (role `user`).
  - Captures expected start date and expected end date with client-side and server-side validation.
  - Automatically checks that the pet is available and the applicant has no active foster request.

- **User Requests Dashboard (`my-requests.html`)**:
  - Centralized dashboard for public users to track the status of all submitted adoption and foster requests.
  - Status badges for `Pending`, `Approved`, `Rejected`, and `Ended`.

- **Security & Safety Standards**:
  - **SQL Injection Prevention**: All queries strictly utilize parameterized placeholders (`?`).
  - **XSS Protection**: All user and database data rendered in the DOM strictly uses `textContent`.
  - **Safe Login Redirect**: Safe redirect validation prevents open-redirect phishing by accepting only single-slash internal paths (`/animal.html?id=...`).
  - **Session Integrity**: User IDs are always taken from server-side `req.session.user`, never from client requests.

---

### 🛡️ Admin Portal (Person 1 - Payal Gaikwad)

- **Role-Based Access Control**: Shelter Admins (scoped to their own shelter) and Global Admins (unrestricted cross-shelter access).
- **Animal Management**: Add, update, and manage shelter intakes and statuses.
- **Medical & Vaccination Records**: Add clinical visit records and track vaccinations with 30-day due date filters.
- **Request Approvals**: Review pending adoption and foster applications. Approving one request automatically rejects competing pending requests and updates animal status (`Adopted` or `Fostered`).
- **Staff & Shelter Management**: Register vets, caretakers, and shelter locations.

---

## 🛠️ Technology Stack

- **Backend**: Node.js, Express.js, `express-session`
- **Database**: MySQL (`mysql2/promise` with `dateStrings: true`)
- **Authentication**: `bcrypt` password hashing, cookie-based session management
- **Frontend**: HTML5, Vanilla JavaScript (ES6+), Bootstrap 5.3.3, Custom CSS
- **Media**: Local asset storage under `frontend/images/animals/` with fallback to `default.jpg`

---

## 📂 Project Structure

```text
Animal_Care_System/
├── backend/
│   ├── database/
│   │   ├── schema.sql           # Database creation & table definitions
│   │   └── seed.sql             # Sample data for shelters, animals, staff, users
│   ├── middleware/
│   │   └── auth.js              # Authentication & role-check middleware
│   ├── routes/
│   │   ├── admin-animals.js     # Admin animal management routes
│   │   ├── admin-records.js     # Medical & vaccination record routes
│   │   ├── admin-requests.js    # Adoption & foster approval routes
│   │   ├── admin-shelters.js    # Shelter administration routes
│   │   ├── admin-staff.js       # Staff management routes
│   │   ├── animals.js           # Public animal browsing & details APIs
│   │   ├── auth.js              # Login, register, logout, and session check
│   │   ├── donations.js         # Public donation handling APIs
│   │   └── requests.js          # Public adoption & foster request APIs
│   ├── db.js                    # MySQL connection pool configuration
│   ├── server.js                # Express server entry point
│   ├── package.json
│   └── .env                     # Database credentials & session secret
├── frontend/
│   ├── admin/                   # Admin portal HTML pages
│   ├── css/
│   │   └── style.css            # Custom theme styles
│   ├── images/
│   │   └── animals/             # Animal photos & default.jpg fallback
│   ├── js/
│   │   └── common.js            # Shared fetch API wrapper & navbar loader
│   ├── about.html               # About organization page
│   ├── adopt.html               # Adoption application form
│   ├── animal.html              # Single animal profile & medical summary
│   ├── animals.html             # Public animal browse & filter page
│   ├── contact.html             # Shelter contact details page
│   ├── donate.html              # Public donation page
│   ├── foster.html              # Foster care application form
│   ├── index.html               # Landing page
│   ├── login.html               # Unified login with safe redirection
│   ├── my-requests.html         # User application status dashboard
│   ├── navbar.html              # Reusable top navigation component
│   └── register.html            # Public user registration page
└── README.md
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- [MySQL Server](https://dev.mysql.com/downloads/) (v8.0 or higher)

### 2. Database Setup
1. Start your local MySQL service.
2. Open your MySQL client or terminal and run:
   ```sql
   SOURCE backend/database/schema.sql;
   SOURCE backend/database/seed.sql;
   ```

### 3. Environment Configuration
Create or verify `backend/.env` with your MySQL credentials:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=animal_shelter
SESSION_SECRET=your_secret_key
```

### 4. Install Dependencies & Run
From the `backend` directory:
```powershell
cd backend
npm install
node server.js
```

Open your browser at: **`http://localhost:3000`**

---

## 🔑 Test Credentials

| Role | Email | Password | Scope |
| :--- | :--- | :--- | :--- |
| **Global Admin** | `global@happypaws.org` | `admin123` | Full access to all shelters & records |
| **Shelter Admin** | `admin@happypaws.org` | `admin123` | Scoped to Pune Happy Paws (Shelter #1) |
| **Shelter Admin** | `sneha@haven.org` | `admin123` | Scoped to Mumbai Animal Haven (Shelter #2) |
| **Public User** | `amit@gmail.com` | `password123` | Can adopt, foster, donate, and view requests |
| **Public User** | `neha@gmail.com` | `password123` | Can adopt, foster, donate, and view requests |