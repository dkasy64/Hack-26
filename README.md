# Discord Remix — Quickstart

A Discord-style chat app built with React + Electron + Matrix Synapse.

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Docker](https://www.docker.com/)

## 1. Start the Backend

```bash
# First time only — generate Synapse config
docker run -it --rm \
  -v $(pwd)/synapse-data:/data \
  -e SYNAPSE_SERVER_NAME=localhost \
  -e SYNAPSE_REPORT_STATS=no \
  matrixdotorg/synapse:latest generate

# Fix permissions
sudo chown -R 991:991 ./synapse-data

# Start Synapse
docker compose up -d

# Verify it's running
curl http://localhost:8008/_matrix/client/versions
```

## 2. Register Users

Synapse is configured to allow signups by default, so users can be created directly from the app login screen.

Optional: pre-create users from Docker if you want known demo accounts.

```bash
docker exec -it hackqu-synapse register_new_matrix_user \
  -u alice -p password123 -a -c /data/homeserver.yaml http://localhost:8008

docker exec -it hackqu-synapse register_new_matrix_user \
  -u bob -p password123 --no-admin -c /data/homeserver.yaml http://localhost:8008
```

## 3. Run the App

```bash
npm install
npm run dev
```

Vite starts on `http://localhost:5173` and Electron launches automatically.

## 4. Login

Choose your homeserver from the dropdown: **Default (10.111.110.222:8008)** or **Custom homeserver**. If you choose custom, enter a full URL (for example `http://localhost:8008`), then log in or choose **Create Account**.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Desktop:** Electron
- **Backend:** Matrix Synapse (Docker + SQLite)
- **Voice/Video:** Jitsi Meet (IFrame)
