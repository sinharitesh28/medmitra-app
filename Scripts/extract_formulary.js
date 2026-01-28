const fs = require('fs');
const pdf = require('pdf-parse');

const pdfPath = 'DRUG FORMULARY (01.02.2025) - version 4.pdf';
const dataBuffer = fs.readFileSync(pdfPath);

const KNOWN_GROUPS = [
    'AYURVED DRUGS',
    'Cap',
    'CREAM',
    'CSSD', // Saw "COTTON ROLL" under CSSD
    'DROP',
    'GEN',
    'inh',
    'INJ.',
    'INJ', // Sometimes might be without dot
    'instrument', // "INSTRUMENT"
    'LAB',
    'liqud', // Saw "liqud" in image 1248
    'Lotion',
    'MEDICAL EQUIPMENT', // 1332
    'OINT',
    'PASTE',
    'PATCH',
    'POWDER',
    'RESPULES',
    'sachet',
    'SOAP',
    'SOLUTION',
    'Spray',
    'suppository',
    'SURGICAL',
    'SUTURE',
    'syrup',
    'Tablets',
    'TAB', // just in case
    'Consumable Items' // Last page table header?
];

// Helper to normalize strings
const normalize = (str) => str.replace(/\s+/g, ' ').trim();

pdf(dataBuffer).then(function(data) {
    const text = data.text;
    const lines = text.split('\n');
    const records = [];

    // Regex to try and capture: SNO  GROUP   NAME
    // SNO is digits.
    // GROUP is one of the known groups (mostly).
    // NAME is the rest.
    
    // We will try to match lines that start with a number
    const lineRegex = /^\s*(\d+)\s+(.+)$/;
    
    let isConsumableSection = false;

    for (let line of lines) {
        line = normalize(line);
        
        if (line.includes('SN Consumable Items')) {
            isConsumableSection = true;
            continue;
        }

        const match = line.match(lineRegex);
        
        if (match) {
            const sno = parseInt(match[1]);
            const rest = match[2];
            
            if (isConsumableSection) {
                 records.push({
                    sno: sno,
                    item_group: 'Consumable',
                    item_name: rest,
                    rxnorm_code: null
                });
                continue;
            }
            
            // Heuristic to split Group and Name
            // We look for the known group at the start of 'rest'
            // Since groups can be "AYURVED DRUGS", we need to check matches
            
            let bestGroup = null;
            let itemName = rest;
            
            // Sort groups by length descending to match longest first
            const sortedGroups = KNOWN_GROUPS.sort((a, b) => b.length - a.length);
            
            for (const group of sortedGroups) {
                // Check if 'rest' starts with this group (case insensitive?) 
                // We handle extra spaces in regex between words in group name
                const groupPattern = group.replace(/\s+/g, '\\s+');
                const groupRegex = new RegExp(`^${groupPattern}\\s+`, 'i');
                
                if (groupRegex.test(rest)) {
                    bestGroup = group; 
                    // Remove group from rest to get item name
                    itemName = rest.replace(groupRegex, '').trim();
                    break; 
                }
                
                // Also handle cases where there might not be a space if OCR is bad
                if (group === 'INJ.' && rest.toUpperCase().startsWith('INJ ')) {
                     bestGroup = 'INJ.';
                     itemName = rest.substring(3).trim();
                     break;
                }
            }
            
            // If we didn't find a known group, we might have a parsing issue 
            // OR the line is just "SNO NAME" (unlikely based on table)
            // OR the group is new.
            // For now, if no group found, we put "UNKNOWN" or try to guess.
            // Looking at the PDF, the columns are quite distinct.
            
            if (bestGroup) {
                 records.push({
                    sno: sno,
                    item_group: bestGroup,
                    item_name: itemName,
                    rxnorm_code: null
                });
            } else {
                // Fallback: assume the first word is the group if it looks like one, 
                // or log it.
                // Let's assume the first word is the group.
                const firstSpace = rest.indexOf(' ');
                if (firstSpace > 0) {
                     const possibleGroup = rest.substring(0, firstSpace);
                     const possibleName = rest.substring(firstSpace).trim();
                     records.push({
                        sno: sno,
                        item_group: possibleGroup, // dynamic group
                        item_name: possibleName,
                        rxnorm_code: null
                    });
                }
            }
        }
    }
    
    // Sort by SNO just in case
    records.sort((a, b) => a.sno - b.sno);

    console.log(`Extracted ${records.length} records.`);
    
    fs.writeFileSync('formulary.json', JSON.stringify(records, null, 2));
});
