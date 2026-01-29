const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'medmitra_secret_key_change_me';

const authGuard = (req, res, next) => {
    // Check if request is for the login page or public routes
    if (req.path === '/login.html' || 
        req.path === '/api/auth/send-otp' || 
        req.path === '/api/auth/verify-otp' || 
        req.path === '/api/auth/logout' ||
        req.path === '/api/medmitra/bot-info' || // Added public bot-info
        req.path.startsWith('/api/medmitra/icd') || 
        req.path === '/index.html' || 
        req.path === '/') {
        return next();
    }

    // Static asset protection (optional, but good practice)
    // Allow styles/scripts
    if (req.path.startsWith('/Styles') || req.path.startsWith('/Scripts')) {
        return next();
    }

    const token = req.cookies.auth_token;

    if (!token) {
        // If API request, return 401
        if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({ error: 'Unauthorized: No Token' });
        }
        // If Page request, redirect to login
        return res.redirect('/login.html');
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { user_id, email, role }
        next();
    } catch (err) {
        console.error(`[AuthGuard] Token Verification Failed:`, err.message);
        if (req.originalUrl.startsWith('/api')) {
            return res.status(401).json({ error: 'Invalid Token' });
        }
        return res.redirect('/login.html');
    }
};

const adminGuard = (req, res, next) => {
    if (req.user && (req.user.role === 'ADMIN' || req.user.role === 'SUPER_ADMIN')) {
        next();
    } else {
        res.status(403).json({ error: 'Forbidden: Admins only' });
    }
};

module.exports = { authGuard, adminGuard };
