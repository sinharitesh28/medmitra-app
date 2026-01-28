const db = require('./Backend/DB/db');
require('dotenv').config();

async function debug() {
    try {
        const email = 'ritesh.sinha37738@paruluniversity.ac.in';
        
        // 1. Simulate setting OTP via DB (using MySQL NOW())
        console.log('--- Setting OTP ---');
        await db.query("UPDATE system_users SET otp_code = '123456', otp_expires_at = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE email = ?", [email]);
        
        // 2. Fetch it back immediately
        const [users] = await db.query("SELECT otp_expires_at FROM system_users WHERE email = ?", [email]);
        const user = users[0];
        
        const jsDate = new Date();
        const dbDate = new Date(user.otp_expires_at);
        
        console.log('JS Date (new Date()):', jsDate.toString());
        console.log('JS Date (ISO):       ', jsDate.toISOString());
        console.log('DB Date (Raw):       ', user.otp_expires_at);
        console.log('DB Date (Object):    ', dbDate.toString());
        console.log('DB Date (ISO):       ', dbDate.toISOString());
        
        console.log('--- Comparison ---');
        console.log('JS > DB ?', jsDate > dbDate);
        
        if (jsDate > dbDate) {
            console.log('RESULT: EXPIRED (Incorrect!)');
        } else {
            console.log('RESULT: VALID (Correct)');
        }
        
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

debug();
