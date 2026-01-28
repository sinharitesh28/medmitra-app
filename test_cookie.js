const http = require('http');
const db = require('./Backend/DB/db');
require('dotenv').config();

const EMAIL = 'ritesh.sinha37738@paruluniversity.ac.in';

async function test() {
    try {
        console.log('1. Setting valid OTP in DB...');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
        await db.query("UPDATE system_users SET otp_code = '999999', otp_expires_at = ? WHERE email = ?", [expiresAt, EMAIL]);

        console.log('2. Calling /api/auth/verify-otp...');
        const postData = JSON.stringify({
            email: EMAIL,
            otp: '999999'
        });

        const req = http.request({
            hostname: 'localhost',
            port: 3000, // app port
            path: '/api/auth/verify-otp',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            console.log(`STATUS: ${res.statusCode}`);
            console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
            
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                console.log('BODY:', data);
                
                const cookies = res.headers['set-cookie'];
                if (cookies) {
                    console.log('SUCCESS: Set-Cookie header found!');
                    
                    // Step 3: Call /api/auth/me
                    console.log('3. Calling /api/auth/me with cookie...');
                    const cookieHeader = cookies[0].split(';')[0]; // Extract 'auth_token=...'

                    const req2 = http.request({
                        hostname: 'localhost',
                        port: 3000,
                        path: '/api/auth/me',
                        method: 'GET',
                        headers: {
                            'Cookie': cookieHeader
                        }
                    }, (res2) => {
                        console.log(`STATUS (Me): ${res2.statusCode}`);
                        let data2 = '';
                        res2.on('data', (c) => data2 += c);
                        res2.on('end', () => {
                            console.log('BODY (Me):', data2);
                            process.exit(0);
                        });
                    });
                    req2.end();
                } else {
                    console.log('FAILURE: Set-Cookie header MISSING!');
                    process.exit(1);
                }
            });
        });

        req.on('error', (e) => {
            console.error(`problem with request: ${e.message}`);
            process.exit(1);
        });

        req.write(postData);
        req.end();

    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

test();
