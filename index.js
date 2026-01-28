const app = require('./Backend/app');
const { initBot } = require('./Backend/bot');
const { startScheduler } = require('./Backend/scheduler');

const PORT = process.env.PORT || 3000;

// Initialize Services
initBot();
startScheduler();

app.listen(PORT, () => {
    console.log(`MedMitra Standalone Server running on port ${PORT}`);
    console.log(`Access at http://localhost:${PORT}/medmitra/registration.html`);
});