const express = require('express');
const router = express.Router();
let formulary = [];

try {
    const rawFormulary = require('../formulary.json');
    // Map the raw JSON (item_name) to the structure expected by the app (drug_name, brand_name)
    formulary = rawFormulary.map(item => ({
        drug_name: item.item_name || 'Unknown',
        brand_name: '', // The JSON doesn't seem to separate brand/generic, so we default to empty
        rxcui: item.rxnorm_code
    }));
    console.log(`[RxNorm] Formulary loaded: ${formulary.length} items.`);
} catch (e) {
    console.error('[RxNorm] CRITICAL: Failed to load formulary.json from root.', e);
    formulary = [];
}

// 1. Get Local Formulary
router.get('/formulary', (req, res) => {
    const term = req.query.q ? req.query.q.toLowerCase() : '';
    if (!term) return res.json([]);

    try {
        const results = formulary.filter(d => 
            (d.drug_name && d.drug_name.toLowerCase().includes(term)) || 
            (d.brand_name && d.brand_name.toLowerCase().includes(term))
        );
        res.json(results.slice(0, 50)); // Limit results
    } catch (err) {
        console.error('[RxNorm] Search Error:', err);
        res.json([]); // Return empty on error instead of crashing
    }
});

// 2. Search RxNorm (Global)
router.get('/search', async (req, res) => {
    const term = req.query.q;
    if (!term) return res.json([]);

    try {
        const response = await fetch(`https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(term)}&maxEntries=10`);
        const data = await response.json();
        
        let results = [];
        if (data.approximateGroup && data.approximateGroup.candidate) {
            results = data.approximateGroup.candidate.map(c => ({
                drug_name: c.rxcui ? c.rxcui : c.score, // Just debug
                drug_name: c.candidate || term, // The name isn't always clear in approx search, usually 'candidate' is removed in newer API
                // Better mapping below
                name: c.rxcui, 
                rxcui: c.rxcui,
                score: c.score
            }));
            
            // Correction: approximateTerm returns candidates. 
            // We want 'display name'. RxNorm is complex. 
            // Let's use 'spelling suggestions' or 'prescribable' endpoint if possible.
            // But approximateTerm is standard for user input.
        }
        
        // Let's forward the raw list and handle UI mapping or simplify here
        // Actually, let's use a simpler structure:
        // RxNorm's "Drugs" endpoint is better: https://rxnav.nlm.nih.gov/REST/drugs.json?name=...
        
        const response2 = await fetch(`https://rxnav.nlm.nih.gov/REST/drugs.json?name=${encodeURIComponent(term)}`);
        const data2 = await response2.json();
        
        let apiResults = [];
        if (data2.drugGroup && data2.drugGroup.conceptGroup) {
            data2.drugGroup.conceptGroup.forEach(group => {
                if (group.conceptProperties) {
                    group.conceptProperties.forEach(prop => {
                        apiResults.push({
                            drug_name: prop.name,
                            rxcui: prop.rxcui,
                            type: 'Global (RxNorm)'
                        });
                    });
                }
            });
        }
        
        res.json(apiResults.slice(0, 10)); // Limit to 10
    } catch (e) {
        console.error('RxNorm Error:', e);
        res.status(500).json({ error: 'External API Error' });
    }
});

// 3. Get Details (Doses)
router.get('/details/:rxcui', async (req, res) => {
    const { rxcui } = req.params;
    
    // Check Formulary first
    const local = formulary.find(d => d.rxcui === rxcui);
    if (local) {
        return res.json({ available_doses: local.available_doses });
    }

    try {
        // Fetch from RxNorm - Get related strength terms
        // We use 'getAllProperties' or simply check the term name if it contains strength.
        // Better: https://rxnav.nlm.nih.gov/REST/rxcui/{rxcui}/related?tty=SCDF+SBDF
        // SCDF: Semantic Clinical Drug Form (contains strength)
        
        // This is complex for a simple demo.
        // Simplified approach: Just return empty or fetch properties
        // A better UX hack: Don't block. Let user type.
        
        res.json({ available_doses: [] }); // Fallback for now to avoid complex parsing logic
    } catch (e) {
        res.json({ available_doses: [] });
    }
});

module.exports = router;
