/**
 * TEAMMATE B — Matrix Client Initialization
 *
 * Responsibilities:
 *   - Login / Register against local Synapse
 *   - Expose a singleton MatrixClient
 *   - Room creation (Spaces = Invite-Only rooms)
 *   - Real-time message streaming via .on() listeners
 */

import * as sdk from 'matrix-js-sdk';

const HOMESERVER = 'http://localhost:8008';

// Singleton — call initClient() once at app startup
let client: sdk.MatrixClient | null = null;

export function getClient(): sdk.MatrixClient {
  if (!client) throw new Error('Matrix client not initialized. Call initClient() first.');
  return client;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginWithPassword(
  username: string,
  password: string
): Promise<sdk.MatrixClient> {
  // Temporary client just for login — no storage needed yet
  const tempClient = sdk.createClient({ baseUrl: HOMESERVER });

  const response = await tempClient.loginWithPassword(username, password);

  // Re-create with full credentials + in-memory store
  client = sdk.createClient({
    baseUrl: HOMESERVER,
    accessToken: response.access_token,
    userId: response.user_id,
    store: new sdk.MemoryStore({ localStorage: window.localStorage }),
    timelineSupport: true,
  });

  await client.startClient({ initialSyncLimit: 20 });
  return client;
}

export async function registerWithPassword(
  username: string,
  password: string
): Promise<sdk.MatrixClient> {
  const tempClient = sdk.createClient({ baseUrl: HOMESERVER });

  await tempClient.register(username, password, null, { kind: 'guest' });

  // After register, login to get a real access token
  return loginWithPassword(username, password);
}

// ─── Spaces / Rooms ──────────────────────────────────────────────────────────

const API_URL = import.meta.env.VITE_API_URL as string;

export interface CreateSpaceOptions {
  name: string;
  topic?: string;
}

/**
 * Creates a Matrix Space via the AWS Lambda orchestrator.
 * The Lambda uses a Synapse admin token to enforce privacy settings server-side.
 */
export async function createSpace(options: CreateSpaceOptions): Promise<string> {
  const c = getClient();

  const resp = await fetch(`${API_URL}/spaces`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: options.name,
      topic: options.topic ?? '',
      createdBy: c.getUserId(),
    }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error ?? `Space creation failed (${resp.status})`);
  }

  const { roomId } = await resp.json();
  return roomId;
}

/**
 * Creates a standard text channel inside a Space.
 */
export async function createChannel(
  spaceRoomId: string,
  channelName: string
): Promise<string> {
  const c = getClient();

  const result = await c.createRoom({
    name: channelName,
    preset: sdk.Preset.PrivateChat,
    visibility: sdk.Visibility.Private,
  });

  // Link channel as child of the Space
  await c.sendStateEvent(
    spaceRoomId,
    'm.space.child',
    { via: [c.getDomain()!] },
    result.room_id
  );

  return result.room_id;
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export async function sendMessage(roomId: string, body: string): Promise<void> {
  await getClient().sendTextMessage(roomId, body);
}

/**
 * Register a listener for new messages in a room.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 */
export function onRoomMessage(
  roomId: string,
  handler: (event: sdk.MatrixEvent, room: sdk.Room) => void
): () => void {
  const c = getClient();

  const listener = (event: sdk.MatrixEvent, room: sdk.Room) => {
    if (room.roomId !== roomId) return;
    if (event.getType() !== 'm.room.message') return;
    handler(event, room);
  };

  c.on(sdk.RoomEvent.Timeline, listener);
  return () => c.off(sdk.RoomEvent.Timeline, listener);
}

/**
 * Returns past messages for a room (up to `limit`).
 */
export function getRoomHistory(
  roomId: string,
  limit = 50
): sdk.MatrixEvent[] {
  const room = getClient().getRoom(roomId);
  if (!room) return [];

  return room
    .getLiveTimeline()
    .getEvents()
    .filter((e) => e.getType() === 'm.room.message')
    .slice(-limit);
}
