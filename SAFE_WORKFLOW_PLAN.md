# Safe Experimentation & Deployment Plan

## 1. Current State Risk Analysis
- **Branch:** Currently on `main`.
- **Deployment:** Automatic deployment to GCP occurs immediately upon pushing to `main`.
- **Risk:** Any bug pushed to `main` immediately affects the live production site (`136-116-93-95.sslip.io`).
- **Gap:** No automated testing pipeline exists to verify code before deployment.

## 2. Proposed Workflow

### A. Branching Strategy
1.  **Feature Branches:** All new work happens on temporary branches (e.g., `feature/add-health-check`, `fix/login-bug`).
2.  **Never Push to Main Directly:** `main` is reserved for "known good" code.

### B. Local Verification (The "Safety Net")
Before merging to main, we must verify locally:
1.  **Backend:** Run `node index.js` locally.
    - Requires a local `.env` file (Use a local MySQL/MariaDB or a development database instance, NOT production TiDB if possible).
2.  **Frontend:** Serve `Pages/` using a simple HTTP server (e.g., `npx http-server .`) to test UI changes.
3.  **Automated Testing (New):**
    - We will add a "Health Check" test script.
    - We will install `jest` and `supertest` to automatically verify that the API responds correctly (e.g., `GET /` returns 200).

### C. The "New Code Block" (Health Check)
To fulfill the request of "checking normal functioning," we will implement:
1.  **API Endpoint:** `GET /health` in `index.js`.
    - Returns `{ status: 'ok', uptime: ... }`.
    - Safe to call repeatedly.
2.  **Automated Test:** A script `tests/health.test.js` that calls this endpoint.

### D. Merge & Deploy Sequence
1.  **Switch Branch:** `git checkout -b feature/health-check`
2.  **Implement:** Add `GET /health` and tests.
3.  **Verify:** Run `npm test` (passes locally).
4.  **Commit:** `git commit -m "Add health check endpoint and tests"`
5.  **Merge:**
    - `git checkout main`
    - `git merge feature/health-check`
    - `git push origin main`
6.  **Live Verification:** GitHub Actions deploys the code. We verify `https://136-116-93-95.sslip.io/health`.

## 3. Action Plan
1.  **Stash/Clean:** Handle current untracked files.
2.  **Branch:** Create `feature/health-check`.
3.  **Install:** `npm install --save-dev jest supertest`.
4.  **Code:** Add `/health` route to `Backend/app.js` (or `index.js`).
5.  **Test:** Create `tests/api.test.js`.
6.  **Merge:** Merge to `main` to deploy.
