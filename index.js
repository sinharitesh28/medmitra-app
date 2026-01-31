const app = require('./Backend/app');
const { initBot } = require('./Backend/bot');
const { startScheduler } = require('./Backend/scheduler');

const PORT = process.env.PORT || 3000;

process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

async function bootstrap() {
    console.log('[Bootstrap] Initializing services...');
    
    try {
        // Initialize Services
        initBot();
        startScheduler();

        app.listen(PORT, '0.0.0.0', () => {
            console.log(`[App] MedMitra Standalone Server listening on 0.0.0.0:${PORT}`);
            console.log(`[App] Health Check: http://localhost:${PORT}/api/health`);
        });
    } catch (err) {
        console.error('[Bootstrap] Failed to start services:', err);
        process.exit(1);
    }
}

bootstrap();
