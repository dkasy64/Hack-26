import { useEffect, useRef, useState } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import {
  acceptInvite,
  createOrGetDirectMessage,
  getDirectMessageRooms,
  getPendingInvites,
  getRoomHistory,
  onDirectMessagesChanged,
  onPendingInvitesChanged,
  onRoomMessage,
  sendMessage,
  type DirectMessageInfo,
  type PendingInviteInfo,
} from '../lib/matrixClient';
import { EmojiPicker } from './EmojiPicker';

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
  const [pendingInvites, setPendingInvites] = useState<PendingInviteInfo[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessageInfo[]>([]);
  const [activeDmRoomId, setActiveDmRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#949ba4]">Invites</p>
          {pendingInvites.length === 0 ? (
            <p className="text-xs text-[#949ba4]">No pending invites.</p>
          ) : (
            <div className="space-y-1">
              {pendingInvites.map((invite) => (
                <div key={invite.roomId} className="rounded bg-[#1e1f22] px-2 py-1.5">
                  <p className="truncate text-xs font-semibold text-white">{invite.name}</p>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-[#949ba4]">{invite.kind}</span>
                    <button
                      onClick={() => handleAcceptInvite(invite)}
                      disabled={isBusy}
                      className="rounded bg-green-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                    >
                      Accept
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  {room.name}
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

      <main className="flex flex-1 flex-col bg-[#313338]">
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
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3">
                {messages.map((msg) => (
                  <MessageRow key={msg.eventId} message={msg} myUserId={matrixClient.getUserId() ?? ''} />
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

function MessageRow({ message, myUserId }: { message: Message; myUserId: string }) {
  const isMe = message.sender === myUserId;
  const displayName = message.sender.split(':')[0].replace('@', '');
  const time = new Date(message.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`flex items-start gap-3 ${isMe ? '' : ''}`}>
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
        {displayName.slice(0, 2).toUpperCase()}
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-white">{displayName}</span>
          <span className="text-xs text-[#6d6f78]">{time}</span>
        </div>
        <p className="text-sm text-[#dcddde]">{message.body}</p>
      </div>
    </div>
  );
}
