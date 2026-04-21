# Me-Cord: Discord Remix — Quickstart

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

## 5. Invite Users

Inside a selected space, use the **Invite to Space** box in the channel sidebar to invite users into that space.

Inviting a user to a space now also auto-invites them to all channels currently inside that space.

When a channel is selected, use **Invite to Channel** to invite users directly to that room.

You can enter either a full Matrix user ID (for example `@alice:localhost`) or just a username.

The right-hand **Members** panel shows current joined and invited members for the selected space and channel.

## 6. Accept Invites

The channel sidebar includes a **Pending Invites** section.

When someone invites you to a space or channel, it appears there with an **Accept** button. Click **Accept** to join immediately.

## 7. Home View

Click the **Home** button in the left sidebar to open a dedicated home area.

From Home you can:
- Add friends (by Matrix user ID or username)
- Accept incoming invites
- Open and send direct messages (DMs)

## 8. Profile Customization

In the space/channel view, click your profile card at the bottom of the channel sidebar.

You can edit your display name and upload a new profile picture. Changes are saved to your Matrix profile.

## Tech Stack

- **Frontend:** React + Vite + Tailwind CSS
- **Desktop:** Electron
- **Backend:** Matrix Synapse (Docker + SQLite)
- **Voice/Video:** Jitsi Meet (IFrame)
