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

const fs = require('fs');

function logICD(msg) {
    fs.appendFileSync('icd_debug.log', `[${new Date().toISOString()}] ${msg}\n`);
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
        tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000;
        
        logICD('Token Acquired');
        console.log('[ICD] New Token Acquired');
        return accessToken;
    } catch (e) {
        logICD('Auth Error: ' + e.message);
        console.error('[ICD] Auth Error:', e);
        return null;
    }
}

// 2. Search Proxy
router.get('/search', async (req, res) => {
    const query = req.query.q;
    if (!query) return res.json([]);

    logICD('Search Request: ' + query);
    const token = await getToken();
    if (!token) return res.status(500).json({ error: 'ICD Auth Failed' });

    try {
        const url = `${SEARCH_URL}?q=${encodeURIComponent(query)}&useFlexisearch=true&includeKeywordResult=true`;
        
        const apiRes = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'API-Version': 'v2',
                'Accept-Language': 'en'
            }
        });

        if (!apiRes.ok) throw new Error('Search failed: ' + apiRes.status + ' ' + await apiRes.text());

        const data = await apiRes.json();
        // console.log('[ICD] Raw Response:', JSON.stringify(data).substring(0, 500)); 
        
        // Simplify result for frontend
        const results = data.destinationEntities ? data.destinationEntities.map(entity => ({
            title: entity.title.replace(/<[^>]*>?/gm, ''), // Strip HTML highlighting
            code: entity.theCode || 'No Code', // Some entities don't have codes (chapters)
            id: entity.id
        })) : [];

        res.json(results);

    } catch (e) {
        console.error('[ICD] Search Error:', e);
        res.status(500).json({ error: 'Search Failed' });
    }
});

module.exports = router;
