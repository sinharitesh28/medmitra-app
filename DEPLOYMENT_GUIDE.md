# MedMitra CORS & HTTPS Fix Guide

Copy and paste the block below into your **GCP SSH Terminal** to fix the "CORS Policy" error blocking your login.

### Block: Final CORS & Nginx Fix
> **Note:** This configuration is now automatically applied by the deployment workflow (`deploy.yml`) using `nginx/medmitra_site.conf`. You do not need to run this manually unless setting up a new server.

```bash
sudo tee /etc/nginx/sites-available/medmitra << 'EOF'
server {
    listen 80;
    server_name 136-116-93-95.sslip.io;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name 136-116-93-95.sslip.io;

    ssl_certificate /etc/letsencrypt/live/136-116-93-95.sslip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/136-116-93-95.sslip.io/privkey.pem;

    location / {
        # Proxy to Node.js App (Let the App handle CORS)
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo nginx -t && sudo systemctl restart nginx
```

---

### Verification
1. Refresh your GitHub site: **https://sinharitesh28.github.io/medmitra-app/**
2. Try sending an OTP. It should now proceed without the CORS error!
