# Braindump Sync Service — Zima Deployment

Self-hosted sync backend for Braindump. Runs as two Docker containers:
**sync-service** (Fastify + Node.js) and **postgres** (PostgreSQL 16).

---

## Prerequisites

- Docker + Docker Compose v2 on your Zima server
- A reverse proxy with a `zima-internal` Docker network (Traefik, Nginx Proxy Manager, etc.)
- A domain pointed at your Zima (for Google OAuth callback + HTTPS)
- Google OAuth 2.0 credentials

### Create the shared Docker network (once per Zima)

```sh
docker network create zima-internal
```

### Create Google OAuth credentials

1. Go to [Google Cloud Console → APIs & Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add an authorised redirect URI: `https://<your-domain>/auth/google/callback`
4. Copy the Client ID and Client Secret

---

## Deploy

### 1. Copy the docker folder to your Zima

```sh
scp -r docker/sync-service user@zima:/opt/braindump
```

Or clone the repo directly on the server.

### 2. Create the .env file

```sh
cd /opt/braindump
cp .env.example .env
nano .env          # fill in all values
```

Minimum required values:

| Variable | Description |
|---|---|
| `POSTGRES_PASSWORD` | Strong password for the database |
| `JWT_SECRET` | Random secret (`openssl rand -base64 32`) |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | `https://<your-domain>/auth/google/callback` |
| `ALLOWED_ORIGIN` | `https://<your-domain>` |

### 3. Build and start

```sh
docker compose up -d --build
```

The first start will:
1. Build the image (compiles TypeScript, generates and bundles migration SQL)
2. Start Postgres and wait for it to be healthy
3. Run database migrations automatically
4. Start the API server on port 3001

### 4. Configure your reverse proxy

Point `https://<your-domain>` to `sync-service:3001` on the `zima-internal` network.

**Traefik label example** (add under `sync-service` in docker-compose.yml):
```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.braindump.rule=Host(`your-domain.com`)"
  - "traefik.http.routers.braindump.entrypoints=websecure"
  - "traefik.http.routers.braindump.tls.certresolver=letsencrypt"
  - "traefik.http.services.braindump.loadbalancer.server.port=3001"
```

### 5. Point the web app at the server

In the Braindump web app Settings → Sync, enter your server URL:
```
https://your-domain.com
```

---

## Operations

```sh
# View logs
docker compose logs -f sync-service

# Restart after config change
docker compose restart sync-service

# Stop everything
docker compose down

# Stop and wipe the database (destructive!)
docker compose down -v

# Rebuild after code changes
docker compose up -d --build sync-service
```

## Backup the database

```sh
docker compose exec postgres pg_dump -U braindump braindump > braindump-$(date +%Y%m%d).sql
```

Restore:
```sh
cat braindump-YYYYMMDD.sql | docker compose exec -T postgres psql -U braindump braindump
```

---

## Install via Zima (Docker Hub image)

A pre-built multi-arch image (`amd64` + `arm64`) is published automatically to:
**`dagmkrogh/braindump-sync:latest`**

### On your Zima

1. Open **CasaOS** → **App Store** → **Custom Install**
2. Paste the contents of `docker-compose.zima.yml`
3. Fill in the environment variables when prompted, or set them in the compose directly

Or via SSH:

```sh
# Download the Zima compose
curl -O https://raw.githubusercontent.com/dagmkrogh/Braindump/main/docker/sync-service/docker-compose.zima.yml
curl -O https://raw.githubusercontent.com/dagmkrogh/Braindump/main/docker/sync-service/.env.example
cp .env.example .env && nano .env
docker compose -f docker-compose.zima.yml up -d
```

### Updating

```sh
docker compose -f docker-compose.zima.yml pull sync-service
docker compose -f docker-compose.zima.yml up -d
```
