# MedMitra - Patient Engagement Module

This is the standalone MedMitra application, extracted from the CliniPraxis suite.

## Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Configuration:**
    *   Copy `.env.example` to `.env`.
    *   Update the configuration values (Database credentials, Telegram Bot Token).
    ```bash
    cp .env.example .env
    ```

3.  **Database:**
    *   Ensure your MySQL database is running and accessible.
    *   The application assumes the `master_patient_index` and MedMitra-related tables exist.

## Running the Application

```bash
npm start
```

The server will start on port 3000 (or as defined in `.env`).
Access the application at: `http://localhost:3000/medmitra/registration.html`
