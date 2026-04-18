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

function normalizeHomeserver(input: string): string {
  const raw = input.trim() || HOMESERVER;
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return withProtocol.replace(/\/+$/, '');
}

function normalizeUsername(input: string): string {
  let username = input.trim();
  if (username.startsWith('@')) username = username.slice(1);

  const colonIndex = username.indexOf(':');
  if (colonIndex >= 0) {
    username = username.slice(0, colonIndex);
  }

  return username;
}

function normalizeRegisterLocalpart(input: string): string {
  const username = input.trim();
  if (username.startsWith('@')) {
    const noAt = username.slice(1);
    const colonIndex = noAt.indexOf(':');
    return colonIndex >= 0 ? noAt.slice(0, colonIndex) : noAt;
  }

  const colonIndex = username.indexOf(':');
  return colonIndex >= 0 ? username.slice(0, colonIndex) : username;
}

// Singleton — call initClient() once at app startup
let client: sdk.MatrixClient | null = null;

export function getClient(): sdk.MatrixClient {
  if (!client) throw new Error('Matrix client not initialized. Call initClient() first.');
  return client;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginWithPassword(
  username: string,
  password: string,
  homeserver = HOMESERVER
): Promise<sdk.MatrixClient> {
  const normalizedHomeserver = normalizeHomeserver(homeserver);
  const normalizedUsername = normalizeUsername(username).trim();

  // Temporary client just for login — no storage needed yet
  const tempClient = sdk.createClient({ baseUrl: normalizedHomeserver });

  const response = await tempClient.loginWithPassword(normalizedUsername, password);

  // Re-create with full credentials + in-memory store
  client = sdk.createClient({
    baseUrl: normalizedHomeserver,
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
  password: string,
  homeserver = HOMESERVER
): Promise<sdk.MatrixClient> {
  const normalizedHomeserver = normalizeHomeserver(homeserver);
  const localpart = normalizeRegisterLocalpart(username).trim();

  const response = await fetch(`${normalizedHomeserver}/_matrix/client/v3/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: localpart,
      password,
      inhibit_login: true,
      auth: {
        type: 'm.login.dummy',
      },
    }),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Registration failed');
  }

  // After register, login to get a real access token
  return loginWithPassword(username, password, normalizedHomeserver);
}

// ─── Spaces / Rooms ──────────────────────────────────────────────────────────

export interface CreateSpaceOptions {
  name: string;
  topic?: string;
}

/**
 * Creates a Matrix "Space" (private, invite-only room).
 * Returns the new room's roomId.
 */
export async function createSpace(options: CreateSpaceOptions): Promise<string> {
  const c = getClient();

  const result = await c.createRoom({
    name: options.name,
    topic: options.topic,
    preset: sdk.Preset.PrivateChat,   // invite-only by default
    visibility: sdk.Visibility.Private,
    creation_content: {
      // Mark as a Space per MSC1772
      type: 'm.space',
    },
    power_level_content_override: {
      // Room creator is admin (100)
      users_default: 0,
      events_default: 50,
    },
  });

  return result.room_id;
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
    'm.space.child' as any,
    { via: [c.getDomain()!] },
    result.room_id
  );

  // Keep channel membership aligned with its parent space.
  await inviteSpaceMembersToRoom(spaceRoomId, result.room_id);

  return result.room_id;
}

function getChannelsInSpace(spaceRoomId: string): sdk.Room[] {
  const c = getClient();
  const allRooms = c.getRooms();
  const spaceRoom = c.getRoom(spaceRoomId);
  if (!spaceRoom) return [];

  return allRooms.filter((room) => {
    if (room.roomId === spaceRoomId) return false;

    const isSpace = room.currentState.getStateEvents('m.room.create', '')?.getContent()?.type === 'm.space';
    if (isSpace) return false;

    return spaceRoom.currentState.getStateEvents('m.space.child', room.roomId) != null;
  });
}

async function inviteUserToRoomIfNeeded(roomId: string, userId: string): Promise<void> {
  const c = getClient();
  const room = c.getRoom(roomId);
  const membership = room?.getMember(userId)?.membership;

  if (membership === 'join' || membership === 'invite') {
    return;
  }

  await c.invite(roomId, userId);
}

async function inviteSpaceMembersToRoom(spaceRoomId: string, targetRoomId: string): Promise<void> {
  const c = getClient();
  const spaceRoom = c.getRoom(spaceRoomId);
  if (!spaceRoom) return;

  const selfUserId = c.getUserId();
  const candidateUserIds = spaceRoom
    .getMembers()
    .filter((member) => member.membership === 'join' || member.membership === 'invite')
    .map((member) => member.userId)
    .filter((userId) => userId !== selfUserId);

  for (const userId of candidateUserIds) {
    await inviteUserToRoomIfNeeded(targetRoomId, userId);
  }
}

function normalizeInviteUserId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('@') && trimmed.includes(':')) {
    return trimmed;
  }

  const c = getClient();
  const domain = c.getDomain();
  if (!domain) return trimmed;

  const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  const localpart = withoutAt.includes(':') ? withoutAt.split(':')[0] : withoutAt;
  return `@${localpart}:${domain}`;
}

export async function inviteUserToSpace(spaceRoomId: string, userIdOrLocalpart: string): Promise<void> {
  const userId = normalizeInviteUserId(userIdOrLocalpart);
  if (!userId) throw new Error('User is required');

  await inviteUserToRoomIfNeeded(spaceRoomId, userId);

  // Also invite to every child channel so space membership is reflected across channels.
  const channels = getChannelsInSpace(spaceRoomId);
  for (const channel of channels) {
    await inviteUserToRoomIfNeeded(channel.roomId, userId);
  }
}

export async function inviteUserToChannel(channelRoomId: string, userIdOrLocalpart: string): Promise<void> {
  const userId = normalizeInviteUserId(userIdOrLocalpart);
  if (!userId) throw new Error('User is required');
  await getClient().invite(channelRoomId, userId);
}

export interface RoomMemberInfo {
  userId: string;
  displayName: string;
  membership: 'join' | 'invite';
}

export interface PendingInviteInfo {
  roomId: string;
  name: string;
  kind: 'space' | 'channel';
}

export function getPendingInvites(): PendingInviteInfo[] {
  const c = getClient();

  return c
    .getRooms()
    .filter((room) => room.getMyMembership() === 'invite')
    .map((room) => {
      const kind: PendingInviteInfo['kind'] = room.currentState.getStateEvents('m.room.create', '')?.getContent()?.type === 'm.space'
        ? 'space'
        : 'channel';

      const fallbackName = kind === 'space' ? 'Invited Space' : 'Invited Channel';

      return {
        roomId: room.roomId,
        name: room.name || fallbackName,
        kind,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function acceptInvite(roomId: string): Promise<void> {
  await getClient().joinRoom(roomId);
}

export function onPendingInvitesChanged(
  handler: (invites: PendingInviteInfo[]) => void
): () => void {
  const c = getClient();

  const emit = () => handler(getPendingInvites());

  const syncListener = () => emit();
  const timelineListener = (event: sdk.MatrixEvent) => {
    const type = event.getType();
    if (type !== 'm.room.member' && type !== 'm.room.create' && type !== 'm.room.name') return;
    emit();
  };

  c.on('sync' as any, syncListener);
  c.on(sdk.RoomEvent.Timeline, timelineListener);

  return () => {
    c.off('sync' as any, syncListener);
    c.off(sdk.RoomEvent.Timeline, timelineListener);
  };
}

export function getRoomMembers(roomId: string): RoomMemberInfo[] {
  const room = getClient().getRoom(roomId);
  if (!room) return [];

  return room
    .getMembers()
    .filter((member) => member.membership === 'join' || member.membership === 'invite')
    .map((member) => ({
      userId: member.userId,
      displayName: member.name || member.userId,
      membership: member.membership as 'join' | 'invite',
    }))
    .sort((a, b) => {
      if (a.membership !== b.membership) {
        return a.membership === 'join' ? -1 : 1;
      }
      return a.displayName.localeCompare(b.displayName);
    });
}

export function onRoomMembersChanged(
  roomId: string,
  handler: (members: RoomMemberInfo[]) => void
): () => void {
  const c = getClient();

  const listener = (event: sdk.MatrixEvent, room?: sdk.Room) => {
    if (!room) return;
    if (room.roomId !== roomId) return;
    if (event.getType() !== 'm.room.member') return;
    handler(getRoomMembers(roomId));
  };

  c.on(sdk.RoomEvent.Timeline, listener);
  return () => c.off(sdk.RoomEvent.Timeline, listener);
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

  const listener = (event: sdk.MatrixEvent, room?: sdk.Room) => {
    if (!room) return;
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
