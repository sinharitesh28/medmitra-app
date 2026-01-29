# MedMitra SSL Activation Guide

Copy and paste the block below into your **GCP SSH Terminal** to fix the "Mixed Content" error and enable HTTPS.

### Block: Fix Port Conflict & Enable HTTPS
```bash
sudo docker stop medmitra_app && \
sudo docker rm medmitra_app && \
sudo docker run -d --name medmitra_app --restart always --env-file ~/medmitra-app/.env -p 3000:3000 medmitra-img && \
sudo systemctl restart nginx && \
sudo certbot --nginx -d 136-116-93-95.sslip.io --non-interactive --agree-tos -m rityasinha@gmail.com
```

---

### Verification
1. Once finished, check this link: **https://136-116-93-95.sslip.io/api/medmitra/bot-info**
2. It should show a **Lock Icon** 🔒 in your browser address bar.
3. Your GitHub Pages site will then work perfectly without errors!