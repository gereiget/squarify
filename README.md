# Squarify

Squarify is a complete Dots and Boxes MVP with:

- `android/`: native Android app in Kotlin + Jetpack Compose
- `frontend/`: React + Vite web app for desktop and mobile browsers
- `backend/`: Node.js + Express multiplayer API in TypeScript
- `docker-compose.yml`: VPS deployment entrypoint for backend and web frontend

Deployment target:

- landing page: `https://games.umalii.com/`
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
  portal/
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

### Docker deployment model

On the VPS:

- `backend` runs in Docker and is published only to `127.0.0.1:${HOST_BACKEND_PORT}`
- `frontend` runs in Docker with Nginx and is published only to `127.0.0.1:${HOST_FRONTEND_PORT}`
- Caddy remains the only public-facing entrypoint
- the root `games.umalii.com` landing page can stay as a static Caddy-served folder

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
HOST_BACKEND_PORT=3010
HOST_FRONTEND_PORT=3011
CORS_ORIGIN=https://games.umalii.com
VITE_API_BASE_URL=https://games.umalii.com/squarify-api/
VITE_APP_BASE_PATH=/squarify/
```

If you need more than one allowed origin, use a comma-separated list:

```env
CORS_ORIGIN=https://games.umalii.com,https://staging.example.com
```

### 3. Start backend and frontend containers

```bash
cd /opt/games-umalii/squarify
docker compose up -d --build
```

Why these ports:

- the backend inside Docker listens on container port `3000`
- Docker publishes that container port to a host port you choose
- for your VPS, use `3010` so it does not conflict with existing services
- the frontend container listens on container port `80`
- Docker publishes that to a host port you choose
- for your VPS, use `3011` so Caddy can reverse proxy to it without colliding with anything else

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

For your VPS with `HOST_BACKEND_PORT=3010`, use:

```bash
curl http://127.0.0.1:3010/health
```

### 5. Verify frontend container before touching Caddy

```bash
cd /opt/games-umalii/squarify
docker compose logs --tail=100 frontend
curl -I http://127.0.0.1:3011/
```

## Landing page deployment for `games.umalii.com`

This repo also includes a static landing page that lists the available games and links to Squarify.

Deploy it with:

```bash
mkdir -p /opt/games-umalii/site/root
rsync -av --delete /opt/games-umalii/squarify/portal/ /opt/games-umalii/site/root/
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
    reverse_proxy 127.0.0.1:3010
}

redir /squarify /squarify/ 308

handle_path /squarify/* {
    reverse_proxy 127.0.0.1:3011
}

handle {
    root * /opt/games-umalii/site/root
    file_server
}
```

Important:

- `handle_path /squarify-api/*` strips `/squarify-api` before proxying
- so `/squarify-api/api/games` reaches the backend as `/api/games`
- `handle_path /squarify/*` strips `/squarify` before proxying to the frontend container
- the final `handle` serves the root `games.umalii.com` landing page

### Validate and reload Caddy

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

## End-to-end checks

After deployment:

```bash
curl https://games.umalii.com/squarify-api/health
curl -I https://games.umalii.com/squarify/
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
