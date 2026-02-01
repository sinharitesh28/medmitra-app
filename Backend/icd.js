const express = require('express');
const router = express.Router();

// WHO Credentials
const CLIENT_ID = process.env.ICD_CLIENT_ID || '9e03852e-9a8c-462b-8937-fd4bca7acecc_74ce85a4-4867-460d-abd5-c7533c6c2068';
const CLIENT_SECRET = process.env.ICD_CLIENT_SECRET || 'AiCMh8sEwpl3V7rMpy5lagPGPuV7F34EO8dSA1HtUdk=';
const TOKEN_URL = 'https://icdaccessmanagement.who.int/connect/token';
// Verified Working Endpoint
const SEARCH_URL = 'https://id.who.int/icd/entity/search';

let accessToken = null;
let tokenExpiresAt = 0;

function logICD(msg) {
    console.log(`[${new Date().toISOString()}] ${msg}`);
}

// 1. Get OAuth Token
async function getToken() {
    if (accessToken && Date.now() < tokenExpiresAt) {
        return accessToken;
    }

    try {
        logICD('Fetching Token...');
        const body = new URLSearchParams();
        body.append('client_id', CLIENT_ID);
        body.append('client_secret', CLIENT_SECRET);
        body.append('grant_type', 'client_credentials');
        body.append('scope', 'icdapi_access');

        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            body: body
        });

        if (!res.ok) throw new Error('Token fetch failed: ' + res.status + ' ' + await res.text());

        const data = await res.json();
        accessToken = data.access_token;
        // Set expiry 5 minutes earlier to allow for proactive refresh
        tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 300000; 
        
        logICD('Token Acquired');
        return accessToken;
    } catch (e) {
        logICD('Auth Error: ' + e.message);
        return null;
    }
}

// Proactive Token Refresher (runs every 10 mins)
setInterval(async () => {
    if (!accessToken || Date.now() > (tokenExpiresAt - 600000)) { // Refresh if close to expiry
        logICD('Proactive token refresh triggered');
        await getToken();
    }
}, 600000);

// Initialize token on startup
getToken();

// 2. Search Proxy
router.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);

    const token = await getToken();
    if (!token) return res.status(500).json({ error: 'ICD Auth Failed' });

    try {
        // Optimized URL parameters
        const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&useFlexisearch=true&flatResults=true`;
        
        const apiRes = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'API-Version': 'v2',
                'Accept-Language': 'en'
            }
        });

        if (!apiRes.ok) throw new Error('Search failed: ' + apiRes.status);

        const data = await apiRes.json();
        
        // Filter: Only include entities that HAVE a code (No "No Code" results)
        const results = data.destinationEntities 
            ? data.destinationEntities
                .filter(entity => entity.theCode && entity.theCode !== 'No Code')
                .map(entity => ({
                    title: entity.title.replace(/<[^>]*>?/gm, ''), 
                    code: entity.theCode,
                    id: entity.id
                })) 
            : [];

        res.json(results.slice(0, 15)); // Limit to top 15 for speed

    } catch (e) {
        console.error('[ICD] Search Error:', e);
        res.status(500).json({ error: 'Search Failed' });
    }
});

module.exports = router;
