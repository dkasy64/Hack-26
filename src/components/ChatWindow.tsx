import { useState, useEffect, useRef } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { sendMessage, onRoomMessage, getRoomHistory } from '../lib/matrixClient';

interface Message {
  eventId: string;
  sender: string;
  body: string;
  ts: number;
}

interface Props {
  channelId: string | null;
  matrixClient: MatrixClient;
}

function JitsiFrame({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const jitsiRoom = `hackqu-${roomId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}`;

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (
          data?.action === 'video-hangup' ||
          data?.event === 'readyToClose' ||
          data?.type === 'hang-up'
        ) {
          onClose();
        }
      } catch {}
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black">
      <div className="flex h-10 items-center justify-between bg-[#1e1f22] px-4">
        <span className="text-sm font-semibold text-white">Voice / Video</span>
        <button onClick={onClose} className="text-[#949ba4] hover:text-white text-xs">
          Leave Call
        </button>
      </div>
      <iframe
        src={`https://meet.jit.si/${jitsiRoom}#config.prejoinPageEnabled=false&config.disableDeepLinking=true`}
        className="flex-1 w-full border-0"
        allow="camera; microphone; fullscreen; display-capture; autoplay"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        title="Jitsi Meet"
      />
    </div>
  );
}

export function ChatWindow({ channelId, matrixClient }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [jitsiOpen, setJitsiOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!channelId) return;
    const history = getRoomHistory(channelId).map(eventToMessage);
    setMessages(history);
    const unsub = onRoomMessage(channelId, (event: MatrixEvent, _room: Room) => {
      setMessages((prev) => {
        if (prev.some((m) => m.eventId === event.getId())) return prev;
        return [...prev, eventToMessage(event)];
      });
    });
    return unsub;
  }, [channelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend() {
    if (!draft.trim() || !channelId) return;
    await sendMessage(channelId, draft.trim());
    setDraft('');
  }

  if (!channelId) {
    return (
      <main className="flex flex-1 items-center justify-center bg-[#313338]">
        <div className="text-center text-[#6d6f78]">
          <div className="mb-2 text-5xl">👋</div>
          <p className="text-lg font-semibold text-[#b5bac1]">Select a channel</p>
          <p className="text-sm">Pick a channel from the left to start chatting</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex flex-1 flex-col bg-[#313338]">
      <div className="flex h-12 items-center justify-between border-b border-[#1e1f22] px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[#b5bac1]">#</span>
          <span className="font-semibold text-white">channel</span>
        </div>
        <button
          onClick={() => setJitsiOpen(true)}
          className="flex items-center gap-1.5 rounded bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-500"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
          Join Voice
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <MessageRow key={msg.eventId} message={msg} myUserId={matrixClient.getUserId() ?? ''} />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-6 pt-2">
        <div className="flex items-center gap-2 rounded-lg bg-[#383a40] px-4 py-2.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Message #channel"
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#6d6f78]"
          />
          <button
            onClick={handleSend}
            disabled={!draft.trim()}
            className="text-[#949ba4] hover:text-white disabled:opacity-40"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </div>

      {jitsiOpen && channelId && (
        <JitsiFrame roomId={channelId} onClose={() => setJitsiOpen(false)} />
      )}
    </main>
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
    <div className={`group flex items-start gap-3 ${isMe ? '' : ''}`}>
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
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