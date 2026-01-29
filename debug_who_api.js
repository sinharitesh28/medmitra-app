const CLIENT_ID = process.env.ICD_CLIENT_ID || '9e03852e-9a8c-462b-8937-fd4bca7acecc_74ce85a4-4867-460d-abd5-c7533c6c2068';
const CLIENT_SECRET = process.env.ICD_CLIENT_SECRET || 'AiCMh8sEwpl3V7rMpy5lagPGPuV7F34EO8dSA1HtUdk=';
const TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';

async function test() {
    // 1. Get Token
    const body = new URLSearchParams();
    body.append('client_id', CLIENT_ID);
    body.append('client_secret', CLIENT_SECRET);
    body.append('grant_type', 'client_credentials');
    body.append('scope', 'icdapi_access');

    console.log('Fetching Token...');
    const res = await fetch(TOKEN_URL, { method: 'POST', body: body });
    if (!res.ok) {
        console.error('Token Failed:', await res.text());
        return;
    }
    const tokenData = await res.json();
    const token = tokenData.access_token;
    console.log('Token Acquired.');

    // 2. Test URLs
    const urls = [
        'https://id.who.int/icd/entity/search?q=headache',
        'https://id.who.int/icd/release/11/mms/search?q=headache',
        'https://id.who.int/icd/release/11/2024-01/mms/search?q=headache'
    ];

    for (const url of urls) {
        console.log(`
Testing: ${url}`);
        const searchRes = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'API-Version': 'v2',
                'Accept-Language': 'en'
            }
        });
        console.log(`Status: ${searchRes.status}`);
        if (searchRes.ok) {
            const data = await searchRes.json();
            console.log('Success! Results:', data.destinationEntities ? data.destinationEntities.length : 'Structure Unknown');
        } else {
            console.log('Error:', await searchRes.text());
        }
    }
}

test();
