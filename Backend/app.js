const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors'); // Added CORS
require('dotenv').config();

const app = express();
const routes = require('./routes');
const authRoutes = require('./auth');
const adminRoutes = require('./admin');
const rxnormRoutes = require('./rxnorm');
const icdRoutes = require('./icd');
const { authGuard, adminGuard } = require('./auth-middleware');

// Database Connection Check
const db = require('./DB/db');
db.query('SELECT 1').then(() => {
    console.log('[App] Database connected successfully.');
}).catch(err => {
    console.error('[App] Database connection failed:', err.message);
});

// Middleware
// Enable CORS for GitHub Pages and Local Development
app.use(cors({
    origin: [
        'https://sinharitesh28.github.io', 
        'https://sinharitesh28.github.io/medmitra-app',
        'http://127.0.0.1:5500',
        'http://localhost:3000'
    ],
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Auth Routes (Public)
app.use('/api/auth', authRoutes);

// Public API routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date() }));

app.get('/api/medmitra/bot-info', (req, res) => {
    const { getBotUsername } = require('./bot');
    res.json({ username: getBotUsername() });
});

app.use(authGuard);

// Admin Routes (Protected)
app.use('/api/admin', adminGuard, adminRoutes);

// RxNorm/Formulary Routes (Protected)
app.use('/api/medmitra/rxnorm', rxnormRoutes);

// ICD Routes (Protected)
app.use('/api/medmitra/icd', icdRoutes);

// Protect Admin Page specifically
app.get('/medmitra/admin_dashboard.html', adminGuard, (req, res, next) => {
    next(); // Pass to static handler if allowed
});

// Static Files (Mimicking root structure for independence)
// When independent, accessing /medmitra/registration.html
app.use('/medmitra', express.static(path.join(__dirname, '../Pages')));

// Shared/Relative Static Resources
// These catch requests like "../Styles/medmitra.css" resolving to "/Styles/medmitra.css"
app.use('/Styles', express.static(path.join(__dirname, '../Styles')));
app.use('/Scripts', express.static(path.join(__dirname, '../Scripts')));

// API Routes
app.use('/api/medmitra', routes);

// Redirect root to registration or login
app.get('/', (req, res) => {
    res.redirect('/medmitra/registration.html');
});

module.exports = app;
