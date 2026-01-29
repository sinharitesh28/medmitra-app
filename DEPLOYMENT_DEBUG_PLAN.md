# Deployment Troubleshooting & Optimization Plan

## 1. Audit Findings
- **Workflow:** Uses `appleboy/scp-action` to copy code and `appleboy/ssh-action` to build on server.
- **Server Load:** The GCP instance bears the burden of `npm install` and `docker build`.
- **Symptoms:** Timeout (despite 30m limit) or "Process exited with code 1".
- **Risks:** High probability of **Out Of Memory (OOM)** kills during build or **Disk Full** due to old image retention.

## 2. Analysis
The current "Build on Server" strategy is fragile for small cloud instances. 
- **CPU/RAM:** Compiling node modules requires spikes of RAM that often exceed 1GB (common tier limit).
- **Network:** SCP copying thousands of small files (if `node_modules` were included, though we excluded them) is slow.
- **Disk:** Docker caches layers. Without pruning, disk fills up, causing write errors.

## 3. Resolution Plan

### Option A: Cleanup & Optimization (The "Right Now" Fix)
Modify `deploy.yml` to:
1.  **Prune System:** Run `docker system prune -af` before building.
2.  **Swap Space:** Ensure the server has a swap file (if RAM is low).
3.  **Debug:** Print resource usage (`free -m`, `df -h`) to logs.

### Option B: Build on GitHub (The "Best Practice" Fix)
Refactor `deploy.yml` to:
1.  **Build:** Create the Docker image on the GitHub Runner.
2.  **Push:** Push image to **GitHub Container Registry (ghcr.io)**.
3.  **Deploy:** SSH into GCP and just `docker pull` & `docker run`.
    *   *Pros:* Zero load on server, faster deploy, atomic updates.
    *   *Cons:* Requires one-time setup of GHCR credentials (which are free/included in GitHub Actions).

## 4. Recommendation
**Proceed with Option A** immediately to unblock the current deployment. If failures persist, implement **Option B**.
