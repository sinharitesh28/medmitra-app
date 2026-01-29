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

    const res = await fetch(TOKEN_URL, { method: 'POST', body: body });
    const tokenData = await res.json();
    const token = tokenData.access_token;

    // 2. Test URL with params
    const url = 'https://id.who.int/icd/entity/search?q=headache&useFlexisearch=true&includeKeywordResult=true';
    console.log(`Testing: ${url}`);
    
    const searchRes = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'API-Version': 'v2',
            'Accept-Language': 'en'
        }
    });
    console.log(`Status: ${searchRes.status}`);
    console.log('Response:', await searchRes.text());
}

test();
