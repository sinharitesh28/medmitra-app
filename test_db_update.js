const db = require('./Backend/DB/db');
require('dotenv').config();

async function test() {
    try {
        const email = 'ritesh.sinha37738@paruluniversity.ac.in';
        console.log(`Testing update for ${email}`);

        // 1. Select
        const [users] = await db.query("SELECT user_id FROM system_users WHERE email = ?", [email]);
        console.log('User found:', users.length > 0);

        if (users.length === 0) process.exit(0);

        // 2. Update
        const otp = '123456';
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        
        console.log('Updating...');
        const [res] = await db.query("UPDATE system_users SET otp_code = ?, otp_expires_at = ? WHERE email = ?", [otp, expiresAt, email]);
        console.log('Update result:', res);

        console.log('Success');
        process.exit(0);
    } catch (e) {
        console.error('FAIL:', e);
        process.exit(1);
    }
}

test();
