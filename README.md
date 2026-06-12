# Squarify

Squarify is a complete Dots and Boxes MVP with:

- `android/`: native Android app in Kotlin + Jetpack Compose
- `frontend/`: React + Vite web app for desktop and mobile browsers
- `backend/`: Node.js + Express multiplayer API in TypeScript
- `docker-compose.yml`: VPS backend deployment entrypoint

The web app is configured to be deployable under:

- `https://games.umalii.com/squarify/`

## Public repo safety

This repo is prepared for public upload:

- real `.env` files are ignored
- Android machine-local `local.properties` is ignored
- build output and `node_modules` are ignored
- backend CORS is configurable and defaults should be locked down in production
- no credentials or private keys are included in source

Before pushing, keep these rules:

- never commit `.env`
- never commit VPS SSH keys
- never commit Android signing keys or `keystore` files
- never change `CORS_ORIGIN` to `*` in production unless you intentionally want a public API

## Project structure

```text
squarify/
  android/
  backend/
  frontend/
  docker-compose.yml
  .env.example
  README.md
```

## Backend API

- `GET /health`
- `POST /api/games`
- `POST /api/games/join`
- `GET /api/games/:gameId`
- `POST /api/games/:gameId/move`
- `POST /api/games/:gameId/restart`
- `DELETE /api/games/:gameId`

The backend enforces:

- valid board sizes: `3`, `4`, `5`
- turn order
- duplicate move rejection
- out-of-bounds move rejection
- bonus turns when a player closes a box
- winner calculation when the board is full

## Local development

### Backend

```powershell
Copy-Item .env.example .env
cd backend
npm install
npm run dev
```

Health check:

```powershell
curl http://localhost:3000/health
```

### Web frontend

```powershell
cd frontend
npm install
Copy-Item .env.example .env
npm run dev
```

Important frontend env values:

- `VITE_API_BASE_URL=http://localhost:3000/`
- `VITE_APP_BASE_PATH=/squarify/`

Production build:

```powershell
cd frontend
npm run build
```

### Android

Open `android/` in Android Studio, or use:

```powershell
cd android
.\gradlew.bat assembleDebug
```

Backend URL for Android is defined in `android/app/src/main/java/com/squarify/app/Config.kt`.

## Production backend deployment on VPS

These steps assume Ubuntu and Docker deployment for the backend only.

### 1. Install Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin nginx
sudo usermod -aG docker $USER
```

Log out and back in after `usermod`.

### 2. Download the repo on the VPS

```bash
git clone https://github.com/gereiget/squarify.git
cd squarify
cp .env.example .env
```

### 3. Configure the backend environment

Edit `.env`:

```env
BACKEND_PORT=3000
CORS_ORIGIN=https://games.umalii.com
```

If you will also serve the frontend from additional origins during testing, use a comma-separated allowlist:

```env
CORS_ORIGIN=https://games.umalii.com,https://staging.games.umalii.com
```

### 4. Start the backend container

```bash
docker compose up -d --build
```

### 5. Verify backend health

```bash
docker compose ps
docker compose logs -f backend
curl http://127.0.0.1:3000/health
```

## Web frontend deployment for `games.umalii.com/squarify`

The frontend is static. Build it locally or on the VPS:

```bash
cd frontend
cp .env.example .env
```

Edit `frontend/.env`:

```env
VITE_API_BASE_URL=https://api.games.umalii.com/
VITE_APP_BASE_PATH=/squarify/
```

Then build:

```bash
npm install
npm run build
```

Copy the generated `frontend/dist` contents to a web root such as:

- `/var/www/squarify`

Example:

```bash
sudo mkdir -p /var/www/squarify
sudo cp -r dist/* /var/www/squarify/
```

## Suggested Nginx setup

Recommended split:

- frontend: `https://games.umalii.com/squarify/`
- backend: `https://api.games.umalii.com/`

Example backend Nginx config:

```nginx
server {
    listen 80;
    server_name api.games.umalii.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Example frontend Nginx config:

```nginx
server {
    listen 80;
    server_name games.umalii.com;

    location = /squarify {
        return 301 /squarify/;
    }

    location /squarify/ {
        alias /var/www/squarify/;
        try_files $uri $uri/ /squarify/index.html;
    }
}
```

Enable and test:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## HTTPS

After DNS is pointed correctly:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d games.umalii.com -d api.games.umalii.com
```

## Build status

Verified locally:

- `backend`: `npm run build`
- `frontend`: `npm run build`
- `android`: debug build previously verified, Gradle wrapper generated

## Current limitations

- backend storage is in-memory only, so active online games reset on container restart
- online play uses polling every 1.5 seconds instead of WebSockets
- Android debug sounds use generated tones, not bundled audio files
