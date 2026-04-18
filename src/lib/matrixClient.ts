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
const MAX_429_RETRIES = 3;
const DEFAULT_RETRY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitedError(error: any): boolean {
  const statusCode = Number(error?.statusCode ?? error?.httpStatus ?? error?.data?.status);
  if (statusCode === 429) return true;

  const message = String(error?.message ?? '');
  return message.includes('[429]') || message.toLowerCase().includes('too many requests');
}

function getRetryAfterMs(error: any): number {
  const retryAfter = Number(error?.data?.retry_after_ms ?? error?.retry_after_ms);
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter;
  }
  return DEFAULT_RETRY_MS;
}

async function withRateLimitRetry<T>(action: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await action();
    } catch (error: any) {
      if (!isRateLimitedError(error) || attempt >= MAX_429_RETRIES) {
        throw error;
      }

      const waitMs = getRetryAfterMs(error) + attempt * 250;
      attempt += 1;
      await sleep(waitMs);
    }
  }
}

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

export interface CurrentUserProfile {
  userId: string;
  displayName: string;
  avatarMxcUrl: string | null;
  avatarUrl: string | null;
}

function localpartFromUserId(userId: string): string {
  return userId.replace(/^@/, '').split(':')[0] || 'You';
}

export function getCurrentUserProfile(): CurrentUserProfile {
  const c = getClient();
  const userId = c.getUserId();
  if (!userId) throw new Error('User session not available');

  const user = c.getUser(userId);
  const displayName = user?.displayName || localpartFromUserId(userId);
  const avatarMxcUrl = user?.avatarUrl ?? null;
  const avatarUrl = avatarMxcUrl ? c.mxcUrlToHttp(avatarMxcUrl) ?? null : null;

  return {
    userId,
    displayName,
    avatarMxcUrl,
    avatarUrl,
  };
}

export async function updateCurrentUserProfile(options: {
  displayName: string;
  avatarFile?: File | null;
}): Promise<CurrentUserProfile> {
  const c = getClient();
  const userId = c.getUserId();
  if (!userId) throw new Error('User session not available');

  const trimmedDisplayName = options.displayName.trim();
  if (!trimmedDisplayName) {
    throw new Error('Display name is required');
  }

  await c.setDisplayName(trimmedDisplayName);

  if (options.avatarFile) {
    const uploadResult = await c.uploadContent(options.avatarFile);
    const contentUri = typeof uploadResult === 'string'
      ? uploadResult
      : (uploadResult as { content_uri?: string }).content_uri;

    if (!contentUri) {
      throw new Error('Avatar upload failed');
    }

    await c.setAvatarUrl(contentUri);
  }

  const refreshed = await c.getProfileInfo(userId).catch(() => null as {
    displayname?: string;
    avatar_url?: string;
  } | null);

  const avatarMxcUrl = refreshed?.avatar_url ?? c.getUser(userId)?.avatarUrl ?? null;
  const avatarUrl = avatarMxcUrl ? c.mxcUrlToHttp(avatarMxcUrl) ?? null : null;

  return {
    userId,
    displayName: refreshed?.displayname ?? trimmedDisplayName,
    avatarMxcUrl,
    avatarUrl,
  };
}

export function onCurrentUserProfileChanged(
  handler: (profile: CurrentUserProfile) => void
): () => void {
  const c = getClient();
  const userId = c.getUserId();
  if (!userId) return () => {};

  const emit = () => {
    try {
      handler(getCurrentUserProfile());
    } catch {
      // Ignore transient profile read errors.
    }
  };

  const syncListener = () => emit();
  const timelineListener = (event: sdk.MatrixEvent) => {
    if (event.getType() !== 'm.room.member') return;
    if (event.getStateKey() !== userId) return;
    emit();
  };

  c.on('sync' as any, syncListener);
  c.on(sdk.RoomEvent.Timeline, timelineListener);

  return () => {
    c.off('sync' as any, syncListener);
    c.off(sdk.RoomEvent.Timeline, timelineListener);
  };
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

  let response: Awaited<ReturnType<typeof tempClient.loginWithPassword>>;
  try {
    response = await withRateLimitRetry(() => tempClient.loginWithPassword(normalizedUsername, password));
  } catch (error: any) {
    if (isRateLimitedError(error)) {
      throw new Error('Too many login attempts. Please wait a moment and try again.');
    }
    throw error;
  }

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

  let response: Response;

  try {
    response = await withRateLimitRetry(async () => {
      const r = await fetch(`${normalizedHomeserver}/_matrix/client/v3/register`, {
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

      if (r.status === 429) {
        const body = await r.json().catch(() => ({}));
        throw {
          statusCode: 429,
          data: body,
          message: 'Too Many Requests',
        };
      }

      return r;
    });
  } catch (error: any) {
    if (isRateLimitedError(error)) {
      throw new Error('Too many registration attempts. Please wait a moment and try again.');
    }
    throw error;
  }

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

export interface DirectMessageInfo {
  roomId: string;
  name: string;
  peerUserId: string;
}

function getDirectMap(): Record<string, string[]> {
  const c = getClient();
  const directEvent = c.getAccountData('m.direct');
  if (!directEvent) return {};

  const content = directEvent.getContent() as Record<string, string[] | undefined>;
  const directMap: Record<string, string[]> = {};

  for (const [userId, roomIds] of Object.entries(content)) {
    if (!Array.isArray(roomIds)) continue;
    directMap[userId] = roomIds;
  }

  return directMap;
}

async function appendToDirectMap(peerUserId: string, roomId: string): Promise<void> {
  const c = getClient();
  const directMap = getDirectMap();
  const existing = directMap[peerUserId] ?? [];

  if (!existing.includes(roomId)) {
    directMap[peerUserId] = [...existing, roomId];
    await c.setAccountData('m.direct', directMap);
  }
}

function resolveDmPeerUserId(room: sdk.Room, myUserId: string): string {
  const members = room
    .getMembers()
    .filter((m) => m.membership === 'join' || m.membership === 'invite')
    .map((m) => m.userId);

  const peer = members.find((userId) => userId !== myUserId);
  return peer ?? '';
}

export function getDirectMessageRooms(): DirectMessageInfo[] {
  const c = getClient();
  const myUserId = c.getUserId() ?? '';
  const directMap = getDirectMap();
  const directRoomIds = new Set(Object.values(directMap).flat());

  const rooms = c
    .getRooms()
    .filter((room) => room.getMyMembership() === 'join')
    .filter((room) => {
      if (directRoomIds.has(room.roomId)) return true;

      const isSpace = room.currentState.getStateEvents('m.room.create', '')?.getContent()?.type === 'm.space';
      if (isSpace) return false;

      const joinedOrInvited = room
        .getMembers()
        .filter((m) => m.membership === 'join' || m.membership === 'invite').length;

      return joinedOrInvited <= 2;
    })
    .map((room) => {
      const peerUserId = resolveDmPeerUserId(room, myUserId);
      const fallback = peerUserId ? peerUserId.replace(/^@/, '').split(':')[0] : 'Direct Message';

      return {
        roomId: room.roomId,
        name: room.name || fallback,
        peerUserId,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return rooms;
}

export function onDirectMessagesChanged(
  handler: (rooms: DirectMessageInfo[]) => void
): () => void {
  const c = getClient();

  const emit = () => handler(getDirectMessageRooms());

  const syncListener = () => emit();
  const timelineListener = (event: sdk.MatrixEvent) => {
    const type = event.getType();
    if (type !== 'm.room.member' && type !== 'm.room.create' && type !== 'm.room.name' && type !== 'm.room.message') return;
    emit();
  };

  c.on('sync' as any, syncListener);
  c.on(sdk.RoomEvent.Timeline, timelineListener);

  return () => {
    c.off('sync' as any, syncListener);
    c.off(sdk.RoomEvent.Timeline, timelineListener);
  };
}

export async function createOrGetDirectMessage(userIdOrLocalpart: string): Promise<string> {
  const c = getClient();
  const myUserId = c.getUserId();
  if (!myUserId) throw new Error('User session not available');

  const peerUserId = normalizeInviteUserId(userIdOrLocalpart);
  if (!peerUserId) throw new Error('User is required');

  if (peerUserId === myUserId) {
    throw new Error('Cannot create a DM with yourself');
  }

  const existing = getDirectMessageRooms().find((room) => room.peerUserId === peerUserId);
  if (existing) return existing.roomId;

  const result = await c.createRoom({
    is_direct: true,
    invite: [peerUserId],
    preset: sdk.Preset.PrivateChat,
    visibility: sdk.Visibility.Private,
  });

  await appendToDirectMap(peerUserId, result.room_id);
  return result.room_id;
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
