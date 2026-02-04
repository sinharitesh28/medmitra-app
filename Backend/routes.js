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
    const { opdNo, ipNo, patientName, age, gender, contactNumber, therapies, language, complaints, diagnoses } = req.body;
    
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
        const [enrRes] = await db.query(`
            INSERT INTO medmitra_enrollments (patient_id, language) VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE registered_at = NOW(), language = VALUES(language)`, 
            [pid, language || 'en']
        );

        // Get Enrollment ID
        const [enr] = await db.query("SELECT enrollment_id FROM medmitra_enrollments WHERE patient_id = ?", [pid]);
        const eid = enr[0].enrollment_id;

        // Ensure Clinical Tables Exist (Self-Healing)
        await db.query(`
            CREATE TABLE IF NOT EXISTS medmitra_complaints (
                complaint_id INT AUTO_INCREMENT PRIMARY KEY,
                enrollment_id INT,
                title VARCHAR(255),
                icd_code VARCHAR(50),
                duration VARCHAR(50),
                FOREIGN KEY (enrollment_id) REFERENCES medmitra_enrollments(enrollment_id) ON DELETE CASCADE
            )
        `);
        await db.query(`
            CREATE TABLE IF NOT EXISTS medmitra_diagnoses (
                diagnosis_id INT AUTO_INCREMENT PRIMARY KEY,
                enrollment_id INT,
                title VARCHAR(255),
                icd_code VARCHAR(50),
                duration VARCHAR(50),
                FOREIGN KEY (enrollment_id) REFERENCES medmitra_enrollments(enrollment_id) ON DELETE CASCADE
            )
        `);

        // 1. Handle Complaints
        if (complaints && Array.isArray(complaints)) {
            await db.query("DELETE FROM medmitra_complaints WHERE enrollment_id = ?", [eid]);
            const cValues = complaints.filter(c => c.title).map(c => [eid, c.title, c.code || null, c.duration || null]);
            if (cValues.length > 0) {
                await db.query("INSERT INTO medmitra_complaints (enrollment_id, title, icd_code, duration) VALUES ?", [cValues]);
            }
        }

        // 2. Handle Diagnoses
        if (diagnoses && Array.isArray(diagnoses)) {
            await db.query("DELETE FROM medmitra_diagnoses WHERE enrollment_id = ?", [eid]);
            const dValues = diagnoses.filter(d => d.title).map(d => [eid, d.title, d.code || null, d.duration || null]);
            if (dValues.length > 0) {
                await db.query("INSERT INTO medmitra_diagnoses (enrollment_id, title, icd_code, duration) VALUES ?", [dValues]);
            }
        }

        // 3. Convert Therapies to Reminders
        if (therapies && therapies.length > 0) {
            // Clear old
            await db.query("DELETE FROM medmitra_reminders WHERE enrollment_id = ?", [eid]);

            // Insert new with end_date
            const values = therapies.map(t => [
                eid, t.drug, t.dose, JSON.stringify(t.scheduleTimes || []), t.endDate || null
            ]);
            
            if (values.length > 0) {
                await db.query("INSERT INTO medmitra_reminders (enrollment_id, drug_name, dose_instruction, schedule_times, end_date) VALUES ?", [values]);
            }
        }

        res.json({ success: true, message: 'Enrolled in MedMitra' });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Enrollment failed' });
    }
});

// --- Patient Detail Profile ---
router.get('/patient-profile/:opdNo', async (req, res) => {
    const { opdNo } = req.params;
    try {
        // 1. Get Base Identity
        const [patients] = await db.query(`
            SELECT p.*, e.enrollment_id, e.registered_at, e.language, e.consent_status, e.last_interaction
            FROM master_patient_index p
            JOIN medmitra_enrollments e ON p.patient_id = e.patient_id
            WHERE p.opd_no = ?
        `, [opdNo]);

        if (patients.length === 0) return res.status(404).json({ error: 'Patient not found' });
        const patient = patients[0];
        const eid = patient.enrollment_id;

        // 2. Get Clinical Info (Complaints & Diagnosis)
        const [complaints] = await db.query("SELECT title, icd_code, duration FROM medmitra_complaints WHERE enrollment_id = ?", [eid]);
        const [diagnoses] = await db.query("SELECT title, icd_code, duration FROM medmitra_diagnoses WHERE enrollment_id = ?", [eid]);

        // 3. Get Therapy Regimen
        const [therapy] = await db.query("SELECT drug_name, dose_instruction, schedule_times, end_date FROM medmitra_reminders WHERE enrollment_id = ?", [eid]);

        // 4. Get Interaction Logs (Last 50)
        const [logs] = await db.query(`
            SELECT created_at as sent_at, response, response_at, message_sent
            FROM medmitra_logs
            WHERE patient_id = ?
            ORDER BY created_at DESC
            LIMIT 50
        `, [patient.patient_id]);

        res.json({
            identity: patient,
            clinical: { complaints, diagnoses },
            therapy: therapy,
            logs: logs
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch patient profile' });
    }
});

// 4. Stats
router.get('/stats', async (req, res) => {
    let { startDate, endDate } = req.query;
    if (!startDate) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
    }
    try {
        const [pats] = await db.query("SELECT COUNT(*) as total, SUM(consent_status) as active FROM medmitra_enrollments");
        
        let logQuery = "SELECT response, COUNT(*) as count FROM medmitra_logs";
        let logParams = [];
        if (startDate && endDate) {
             logQuery += " WHERE created_at BETWEEN ? AND ?";
             logParams.push(startDate + ' 00:00:00', endDate + ' 23:59:59');
        }
        logQuery += " GROUP BY response";
        const [logs] = await db.query(logQuery, logParams);
        
        // Registrations
        let regQuery = `
            SELECT DATE_FORMAT(registered_at, '%Y-%m-%d') as date, COUNT(*) as count 
            FROM medmitra_enrollments 
            WHERE registered_at BETWEEN ? AND ?
            GROUP BY date`;
        const [regs] = await db.query(regQuery, [startDate + ' 00:00:00', endDate + ' 23:59:59']);

        // Recent Reactions
        let reactQuery = `
            SELECT l.response_at, p.full_name as patient_name, p.opd_no
            FROM medmitra_logs l 
            JOIN master_patient_index p ON l.patient_id = p.patient_id 
            WHERE l.response = 'REACTION' AND l.response_at BETWEEN ? AND ?
            ORDER BY l.response_at DESC LIMIT 5
        `;
        const [reacts] = await db.query(reactQuery, [startDate + ' 00:00:00', endDate + ' 23:59:59']);

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
    let { startDate, endDate } = req.query;
    if (!startDate) {
        const d = new Date();
        d.setHours(d.getHours() - 48);
        startDate = d.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
    }
    try {
        let query = `
            SELECT l.response_at, p.full_name as patient_name, p.opd_no, p.contact_number 
            FROM medmitra_logs l 
            JOIN master_patient_index p ON l.patient_id = p.patient_id 
            WHERE l.response = 'REACTION' AND l.response_at BETWEEN ? AND ?
            ORDER BY l.response_at DESC
        `;
        const [rows] = await db.query(query, [startDate + ' 00:00:00', endDate + ' 23:59:59']);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error fetching alerts' });
    }
});

// 6. Inactive Patients
router.get('/inactive-patients', async (req, res) => {
    let { startDate, endDate } = req.query;
    if (!startDate) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
    }
    try {
        let missedSubquery = "SELECT COUNT(*) FROM medmitra_logs l WHERE l.patient_id = p.patient_id AND l.response = 'FORGOT'";
        missedSubquery += " AND l.created_at BETWEEN ? AND ?";

        const [rows] = await db.query(`
            SELECT 
                p.full_name as patient_name, 
                p.opd_no, 
                p.contact_number, 
                e.last_interaction,
                (${missedSubquery}) as missed_count
            FROM medmitra_enrollments e
            JOIN master_patient_index p ON e.patient_id = p.patient_id
            WHERE (e.last_interaction < NOW() - INTERVAL 24 HOUR OR e.last_interaction IS NULL)
            HAVING missed_count >= 3
        `, [startDate + ' 00:00:00', endDate + ' 23:59:59']);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error fetching inactive' });
    }
});

// 7. Assigned Reminders (Treatment Timeline)
router.get('/assigned-reminders', async (req, res) => {
    let { startDate, endDate } = req.query;
    const now = new Date();
    
    // Default: From Today to 7 days ahead
    if (!startDate) {
        startDate = now.toISOString().split('T')[0];
        const d = new Date();
        d.setDate(d.getDate() + 7);
        endDate = d.toISOString().split('T')[0];
    }
    if (!endDate) endDate = startDate;

    try {
        const [rows] = await db.query(`
            SELECT 
                p.full_name as patient_name, 
                p.opd_no, 
                r.drug_name, 
                r.dose_instruction as dose, 
                r.schedule_times,
                r.end_date
            FROM medmitra_reminders r
            JOIN medmitra_enrollments e ON r.enrollment_id = e.enrollment_id
            JOIN master_patient_index p ON e.patient_id = p.patient_id
            WHERE (r.end_date >= ? OR r.end_date IS NULL)
        `, [startDate]);

        const schedule = [];
        const start = new Date(startDate);
        const end = new Date(endDate);

        // Iterate through each day in the range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const isToday = dateStr === now.toISOString().split('T')[0];
            const currentTimeVal = now.getHours() * 60 + now.getMinutes();

            rows.forEach(row => {
                // Skip if medication course ended before this date
                if (row.end_date && new Date(row.end_date) < d) return;

                const times = row.schedule_times;
                if (Array.isArray(times)) {
                    times.forEach(timeStr => {
                        const [h, m] = timeStr.split(':').map(Number);
                        const timeVal = h * 60 + m;
                        
                        let status = 'Upcoming';
                        if (isToday && timeVal < currentTimeVal) status = 'Past';
                        if (d < now && !isToday) status = 'Completed';

                        schedule.push({
                            date: dateStr,
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
        }

        // Sort by date then time
        schedule.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
        res.json(schedule);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch schedule' });
    }
});

// 8. Logs (Reminders History)
router.get('/logs', async (req, res) => {
    let { startDate, endDate } = req.query;
    if (!startDate) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().split('T')[0];
        endDate = new Date().toISOString().split('T')[0];
    }
    try {
        let query = `
            SELECT 
                l.created_at as sent_at,
                l.response_at,
                p.full_name as patient_name,
                p.opd_no,
                l.response,
                l.message_sent
            FROM medmitra_logs l
            JOIN master_patient_index p ON l.patient_id = p.patient_id
            WHERE l.created_at BETWEEN ? AND ?
            ORDER BY l.created_at DESC
        `;
        const [rows] = await db.query(query, [startDate + ' 00:00:00', endDate + ' 23:59:59']);
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;