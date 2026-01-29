const http = require('http');

async function test() {
    const query = 'headache';
    console.log(`Testing ICD Search for: ${query}`);

    const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: `/api/medmitra/icd/search?q=${query}`,
        method: 'GET'
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

    req.end();
}

test();
