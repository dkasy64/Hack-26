import { useEffect, useRef, useState } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import {
  acceptInvite,
  createOrGetDirectMessage,
  createGroupDirectMessage,
  getBio,
  getDirectMessageRooms,
  getRoomMembers,
  getRoomMembershipEvents,
  getPendingInvites,
  getRoomHistory,
  inviteUserToRoom,
  leaveRoom,
  onDirectMessagesChanged,
  onPendingInvitesChanged,
  onRoomMembersChanged,
  onRoomMembershipEvent,
  onRoomMessage,
  resolveMxcAvatarUrl,
  sendMessage,
  setBio,
  type DirectMessageInfo,
  type PendingInviteInfo,
  type RoomMemberInfo,
  type RoomMembershipEventInfo,
} from '../lib/matrixClient';
import { EmojiPicker } from './EmojiPicker';
import { ProfileModal } from './ProfileModal';

interface Message {
  eventId: string;
  sender: string;
  body: string;
  ts: number;
}

interface Props {
  matrixClient: MatrixClient;
  currentUserDisplayName: string;
  currentUserAvatarUrl: string | null;
  currentUserTag: string;
  onOpenProfile: () => void;
}

export function HomeView({
  matrixClient,
  currentUserDisplayName,
  currentUserAvatarUrl,
  currentUserTag,
  onOpenProfile,
}: Props) {
  const [friendInput, setFriendInput] = useState('');
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupUsersInput, setGroupUsersInput] = useState('');
  const [pendingInvites, setPendingInvites] = useState<PendingInviteInfo[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageInfo[]>([]);
  const [activeDmRoomId, setActiveDmRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<RoomMemberInfo[]>([]);
  const [membershipEvents, setMembershipEvents] = useState<RoomMembershipEventInfo[]>([]);
  const [groupInviteInput, setGroupInviteInput] = useState('');
  const [draft, setDraft] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [bio, setBioState] = useState('');
  const [profileModalUserId, setProfileModalUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadInvites = () => setPendingInvites(getPendingInvites());
    loadInvites();
    return onPendingInvitesChanged(setPendingInvites);
  }, []);

  useEffect(() => {
    const loadDms = () => setDirectMessages(getDirectMessageRooms());
    loadDms();
    return onDirectMessagesChanged(setDirectMessages);
  }, []);

  useEffect(() => {
    if (!activeDmRoomId) {
      setMessages([]);
      return;
    }

    setMessages(getRoomHistory(activeDmRoomId).map(eventToMessage));

    const unsub = onRoomMessage(activeDmRoomId, (event: MatrixEvent, _room: Room) => {
      setMessages((prev) => {
        const eventId = event.getId();
        if (eventId && prev.some((m) => m.eventId === eventId)) return prev;
        return [...prev, eventToMessage(event)];
      });
    });

    return unsub;
  }, [activeDmRoomId]);

  useEffect(() => {
    if (!activeDmRoomId) {
      setParticipants([]);
      setMembershipEvents([]);
      return;
    }

    setParticipants(getRoomMembers(activeDmRoomId));
    setMembershipEvents(getRoomMembershipEvents(activeDmRoomId));

    const unsubMembers = onRoomMembersChanged(activeDmRoomId, setParticipants);
    const unsubMembershipEvents = onRoomMembershipEvent(activeDmRoomId, (event) => {
      setMembershipEvents((prev) => {
        if (prev.some((e) => e.eventId === event.eventId)) return prev;
        return [...prev, event].slice(-25);
      });
    });

    return () => {
      unsubMembers();
      unsubMembershipEvents();
    };
  }, [activeDmRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const loadBio = async () => {
      try {
        const bioData = await getBio();
        setBioState(bioData);
      } catch (error) {
        console.error('Failed to load bio:', error);
      }
    };
    loadBio();
  }, []);

  async function handleAddFriendAndDm() {
    if (!friendInput.trim()) return;
    setError(null);
    setStatus(null);
    setIsBusy(true);

    try {
      const roomId = await createOrGetDirectMessage(friendInput.trim());
      setActiveDmRoomId(roomId);
      setStatus('Friend added and DM opened.');
      setFriendInput('');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to add friend');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAcceptInvite(invite: PendingInviteInfo) {
    setError(null);
    setStatus(null);
    setIsBusy(true);

    try {
      await acceptInvite(invite.roomId);
      if (invite.kind === 'channel') {
        setActiveDmRoomId(invite.roomId);
      }
      setStatus(`Accepted invite to ${invite.name}.`);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to accept invite');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSend() {
    if (!activeDmRoomId || !draft.trim()) return;
    await sendMessage(activeDmRoomId, draft.trim());
    setDraft('');
  }

  async function handleSaveBio() {
    try {
      await setBio(bio);
      setStatus('Bio updated.');
    } catch (error) {
      setError('Failed to update bio.');
    }
  }

  async function handleCreateGroupDm() {
    const parsedUsers = groupUsersInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    if (parsedUsers.length < 2) {
      setError('Enter at least two users for a group DM');
      return;
    }

    setError(null);
    setStatus(null);
    setIsBusy(true);

    try {
      const roomId = await createGroupDirectMessage(parsedUsers, groupNameInput.trim() || undefined);
      setActiveDmRoomId(roomId);
      setGroupNameInput('');
      setGroupUsersInput('');
      setStatus('Group DM created.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create group DM');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleLeaveActiveDm() {
    if (!activeDmRoomId) return;

    setError(null);
    setStatus(null);
    setIsBusy(true);

    try {
      await leaveRoom(activeDmRoomId);
      setActiveDmRoomId(null);
      setStatus('Left chat.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to leave chat');
    } finally {
      setIsBusy(false);
    }
  }

  async function handleInviteToActiveGroupDm() {
    if (!activeDmRoomId || !groupInviteInput.trim()) return;

    setError(null);
    setStatus(null);
    setIsBusy(true);

    try {
      await inviteUserToRoom(activeDmRoomId, groupInviteInput.trim());
      setGroupInviteInput('');
      setStatus('Invitation sent.');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to invite user to group chat');
    } finally {
      setIsBusy(false);
    }
  }

  const activeDm = directMessages.find((room) => room.roomId === activeDmRoomId) ?? null;

  return (
    <div className="flex flex-1 overflow-hidden">
      <aside className="flex w-72 flex-col border-r border-[#1e1f22] bg-[#2b2d31]">
        <div className="border-b border-[#1e1f22] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#949ba4]">Add Friend</p>
          <div className="flex gap-1">
            <input
              value={friendInput}
              onChange={(e) => setFriendInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFriendAndDm()}
              placeholder="@user:server or username"
              className="flex-1 rounded bg-[#1e1f22] px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleAddFriendAndDm}
              disabled={isBusy || !friendInput.trim()}
              className="rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        <div className="border-b border-[#1e1f22] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#949ba4]">Create Group DM</p>
          <div className="flex flex-col gap-2">
            <input
              value={groupNameInput}
              onChange={(e) => setGroupNameInput(e.target.value)}
              placeholder="Group name (optional)"
              className="rounded bg-[#1e1f22] px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <input
              value={groupUsersInput}
              onChange={(e) => setGroupUsersInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateGroupDm()}
              placeholder="alice, bob, @charlie:localhost"
              className="rounded bg-[#1e1f22] px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <button
              onClick={handleCreateGroupDm}
              disabled={isBusy || !groupUsersInput.trim()}
              className="rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
            >
              Create Group
            </button>
          </div>
        </div>

        <div className="border-b border-[#1e1f22] p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#949ba4]">Your Bio</p>
          <textarea
            value={bio}
            onChange={(e) => setBioState(e.target.value)}
            placeholder="Tell others about yourself..."
            rows={3}
            className="w-full rounded bg-[#1e1f22] px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
          />
          <button
            onClick={handleSaveBio}
            disabled={!bio.trim() || isBusy}
            className="mt-2 rounded bg-indigo-600 px-2 py-1 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            Save Bio
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#949ba4]">Friends</p>
            <span className="text-[10px] uppercase tracking-wide text-[#6d6f78]">{directMessages.length} connected</span>
          </div>
          {directMessages.length === 0 ? (
            <p className="text-xs text-[#949ba4]">No friends yet. Add one to start a DM.</p>
          ) : (
            <div className="space-y-1">
              {directMessages.map((room) => (
                <button
                  key={room.roomId}
                  onClick={() => setActiveDmRoomId(room.roomId)}
                  className={`w-full rounded px-2 py-1.5 text-left text-sm transition ${
                    room.roomId === activeDmRoomId
                      ? 'bg-[#404249] text-white'
                      : 'bg-[#1e1f22] text-[#b5bac1] hover:bg-[#35373c] hover:text-white'
                  }`}
                >
                  <span className="block truncate">{room.name}</span>
                  <span className="text-[10px] uppercase tracking-wide text-[#949ba4]">
                    {room.isGroup ? `Group • ${room.memberCount} members` : 'Direct'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={onOpenProfile}
          className="flex h-14 w-full items-center gap-2 border-t border-[#1e1f22] bg-[#232428] px-3 transition hover:bg-[#2f3136]"
        >
          {currentUserAvatarUrl ? (
            <img src={currentUserAvatarUrl} alt="Your avatar" className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {currentUserDisplayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex min-w-0 flex-col items-start leading-tight">
            <span className="max-w-full truncate text-sm font-medium text-white">{currentUserDisplayName}</span>
            <span className="max-w-full truncate text-xs text-[#949ba4]">{currentUserTag}</span>
          </div>
        </button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col bg-[#313338]">
        <div className="flex h-12 items-center border-b border-[#1e1f22] px-4">
          <span className="text-sm font-semibold text-white">{activeDm ? activeDm.name : 'Home'}</span>
        </div>

        {(status || error) && (
          <div className="px-4 pt-3">
            {status && <p className="text-xs text-green-400">{status}</p>}
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        )}

        {!activeDmRoomId ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-[#949ba4]">
            Select a DM from the left, or add a friend to start chatting.
          </div>
        ) : (
          <>
            <div className="border-b border-[#1e1f22] px-4 py-2">
              <button
                onClick={handleLeaveActiveDm}
                disabled={isBusy}
                className="rounded bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                Leave Chat
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <MessageRow
                    key={msg.eventId}
                    message={msg}
                    myUserId={matrixClient.getUserId() ?? ''}
                    matrixClient={matrixClient}
                    roomId={activeDmRoomId}
                    onClickUsername={setProfileModalUserId}
                  />
                ))}
              </div>
              <div ref={bottomRef} />
            </div>

            <div className="px-4 pb-6 pt-2">
              <div className="relative flex items-center gap-2 rounded-lg bg-[#383a40] px-4 py-2.5">
                {showEmojiPicker && (
                  <div className="absolute left-4 bottom-full z-10">
                    <EmojiPicker
                      onSelect={(emoji) => {
                        setDraft((value) => value + emoji);
                        setShowEmojiPicker(false);
                        inputRef.current?.focus();
                      }}
                    />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker((value) => !value)}
                  className="rounded bg-[#2d2f35] px-3 py-2 text-sm text-[#c7c9cc] hover:bg-[#3b3e45]"
                >
                  😊
                </button>
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Send a direct message"
                  className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6d6f78]"
                />
                <button
                  onClick={handleSend}
                  disabled={!draft.trim()}
                  className="text-[#949ba4] hover:text-white disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </main>

      {activeDm?.isGroup && activeDmRoomId && (
        <aside className="flex w-64 flex-col border-l border-[#1e1f22] bg-[#2b2d31]">
          <div className="flex h-12 items-center border-b border-[#1e1f22] px-4">
            <span className="text-sm font-semibold text-white">Group Members</span>
          </div>

          <div className="border-b border-[#1e1f22] p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#949ba4]">Invite Member</p>
            <div className="flex gap-2">
              <input
                value={groupInviteInput}
                onChange={(e) => setGroupInviteInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInviteToActiveGroupDm()}
                placeholder="@user:server"
                className="flex-1 rounded bg-[#1e1f22] px-2 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleInviteToActiveGroupDm}
                disabled={isBusy || !groupInviteInput.trim()}
                className="rounded bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#949ba4]">
              Members ({participants.length})
            </p>
            {participants.length === 0 ? (
              <p className="text-xs text-[#6d6f78]">No visible members.</p>
            ) : (
              <div className="space-y-1">
                {participants.map((participant) => (
                  <div key={participant.userId} className="rounded bg-[#232428] px-2 py-1.5">
                    <p className="truncate text-xs font-semibold text-white">{participant.displayName}</p>
                    <p className="text-[10px] uppercase tracking-wide text-[#949ba4]">{participant.membership}</p>
                  </div>
                ))}
              </div>
            )}

            <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-[#949ba4]">Recent Activity</p>
            {membershipEvents.length === 0 ? (
              <p className="text-xs text-[#6d6f78]">No recent join/leave activity.</p>
            ) : (
              <div className="space-y-1">
                {membershipEvents.slice(-8).map((event) => (
                  <p key={event.eventId} className="rounded bg-[#232428] px-2 py-1.5 text-xs text-[#b5bac1]">
                    <span className="font-semibold text-white">{event.displayName}</span>{' '}
                    {event.membership === 'join' ? 'joined' : 'left'}
                  </p>
                ))}
              </div>
            )}
          </div>
        </aside>
      )}

      {profileModalUserId && (
        <ProfileModal userId={profileModalUserId} onClose={() => setProfileModalUserId(null)} />
      )}
    </div>
  );
}

function eventToMessage(event: MatrixEvent): Message {
  return {
    eventId: event.getId() ?? Math.random().toString(),
    sender: event.getSender() ?? 'unknown',
    body: event.getContent().body ?? '',
    ts: event.getTs(),
  };
}

function MessageRow({
  message,
  myUserId,
  matrixClient,
  roomId,
  onClickUsername,
}: {
  message: Message;
  myUserId: string;
  matrixClient: MatrixClient;
  roomId: string;
  onClickUsername: (userId: string) => void;
}) {
  const isMe = message.sender === myUserId;
  const room = matrixClient.getRoom(roomId);
  const member = room?.getMember(message.sender);
  const displayName = member?.name || matrixClient.getUser(message.sender)?.displayName || message.sender.split(':')[0].replace('@', '');
  const avatarMxc = member?.getMxcAvatarUrl() || matrixClient.getUser(message.sender)?.avatarUrl || null;
  const avatarUrl = resolveMxcAvatarUrl(avatarMxc);
  const time = new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex items-start gap-3 ${isMe ? '' : ''}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={`${displayName} avatar`} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div>
        <div className="flex items-baseline gap-2">
          <button
            onClick={() => onClickUsername(message.sender)}
            className="text-sm font-semibold text-white hover:underline"
          >
            {displayName}
          </button>
          <span className="text-xs text-[#6d6f78]">{time}</span>
        </div>
        <p className="text-sm text-[#dcddde]">{message.body}</p>
      </div>
    </div>
  );
}
