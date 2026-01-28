const fs = require('fs');
const pdf = require('pdf-parse');

const existingFormularyPath = 'formulary.json';
const emergencyPdfPath = 'EMERGENCY DRUGS (01.02.2025).pdf';
const highRiskPdfPath = 'HIGH RISK, LASA list (01.02.2025).pdf';

// Load existing formulary
let formulary = [];
if (fs.existsSync(existingFormularyPath)) {
    formulary = JSON.parse(fs.readFileSync(existingFormularyPath));
}

// Find max SNO to continue numbering if needed, though usually we might want to keep original SNOs or re-number.
// The user request implies adding to formulary.json. The formulary.json has SNOs.
// The new files might have their own SNOs.
// For "EMERGENCY DRUGS", it looks like a list of strings, not a table with SNOs in the image.
// For "HIGH RISK", there are tables with SNOs.
// I will try to parse structure and map to { sno, item_group, item_name, rxnorm_code: null }
// "item_group" might be derived from the file name or section header.

async function parseEmergencyDrugs() {
    const dataBuffer = fs.readFileSync(emergencyPdfPath);
    const data = await pdf(dataBuffer);
    const text = data.text;
    const lines = text.split('\n');
    
    const newRecords = [];
    let currentGroup = 'EMERGENCY MEDICINE';
    
    // The emergency PDF seems to have 3 columns of drugs. 
    // "INJ.Adrenalin", "INJ.METOPROLOL", "INJ.ANTI-D"
    // The extraction usually serializes columns into lines or just text.
    // Let's assume the text extraction gives us line by line. 
    
    // We will look for lines that look like drug names.
    // Many start with "INJ." or are capitalized names.
    // We can filter out headers.
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        if (line.includes('Parul') || line.includes('Sevashram') || line.includes('EMERGENCY MEDICINE') || line.includes('PREPARED BY') || line.includes('Page')) continue;
        
        // In the image, it looks like a grid. pdf-parse might output them interleaved or sequential.
        // We will treat every non-ignored line as a potential drug.
        // To be safe, we can check if it looks like a drug (has reasonable length, maybe starts with INJ or TAB or just text).
        
        // Heuristic: split by multiple spaces to handle columns if they are on same line
        const parts = line.split(/\s{2,}/);
        
        for (let part of parts) {
            part = part.trim();
            if (part && part.length > 2 && !part.match(/^(PREPARED|APPROVED|CIRCULATED|Mr|Dr|Ms)\b/i)) {
                 newRecords.push({
                    sno: null, // No SNO in this file usually
                    item_group: 'EMERGENCY',
                    item_name: part,
                    rxnorm_code: null
                });
            }
        }
    }
    return newRecords;
}

async function parseHighRiskDrugs() {
    const dataBuffer = fs.readFileSync(highRiskPdfPath);
    const data = await pdf(dataBuffer);
    const text = data.text;
    const lines = text.split('\n');
    
    const newRecords = [];
    let currentGroup = 'HIGH RISK';
    let section = 'HIGH RISK'; // Default
    
    // This file has multiple sections: "HIGH RISK MEDICINE", "LIST OF LOOK A LIKE MEDICINES", "LIST OF SOUND A LIKE MEDICINES", "NARCOTIC DRUGS"
    
    for (let line of lines) {
        line = line.trim();
        if (!line) continue;
        
        if (line.includes('HIGH RISK MEDICINE')) { section = 'HIGH RISK'; continue; }
        if (line.includes('LOOK A LIKE MEDICINES')) { section = 'LASA - LOOK ALIKE'; continue; }
        if (line.includes('SOUND A LIKE MEDICINES')) { section = 'LASA - SOUND ALIKE'; continue; }
        if (line.includes('NARCOTIC DRUGS')) { section = 'NARCOTIC'; continue; }
        
        // Ignore headers/footers
        if (line.match(/(Parul|Sevashram|Affiliated|PREPARED|APPROVED|CIRCULATED|PRODUCT|PRODUT|SR NO|TABLETS|INJECTIONS)/i)) continue;

        // Try to match SNO pattern
        // The High Risk table has columns: SNO, TABLETS, INJECTIONS, CHEMOTHERAPEUTIC...
        // Extraction might result in lines like "1 ALPRAX ... INJ. AMINOPHYLLINE"
        // OR interleaved.
        
        // We will try to extract anything that looks like a drug name. 
        // If line starts with a number, strip it.
        
        // Remove leading numbers
        let cleanLine = line.replace(/^\d+\s+/, '');
        
        // Split by multiple spaces to handle columns
        const parts = cleanLine.split(/\s{2,}/);
        
        for (let part of parts) {
            part = part.trim();
            // Filter out obvious noise
            if (part.length < 2) continue;
            if (part.match(/^(Mr|Dr|Ms)\s+/)) continue;
            
            newRecords.push({
                sno: null,
                item_group: section,
                item_name: part,
                rxnorm_code: null
            });
        }
    }
    return newRecords;
}

async function main() {
    console.log('Parsing Emergency Drugs...');
    const emergencyDrugs = await parseEmergencyDrugs();
    console.log(`Found ${emergencyDrugs.length} emergency drugs.`);
    
    console.log('Parsing High Risk / LASA Drugs...');
    const highRiskDrugs = await parseHighRiskDrugs();
    console.log(`Found ${highRiskDrugs.length} high risk/LASA drugs.`);
    
    const allNew = [...emergencyDrugs, ...highRiskDrugs];
    
    // Append to formulary
    // We can assign new SNOs starting from max existing SNO + 1
    let maxSno = 0;
    formulary.forEach(r => {
        if (r.sno && r.sno > maxSno) maxSno = r.sno;
    });
    
    let addedCount = 0;
    for (const rec of allNew) {
        // Check for duplicates? The user didn't explicitly ask to dedup, but it's good practice.
        // However, these are distinct lists (Emergency, High Risk). A drug can be in Formulary AND Emergency.
        // I will add them as new entries with their specific groups so they are searchable by that group.
        
        maxSno++;
        rec.sno = maxSno;
        formulary.push(rec);
        addedCount++;
    }
    
    fs.writeFileSync(existingFormularyPath, JSON.stringify(formulary, null, 2));
    console.log(`Added ${addedCount} new records to formulary.json.`);
}

main();
