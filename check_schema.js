const db = require('./Backend/DB/db');
async function checkSchema() {
    try {
        console.log('Checking medmitra_enrollments schema...');
        const [rows] = await db.query("DESCRIBE medmitra_enrollments");
        console.table(rows);
        process.exit(0);
    } catch (e) {
        console.error('Schema check failed:', e);
        process.exit(1);
    }
}
checkSchema();
