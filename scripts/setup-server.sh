#!/bin/bash
# One-time server setup for MangoTalk on Ubuntu 22.04 (DigitalOcean)
# Run as root: bash setup-server.sh

set -e

echo "=== MangoTalk Server Setup ==="

# 1. System update
apt update && apt upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 3. Install pnpm
npm install -g pnpm

# 4. Install PM2
npm install -g pm2

# 5. Install nginx
apt install -y nginx
systemctl enable nginx

# 6. Install MySQL 8
apt install -y mysql-server
systemctl enable mysql

# 7. Install Redis
apt install -y redis-server
systemctl enable redis-server

# 8. Install certbot (SSL)
apt install -y certbot python3-certbot-nginx

# 9. Create log directory
mkdir -p /var/log/mangotalk

# 10. Clone project
mkdir -p /opt/mangotalk
cd /opt/mangotalk
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git .

# 11. Set up MySQL database
echo "Setting up MySQL..."
read -sp "Enter a password for the mangotalk DB user: " DB_PASS
echo
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS mangotalk CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'mangotalk'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON mangotalk.* TO 'mangotalk'@'localhost';
FLUSH PRIVILEGES;
SQL

# 12. Create backend .env
cat > /opt/mangotalk/apps/api/.env <<EOF
NODE_ENV=production
PORT=3000

DATABASE_URL=mysql://mangotalk:${DB_PASS}@localhost:3306/mangotalk
REDIS_URL=redis://localhost:6379

JWT_SECRET=$(openssl rand -base64 48)
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d

FRONTEND_URL=https://YOUR_DOMAIN

STUN_SERVER_URL=stun:stun.l.google.com:19302
TURN_SERVER_URL=
TURN_USERNAME=
TURN_CREDENTIAL=
EOF

# 13. Create frontend .env (needed at build time)
cat > /opt/mangotalk/apps/web/.env <<EOF
VITE_API_URL=https://YOUR_DOMAIN
VITE_SOCKET_URL=https://YOUR_DOMAIN
VITE_STUN_URL=stun:stun.l.google.com:19302
EOF

# 14. Install dependencies and build
cd /opt/mangotalk
pnpm install --frozen-lockfile
pnpm --filter @mangotalk/types build
pnpm --filter @mangotalk/api build
pnpm --filter @mangotalk/web build

# 15. Run DB migrations and seed
cd apps/api
npx prisma migrate deploy
npx prisma db seed
cd /opt/mangotalk

# 16. Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

# 17. Configure nginx
cp nginx.prod.conf /etc/nginx/sites-available/mangotalk
ln -sf /etc/nginx/sites-available/mangotalk /etc/nginx/sites-enabled/mangotalk
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Setup complete! ==="
echo ""
echo "Next steps:"
echo "1. Point your domain DNS A record to this server's IP"
echo "2. Replace YOUR_DOMAIN in /etc/nginx/sites-available/mangotalk"
echo "3. Run: certbot --nginx -d YOUR_DOMAIN"
echo "4. Add GitHub Secrets: SERVER_HOST, SERVER_USER, SERVER_SSH_KEY"
echo "5. Push to main branch to trigger auto-deploy"
