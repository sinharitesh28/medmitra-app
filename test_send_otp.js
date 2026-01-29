const http = require('http');
// require('dotenv').config(); // Not needed inside container if env vars are set

const EMAIL = 'invalid@test.com';

async function test() {
    const postData = JSON.stringify({ email: EMAIL });

    console.log('Sending request to localhost:3000/api/auth/send-otp');

    const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/send-otp',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    }, (res) => {
        console.log(`STATUS: ${res.statusCode}`);
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log('BODY:', data);
        });
    });

    req.on('error', (e) => {
        console.error('Request Error:', e);
    });

    req.write(postData);
    req.end();
}

test();