const db = require('../Backend/DB/db');

async function updateSchema() {
    try {
        console.log('Updating schema...');

        // 1. Add telegram_message_id to medmitra_logs
        try {
            await db.query("ALTER TABLE medmitra_logs ADD COLUMN telegram_message_id VARCHAR(50)");
            console.log('Added telegram_message_id to medmitra_logs');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('telegram_message_id already exists in medmitra_logs');
            } else {
                console.error('Error adding telegram_message_id:', e.message);
            }
        }

        // 2. Add last_interaction to medmitra_enrollments
        try {
            await db.query("ALTER TABLE medmitra_enrollments ADD COLUMN last_interaction TIMESTAMP DEFAULT NULL");
            console.log('Added last_interaction to medmitra_enrollments');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('last_interaction already exists in medmitra_enrollments');
            } else {
                console.error('Error adding last_interaction:', e.message);
            }
        }

        // 3. Add response_at to medmitra_logs
        try {
            await db.query("ALTER TABLE medmitra_logs ADD COLUMN response_at TIMESTAMP DEFAULT NULL");
            console.log('Added response_at to medmitra_logs');
        } catch (e) {
            if (e.code === 'ER_DUP_FIELDNAME') {
                console.log('response_at already exists in medmitra_logs');
            } else {
                console.error('Error adding response_at:', e.message);
            }
        }

        console.log('Schema update complete.');
        process.exit(0);
    } catch (e) {
        console.error('Fatal error updating schema:', e);
        process.exit(1);
    }
}

updateSchema();
