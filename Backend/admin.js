const express = require('express');
const router = express.Router();
const db = require('./DB/db');

// 1. Get All Users
router.get('/users', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT user_id, email, name, role, status, telegram_chat_id, created_at FROM system_users ORDER BY created_at DESC");
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Database error' });
    }
});

// 2. Add User
router.post('/users', async (req, res) => {
    const { name, email, isAdmin } = req.body;
    const role = isAdmin ? 'ADMIN' : 'STAFF';

    try {
        await db.query(
            "INSERT INTO system_users (name, email, role, status) VALUES (?, ?, ?, 'ACTIVE')", 
            [name, email, role]
        );
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Failed to add user' });
    }
});

// 3. Update User
router.put('/users/:id', async (req, res) => {
    const userId = req.params.id;
    const { name, email, isAdmin } = req.body;
    const role = isAdmin ? 'ADMIN' : 'STAFF';

    // Prevent demoting self
    if (parseInt(userId) === req.user.user_id && role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
        return res.status(400).json({ error: 'You cannot demote yourself.' });
    }

    try {
        await db.query(
            "UPDATE system_users SET name = ?, email = ?, role = ? WHERE user_id = ?", 
            [name, email, role, userId]
        );
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// 4. Remove User (Soft Delete)
router.delete('/users/:id', async (req, res) => {
    const userId = req.params.id;

    // Prevent deleting self
    if (parseInt(userId) === req.user.user_id) {
        return res.status(400).json({ error: 'You cannot delete yourself.' });
    }

    try {
        // Toggle Logic: If Active -> Inactive, If Inactive -> Active
        await db.query(`
            UPDATE system_users 
            SET status = CASE WHEN status = 'ACTIVE' THEN 'INACTIVE' ELSE 'ACTIVE' END 
            WHERE user_id = ?`, 
            [userId]
        );
        res.json({ success: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to remove user' });
    }
});

module.exports = router;