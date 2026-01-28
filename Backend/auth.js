const express = require('express');
const router = express.Router();
const db = require('./DB/db');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { authGuard } = require('./auth-middleware'); // Import Guard
const { getBot } = require('./bot');

const JWT_SECRET = process.env.JWT_SECRET || 'medmitra_secret_key_change_me';

// Configure Email Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    
    try {
        // Check if user exists
        const [users] = await db.query("SELECT user_id, telegram_chat_id FROM system_users WHERE email = ? AND status = 'ACTIVE'", [email]);
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found or inactive.' });
        }

        const user = users[0];

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Calculate Expiration (15 mins from now)
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Save to DB
        await db.query("UPDATE system_users SET otp_code = ?, otp_expires_at = ? WHERE email = ?", [otp, expiresAt, email]);

        let message = 'OTP sent to email.';

        // 1. Send via Telegram (if linked)
        const bot = getBot();
        if (bot && user.telegram_chat_id) {
            try {
                await bot.sendMessage(user.telegram_chat_id, `🔐 *MedMitra Login Code*\n\nYour OTP is: *${otp}*\n\nExpires in 15 minutes.`, { parse_mode: 'Markdown' });
                message = 'OTP sent to Telegram and Email.';
                console.log(`[Auth] OTP sent to Telegram ${user.telegram_chat_id}`);
            } catch (err) {
                console.error('[Auth] Failed to send Telegram OTP:', err.message);
            }
        }

        // 2. Send via Email
        const mailOptions = {
            from: 'MedMitra <no-reply@medmitra.com>',
            to: email,
            subject: 'MedMitra Login Verification Code',
            text: `Your login verification code is: ${otp}\n\nThis code expires in 15 minutes.`
        };

        await transporter.sendMail(mailOptions);
        console.log(`[Auth] OTP sent to Email ${email}`);
        
        res.json({ success: true, message: message });

    } catch (e) {
        console.error('[Auth] Error sending OTP:', e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 2. Verify OTP & Login
router.post('/verify-otp', async (req, res) => {
    const { email, otp } = req.body;

    try {
        const [users] = await db.query("SELECT * FROM system_users WHERE email = ?", [email]);
        if (users.length === 0) return res.status(401).json({ error: 'Invalid User' });

        const user = users[0];

        // Check Logic
        if (user.otp_code !== otp) {
            return res.status(401).json({ error: 'Invalid OTP' });
        }

        if (new Date() > new Date(user.otp_expires_at)) {
            return res.status(401).json({ error: 'OTP Expired' });
        }

        // Success - Clear OTP
        await db.query("UPDATE system_users SET otp_code = NULL, otp_expires_at = NULL WHERE user_id = ?", [user.user_id]);

        // Generate Token
        const token = jwt.sign(
            { user_id: user.user_id, email: user.email, role: user.role },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        // Set Cookie
        res.cookie('auth_token', token, {
            httpOnly: true,
            secure: false, // Set to true if using HTTPS
            maxAge: 12 * 60 * 60 * 1000, // 12 Hours
            path: '/'
        });

        res.json({ success: true, role: user.role });

    } catch (e) {
        console.error('[Auth] Verify Error:', e);
        res.status(500).json({ error: 'Verification Failed' });
    }
});

// 3. Logout
router.post('/logout', (req, res) => {
    res.clearCookie('auth_token');
    res.json({ success: true });
});

// 4. Get Current User Info
router.get('/me', authGuard, (req, res) => {
    // This route is protected by middleware, so req.user exists
    if (!req.user) return res.status(401).json({ error: 'Not logged in' });
    res.json({
        user_id: req.user.user_id, 
        email: req.user.email, 
        role: req.user.role 
    });
});

module.exports = router;
