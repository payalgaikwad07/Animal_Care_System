require('dotenv').config();

const express = require('express');
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = 3000;

// Parse JSON request bodies
app.use(express.json());

// Parse form submissions
app.use(express.urlencoded({ extended: true }));

// Configure sessions
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60
    }
}));

// Serve frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// Temporary test route
app.get('/api/test', (req, res) => {
    res.json({ n: 12 });
});

// Authentication routes
app.use('/api', require('./routes/auth'));
//Admin routes
app.use('/api/admin', require('./routes/admin-animals'));
app.use('/api/admin', require('./routes/admin-records'));
app.use('/api/admin', require('./routes/admin-requests'));
app.use('/api/admin', require('./routes/admin-staff'));
app.use('/api/admin', require('./routes/admin-shelters'));

// Start the server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});