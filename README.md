# Squarify

Squarify is a complete Dots and Boxes MVP with:

- `android/`: native Android app in Kotlin + Jetpack Compose
- `frontend/`: React + Vite web app for desktop and mobile browsers
- `backend/`: Node.js + Express multiplayer API in TypeScript
- `docker-compose.yml`: VPS backend deployment entrypoint

Deployment target:

- frontend: `https://games.umalii.com/squarify/`
- backend: `https://games.umalii.com/squarify-api/`

## Public repo safety

This repo is prepared for public upload:

- real `.env` files are ignored
- Android machine-local `local.properties` is ignored
- build output and `node_modules` are ignored
- backend CORS is configurable and defaults should be locked down in production
- no credentials or private keys are included in source

Do not commit:

- `.env`
- SSH keys
- Android signing keys / keystore files
- VPS-specific reverse proxy config with secrets if you later add any

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

Frontend env values:

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

## VPS deployment

These instructions assume your VPS already has:

- Docker
- Docker Compose plugin
- Caddy
- an existing `games.umalii.com` site

They avoid installing or replacing those services.

### Folder layout on VPS

Use:

- `/opt/games-umalii/squarify`

### 1. Create the project folder and clone

```bash
cd /opt
mkdir -p games-umalii
cd games-umalii
git clone https://github.com/gereiget/squarify.git
cd squarify
cp .env.example .env
```

### 2. Configure backend env

Edit `/opt/games-umalii/squarify/.env`:

```env
BACKEND_PORT=3000
CORS_ORIGIN=https://games.umalii.com
```

If you need more than one allowed origin, use a comma-separated list:

```env
CORS_ORIGIN=https://games.umalii.com,https://staging.example.com
```

### 3. Start backend container

```bash
cd /opt/games-umalii/squarify
docker compose up -d --build
```

### 4. Verify backend before touching Caddy

```bash
cd /opt/games-umalii/squarify
docker compose ps
docker compose logs --tail=100 backend
curl http://127.0.0.1:3000/health
```

Expected health response:

```json
{"status":"ok","service":"squarify-backend"}
```

## Frontend deployment for `games.umalii.com/squarify/`

### 1. Build the frontend

```bash
cd /opt/games-umalii/squarify/frontend
cp .env.example .env
```

Edit `/opt/games-umalii/squarify/frontend/.env`:

```env
VITE_API_BASE_URL=https://games.umalii.com/squarify-api/
VITE_APP_BASE_PATH=/squarify/
```

Build:

```bash
cd /opt/games-umalii/squarify/frontend
npm install
npm run build
```

### 2. Copy built frontend to a static folder

```bash
sudo mkdir -p /var/www/games-umalii/squarify
sudo rsync -av --delete /opt/games-umalii/squarify/frontend/dist/ /var/www/games-umalii/squarify/
```

## Caddy configuration

You said Caddy is already serving other services. Do not replace the whole config. Add only the needed route blocks inside the existing `games.umalii.com` site block.

Before editing, back up the current config:

```bash
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup-$(date +%F-%H%M%S)
sudo caddy validate --config /etc/caddy/Caddyfile
```

Inside the existing `games.umalii.com` block, add:

```caddy
handle_path /squarify-api/* {
    reverse_proxy 127.0.0.1:3000
}

redir /squarify /squarify/ 308

handle /squarify/* {
    root * /var/www/games-umalii/squarify
    try_files {path} /index.html
    file_server
}
```

Important:

- `handle_path /squarify-api/*` strips `/squarify-api` before proxying
- so `/squarify-api/api/games` reaches the backend as `/api/games`
- `try_files {path} /index.html` keeps the frontend SPA working under `/squarify/`

### Validate and reload Caddy

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## End-to-end checks

After deployment:

```bash
curl https://games.umalii.com/squarify-api/health
```

Then open:

- `https://games.umalii.com/squarify/`

## Android production backend URL

For Android online mode, update:

- `android/app/src/main/java/com/squarify/app/Config.kt`

to:

```kotlin
const val BASE_URL = "https://games.umalii.com/squarify-api/"
```

Then rebuild and reinstall the app.

## Build status

Verified locally:

- `backend`: `npm run build`
- `frontend`: `npm run build`
- `android`: debug build previously verified, Gradle wrapper generated

## Current limitations

- backend storage is in-memory only, so active online games reset on container restart
- online play uses polling every 1.5 seconds instead of WebSockets
- Android debug sounds use generated tones, not bundled audio files
