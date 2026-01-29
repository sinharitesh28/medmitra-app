// Global Configuration
const CONFIG = {
    // Determine API Base URL based on where the app is running
    API_BASE_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000' 
        : 'https://136-116-93-95.sslip.io'  // SECURE SSL URL
};

console.log('MedMitra Config Loaded (Secure):', CONFIG);
