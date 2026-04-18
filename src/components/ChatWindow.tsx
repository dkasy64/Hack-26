import { useState, useEffect, useRef } from 'react';
import type { MatrixClient, MatrixEvent, Room } from 'matrix-js-sdk';
import { sendMessage, onRoomMessage, getRoomHistory, getClient } from '../lib/matrixClient';
import { EmojiPicker } from './EmojiPicker';

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

// ─── WebRTC Video Call ────────────────────────────────────────────────────────

function VideoCall({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [status, setStatus] = useState<'waiting' | 'connecting' | 'connected'>('waiting');

  useEffect(() => {
    const client = getClient();
    let localStream: MediaStream | null = null;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    // Remote stream → video element
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
        setStatus('connected');
      }
    };

    // ICE candidate → Matrix
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        client.sendEvent(roomId, 'm.call.candidates' as any, {
          call_id: roomId,
          candidates: [e.candidate.toJSON()],
          version: 1,
        });
      }
    };

    // Listen for signaling events from Matrix
    const handleEvent = async (event: MatrixEvent) => {
      if (event.getRoomId() !== roomId) return;
      const type = event.getType();
      const content = event.getContent();
      const myId = client.getUserId();
      if (event.getSender() === myId) return; // kendi event'lerini ignore et

      if (type === 'm.call.invite') {
        setStatus('connecting');
        await pc.setRemoteDescription(new RTCSessionDescription(content.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        client.sendEvent(roomId, 'm.call.answer' as any, {
          call_id: roomId,
          answer: { type: answer.type, sdp: answer.sdp },
          version: 1,
        });
      }

      if (type === 'm.call.answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(content.answer));
      }

      if (type === 'm.call.candidates') {
        for (const candidate of content.candidates ?? []) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      }

      if (type === 'm.call.hangup') {
        onClose();
      }
    };

    client.on('Room.timeline' as any, handleEvent);

    // Kamera/mikrofon aç ve offer gönder
    async function start() {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStream;
        }
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream!));

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        setStatus('connecting');

        client.sendEvent(roomId, 'm.call.invite' as any, {
          call_id: roomId,
          offer: { type: offer.type, sdp: offer.sdp },
          lifetime: 60000,
          version: 1,
        });
      } catch (err) {
        console.error('Media error:', err);
      }
    }

    start();

    return () => {
      client.off('Room.timeline' as any, handleEvent);
      localStream?.getTracks().forEach((t) => t.stop());
      pc.close();
    };
  }, [roomId, onClose]);

  function handleLeave() {
    const client = getClient();
    client.sendEvent(roomId, 'm.call.hangup' as any, {
      call_id: roomId,
      version: 1,
    });
    onClose();
  }

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-black">
      <div className="flex h-10 items-center justify-between bg-[#1e1f22] px-4">
        <span className="text-sm font-semibold text-white">
          Voice / Video —{' '}
          {status === 'waiting' && 'Waiting for others...'}
          {status === 'connecting' && 'Connecting...'}
          {status === 'connected' && 'Connected'}
        </span>
        <button onClick={handleLeave} className="text-red-400 hover:text-red-300 text-xs font-semibold">
          Leave Call
        </button>
      </div>

      <div className="relative flex-1 bg-[#1e1f22]">
        {/* Remote video — büyük */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />
        {/* Local video — küçük köşe */}
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute bottom-4 right-4 h-32 w-48 rounded-lg object-cover border-2 border-[#404249]"
        />
        {status === 'waiting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-[#b5bac1] text-sm">Waiting for someone to join...</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Window ──────────────────────────────────────────────────────────────

export function ChatWindow({ channelId, matrixClient }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
          onClick={() => setCallOpen(true)}
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

      {callOpen && channelId && (
        <VideoCall roomId={channelId} onClose={() => setCallOpen(false)} />
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
    <div className="group flex items-start gap-3">
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