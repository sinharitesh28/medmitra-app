const db = require('./Backend/DB/db');
require('dotenv').config();

async function audit() {
    try {
        console.log('--- User Audit ---');
        const [users] = await db.query("SELECT user_id, email, name, role, status, telegram_chat_id, otp_code, otp_expires_at FROM system_users");
        console.table(users);
        process.exit(0);
    } catch (e) {
        console.error('Audit failed:', e);
        process.exit(1);
    }
}

audit();
