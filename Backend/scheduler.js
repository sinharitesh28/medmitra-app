const db = require('./DB/db');
const { getBot } = require('./bot');
const locales = require('./locales.json');

function startScheduler() {
    console.log('MedMitra Reminder Scheduler Started...');
    
    // 1. Run Catch-up Logic on Startup
    checkMissedReminders();

    // 2. Check every minute
    setInterval(runScheduleCheck, 60000); 
}

// Separate function for the regular check
async function runScheduleCheck() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    
    const hoursPadded = String(h).padStart(2, '0');
    const minutesPadded = String(m).padStart(2, '0');
    
    const timeStringPadded = `${hoursPadded}:${minutesPadded}`; // "08:05"
    const timeStringSimple = `${h}:${minutesPadded}`;           // "8:05"

    console.log(`[Scheduler] Checking for reminders at ${timeStringPadded} / ${timeStringSimple}...`);

    try {
        const [rows] = await db.query(`
            SELECT 
                e.telegram_chat_id, 
                e.language,
                p.full_name, 
                r.drug_name, 
                r.dose_instruction, 
                r.schedule_times,
                p.patient_id
            FROM medmitra_reminders r
            JOIN medmitra_enrollments e ON r.enrollment_id = e.enrollment_id
            JOIN master_patient_index p ON e.patient_id = p.patient_id
            WHERE e.consent_status = 1
        `);

        for (const row of rows) {
            const times = row.schedule_times; 
            if (Array.isArray(times)) {
                if (times.includes(timeStringPadded) || times.includes(timeStringSimple)) {
                    sendReminder(row, timeStringPadded);
                }
            }
        }

    } catch (e) {
        console.error('[Scheduler] Error:', e);
    }
}

// Catch-up logic for missed reminders (e.g., after downtime)
async function checkMissedReminders() {
    console.log('[Scheduler] Running catch-up check for missed reminders (last 30 mins)...');
    
    const now = new Date();
    // Look back 30 minutes
    for (let i = 1; i <= 30; i++) {
        const past = new Date(now.getTime() - (i * 60000));
        const h = past.getHours();
        const m = past.getMinutes();
        const timeString = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        
        try {
            const [rows] = await db.query(`
                SELECT 
                    e.telegram_chat_id, e.language, p.full_name, 
                    r.drug_name, r.dose_instruction, r.schedule_times, p.patient_id
                FROM medmitra_reminders r
                JOIN medmitra_enrollments e ON r.enrollment_id = e.enrollment_id
                JOIN master_patient_index p ON e.patient_id = p.patient_id
                WHERE e.consent_status = 1
            `);

            for (const row of rows) {
                const times = row.schedule_times;
                // If this reminder was scheduled for this past minute
                if (Array.isArray(times) && (times.includes(timeString) || times.includes(`${h}:${String(m).padStart(2, '0')}`))) {
                    
                    // Check if we ALREADY sent it recently (deduplication)
                    const [logs] = await db.query(`
                        SELECT log_id FROM medmitra_logs 
                        WHERE patient_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL 45 MINUTE)
                        AND message_sent LIKE CONCAT('%', ?, '%')
                    `, [row.patient_id, row.drug_name]);

                    if (logs.length === 0) {
                        console.log(`[Scheduler] Found MISSED reminder for ${row.full_name} at ${timeString}`);
                        sendReminder(row, timeString);
                    }
                }
            }
        } catch (e) {
            console.error('[Scheduler] Catch-up Error:', e);
        }
    }
}

async function sendReminder(data, time) {
    const bot = getBot();
    
    // Localization Logic
    const lang = data.language || 'en';
    const texts = locales[lang] || locales['en'] || locales['default'];

    const message = texts.template
        .replace('{name}', data.full_name)
        .replace('{drug}', data.drug_name)
        .replace('{dose}', data.dose_instruction);

    console.log(`[Scheduler] Sending reminder to ${data.full_name} (${data.telegram_chat_id}) for ${data.drug_name} in ${lang}`);

    // Log the attempt
    const [logRes] = await db.query("INSERT INTO medmitra_logs (patient_id, message_sent, response) VALUES (?, ?, ?)", 
        [data.patient_id, message, 'Sent']);
    const logId = logRes.insertId;

    if (bot && data.telegram_chat_id !== 'demo_chat_id') {
        try {
            const opts = {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: texts.taken, callback_data: `TAKEN_${logId}` },
                            { text: texts.forgot, callback_data: `FORGOT_${logId}` }
                        ],
                        [
                            { text: texts.reaction, callback_data: `REACTION_${logId}` }
                        ]
                    ]
                }
            };
            const sentMsg = await bot.sendMessage(data.telegram_chat_id, message, opts);
            
            // Update Log with Message ID
            await db.query("UPDATE medmitra_logs SET telegram_message_id = ? WHERE log_id = ?", 
                [sentMsg.message_id, logId]);

            console.log(`[Scheduler] Message sent to Telegram chat ${data.telegram_chat_id}`);
        } catch (err) {
            console.error(`[Scheduler] Failed to send Telegram message:`, err.message);
            await db.query("UPDATE medmitra_logs SET response = 'Failed' WHERE log_id = ?", [logId]);
        }
    } else {
        console.warn(`[Scheduler] Skipped sending to ${data.telegram_chat_id} (No bot or demo ID)`);
    }
}

module.exports = { startScheduler };
