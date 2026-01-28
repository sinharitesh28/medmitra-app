const express = require('express');
const router = express.Router();
const db = require('./DB/db');
const { getBotUsername } = require('./bot');

// --- Helper: Create/Update Patient Index ---
async function upsertPatientIndex(data) {
    // data: { ipNo, opdNo, name, age, gender, contact }
    let pid = null;
    
    const [existing] = await db.query(
        "SELECT patient_id FROM master_patient_index WHERE (ip_no = ? AND ip_no IS NOT NULL) OR (opd_no = ? AND opd_no IS NOT NULL)", 
        [data.ipNo, data.opdNo]
    );

    if (existing.length > 0) {
        pid = existing[0].patient_id;
        await db.query(
            "UPDATE master_patient_index SET full_name=?, age=?, gender=?, contact_number=?, ip_no=COALESCE(?, ip_no), opd_no=COALESCE(?, opd_no) WHERE patient_id=?",
            [data.name, data.age, data.gender, data.contact, data.ipNo, data.opdNo, pid]
        );
    } else {
        const [res] = await db.query(
            "INSERT INTO master_patient_index (ip_no, opd_no, full_name, age, gender, contact_number) VALUES (?, ?, ?, ?, ?, ?)",
            [data.ipNo, data.opdNo, data.name, data.age, data.gender, data.contact]
        );
        pid = res.insertId;
    }
    return pid;
}

// --- Routes ---

// 1. Bot Info
router.get('/bot-info', (req, res) => {
    res.json({ username: getBotUsername() });
});

// 2. Check Consent
router.get('/check-consent/:opdNo', async (req, res) => {
    const { opdNo } = req.params;
    console.log(`[Check-Consent] Request received for OPD: ${opdNo}`);
    try {
        const [rows] = await db.query(`
            SELECT e.consent_status 
            FROM medmitra_enrollments e
            JOIN master_patient_index p ON e.patient_id = p.patient_id
            WHERE p.opd_no = ?
        `, [opdNo]);
        
        console.log(`[Check-Consent] Rows found: ${rows.length}`);

        if (rows.length > 0 && rows[0].consent_status) {
            res.json({ consent: true });
        } else {
            res.json({ consent: false });
        }
    } catch (e) {
        console.error(`[Check-Consent] Error for OPD ${opdNo}:`, e);
        res.status(500).json({ error: 'DB Error' });
    }
});

// 3. Register / Enrollment
router.post('/register', async (req, res) => {
    const { opdNo, ipNo, patientName, age, gender, contactNumber, therapies, language } = req.body;
    
    try {
        // Upsert Master Index
        const pid = await upsertPatientIndex({
            ipNo: ipNo || null,
            opdNo: opdNo, // Primary for MedMitra
            name: patientName,
            age: age,
            gender: gender,
            contact: contactNumber
        });

        // Create Enrollment with Language
        await db.query(`
            INSERT INTO medmitra_enrollments (patient_id, language) VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE registered_at = NOW(), language = VALUES(language)`, 
            [pid, language || 'en']
        );

        // Convert Therapies to Reminders (Simplified Logic)
        if (therapies && therapies.length > 0) {
            // First, find the Enrollment ID
            const [enr] = await db.query("SELECT enrollment_id FROM medmitra_enrollments WHERE patient_id = ?", [pid]);
            const eid = enr[0].enrollment_id;

            // Clear old
            await db.query("DELETE FROM medmitra_reminders WHERE enrollment_id = ?", [eid]);

            // Insert new
            const values = therapies.map(t => [
                eid, t.drug, t.dose, JSON.stringify(t.scheduleTimes || [])
            ]);
            
            if (values.length > 0) {
                await db.query("INSERT INTO medmitra_reminders (enrollment_id, drug_name, dose_instruction, schedule_times) VALUES ?", [values]);
            }
        }

        res.json({ success: true, message: 'Enrolled in MedMitra' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Enrollment failed' });
    }
});

// 4. Stats
router.get('/stats', async (req, res) => {
    try {
        const [pats] = await db.query("SELECT COUNT(*) as total, SUM(consent_status) as active FROM medmitra_enrollments");
        const [logs] = await db.query("SELECT response, COUNT(*) as count FROM medmitra_logs GROUP BY response");
        
        // Registrations (Last 7 Days)
        const [regs] = await db.query(`
            SELECT DATE_FORMAT(registered_at, '%Y-%m-%d') as date, COUNT(*) as count 
            FROM medmitra_enrollments 
            WHERE registered_at >= NOW() - INTERVAL 7 DAY 
            GROUP BY date
        `);

        // Recent Reactions
        const [reacts] = await db.query(`
            SELECT l.response_at, p.full_name as patient_name 
            FROM medmitra_logs l 
            JOIN master_patient_index p ON l.patient_id = p.patient_id 
            WHERE l.response = 'REACTION' 
            ORDER BY l.response_at DESC 
            LIMIT 5
        `);

        res.json({
            patients: { total: pats[0].total, active: pats[0].active },
            responses: logs,
            registrations: regs,
            reactions: reacts
        });
    } catch (e) { 
        console.error(e); 
        res.status(500).json({ error: 'Stats error' }); 
    }
});

// 5. Reaction Alerts
router.get('/reaction-alerts', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT l.response_at, p.full_name as patient_name, p.opd_no, p.contact_number 
            FROM medmitra_logs l 
            JOIN master_patient_index p ON l.patient_id = p.patient_id 
            WHERE l.response = 'REACTION' 
            ORDER BY l.response_at DESC
        `);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error fetching alerts' });
    }
});

// 6. Inactive Patients
router.get('/inactive-patients', async (req, res) => {
    try {
        // Patients unresponsive > 24h OR never active, AND missed >= 3 (FORGOT or SENT>24h?)
        // Simplified: Last interaction > 24h ago AND has 'FORGOT' entries >= 3
        const [rows] = await db.query(`
            SELECT 
                p.full_name as patient_name, 
                p.opd_no, 
                p.contact_number, 
                e.last_interaction,
                (SELECT COUNT(*) FROM medmitra_logs l WHERE l.patient_id = p.patient_id AND l.response = 'FORGOT') as missed_count
            FROM medmitra_enrollments e
            JOIN master_patient_index p ON e.patient_id = p.patient_id
            WHERE (e.last_interaction < NOW() - INTERVAL 24 HOUR OR e.last_interaction IS NULL)
            HAVING missed_count >= 3
        `);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error fetching inactive' });
    }
});

// 7. Assigned Reminders (Today's Schedule)
router.get('/assigned-reminders', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                p.full_name as patient_name, 
                p.opd_no, 
                r.drug_name, 
                r.dose_instruction as dose, 
                r.schedule_times
            FROM medmitra_reminders r
            JOIN medmitra_enrollments e ON r.enrollment_id = e.enrollment_id
            JOIN master_patient_index p ON e.patient_id = p.patient_id
        `);

        // Helper to check if a time is today (simplified: all reminders repeat daily)
        // In a real app, schedule_times might have dates. Here it's just HH:MM strings.
        // We'll return ALL daily reminders for "Today's View"
        
        const now = new Date();
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTimeVal = currentHours * 60 + currentMinutes;

        const schedule = [];
        rows.forEach(row => {
            const times = row.schedule_times; // JSON Array of strings "HH:MM"
            if (Array.isArray(times)) {
                times.forEach(timeStr => {
                    const [h, m] = timeStr.split(':').map(Number);
                    const timeVal = h * 60 + m;
                    
                    let status = 'Upcoming';
                    if (timeVal < currentTimeVal) status = 'Past';

                    schedule.push({
                        time: timeStr,
                        patient_name: row.patient_name,
                        opd_no: row.opd_no,
                        drug_name: row.drug_name,
                        dose: row.dose,
                        status: status
                    });
                });
            }
        });

        // Sort by time
        schedule.sort((a, b) => {
            return a.time.localeCompare(b.time);
        });

        res.json(schedule);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

// 8. Logs (Reminders History)
router.get('/logs', async (req, res) => {
    try {
        const [rows] = await db.query(`
            SELECT 
                l.created_at as sent_at,
                l.response_at,
                p.full_name as patient_name,
                p.opd_no,
                l.response
            FROM medmitra_logs l
            JOIN master_patient_index p ON l.patient_id = p.patient_id
            ORDER BY l.created_at DESC
        `);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;