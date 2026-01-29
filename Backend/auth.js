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
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const fs = require('fs');

// Log Helper
function logDebug(msg) {
    const logMsg = `[${new Date().toISOString()}] ${msg}\n`;
    console.log(msg);
    fs.appendFileSync('auth_debug.log', logMsg);
}

// 1. Send OTP
router.post('/send-otp', async (req, res) => {
    const { email } = req.body;
    logDebug(`Request /send-otp for ${email}`);

    try {
        // Check if user exists
        logDebug('Step 1: DB Select');
        const [users] = await db.query("SELECT user_id, telegram_chat_id FROM system_users WHERE email = ? AND status = 'ACTIVE'", [email]);
        
        if (users.length === 0) {
            logDebug('User not found');
            return res.status(404).json({ error: 'User not found or inactive.' });
        }

        const user = users[0];

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Calculate Expiration
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        // Save to DB
        logDebug('Step 2: DB Update');
        await db.query("UPDATE system_users SET otp_code = ?, otp_expires_at = ? WHERE email = ?", [otp, expiresAt, email]);

        // RESPONSE IMMEDIATELY to prevent timeout
        res.json({ success: true, message: 'OTP generated. Sending via Email/Telegram...' });

        // Background Sending
        (async () => {
            let emailSent = false;
            let telegramSent = false;

            // 1. Send via Telegram
            logDebug('Step 3: Telegram (Background)');
            const bot = getBot();
            if (bot && user.telegram_chat_id) {
                try {
                    await bot.sendMessage(user.telegram_chat_id, `🔐 *MedMitra Login Code*\n\nYour OTP is: *${otp}*\n\nExpires in 15 minutes.`, { parse_mode: 'Markdown' });
                    telegramSent = true;
                    logDebug(`Telegram Sent to ${user.telegram_chat_id}`);
                } catch (err) {
                    logDebug(`Telegram Failed: ${err.message}`);
                }
            } else {
                logDebug('Telegram Skipped (No bot or chat_id)');
            }

            // 2. Send via Email
            logDebug('Step 4: Email (Background)');
            try {
                const mailOptions = {
                    from: 'MedMitra <no-reply@medmitra.com>',
                    to: email,
                    subject: 'MedMitra Login Verification Code',
                    text: `Your login verification code is: ${otp}\n\nThis code expires in 15 minutes.`
                };

                const emailPromise = transporter.sendMail(mailOptions);
                const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Email connection timed out (5s)')), 5000)
                );

                await Promise.race([emailPromise, timeoutPromise]);
                
                emailSent = true;
                logDebug(`Email Sent to ${email}`);
            } catch (emailErr) {
                logDebug(`Email Failed: ${emailErr.message}`);
            }
            
            if (!emailSent && !telegramSent) {
                logDebug('Background Delivery Failed for both.');
            }
        })().catch(err => logDebug(`Background Error: ${err.message}`));

    } catch (e) {
        logDebug(`CRITICAL ERROR: ${e.message}`);
        logDebug(e.stack);
        if (!res.headersSent) res.status(500).json({ error: 'Internal Server Error' });
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
