/**
 * TEAMMATE A — Root Layout (Discord Clone Shell)
 *
 * Layout:  [ServerSidebar 72px] | [ChannelList 240px] | [ChatWindow flex-1]
 *
 * State lives here and is passed down as props — no context needed for the
 * 5-hour sprint. MatrixClient is initialized once in useEffect on login.
 */

import { useState, useEffect } from 'react';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelList } from './components/ChannelList';
import { ChatWindow } from './components/ChatWindow';
import { LoginScreen } from './components/LoginScreen';
import { loginWithPassword, registerWithPassword, getClient } from './lib/matrixClient';
import type { MatrixClient, Room } from 'matrix-js-sdk';

export interface Space {
  id: string;   // Matrix roomId
  name: string;
  emoji?: string;
}

export interface Channel {
  id: string;
  name: string;
  spaceId: string;
}

export default function App() {
  const [matrixClient, setMatrixClient] = useState<MatrixClient | null>(null);
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Login ──────────────────────────────────────────────────────────────────
  async function handleLogin(username: string, password: string, homeserver: string) {
    setIsLoading(true);
    setError(null);
    try {
      const c = await loginWithPassword(username, password, homeserver);
      setMatrixClient(c);
    } catch (e: any) {
      setError(e?.message ?? 'Login failed');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRegister(username: string, password: string, homeserver: string) {
    setIsLoading(true);
    setError(null);
    try {
      const c = await registerWithPassword(username, password, homeserver);
      setMatrixClient(c);
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  }

  // ── Sync rooms after client ready ──────────────────────────────────────────
  useEffect(() => {
    if (!matrixClient) return;

    function syncRooms() {
      const client = getClient();
      const allRooms: Room[] = client.getRooms();

      // Spaces = rooms with 'm.space' creation_content type
      const spaceRooms = allRooms.filter(
        (r) => r.currentState.getStateEvents('m.room.create', '')
          ?.getContent()?.type === 'm.space'
      );

      setSpaces(
        spaceRooms.map((r) => ({
          id: r.roomId,
          name: r.name,
        }))
      );

      // Channels = all non-space rooms
      const channelRooms = allRooms.filter(
        (r) => r.currentState.getStateEvents('m.room.create', '')
          ?.getContent()?.type !== 'm.space'
      );

      setChannels(
        channelRooms.map((r) => ({
          id: r.roomId,
          name: r.name,
          spaceId: '',  // Teammate B: wire up space.child events here
        }))
      );
    }

    matrixClient.once('sync' as any, syncRooms);
    return () => { matrixClient.off('sync' as any, syncRooms); };
  }, [matrixClient]);

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!matrixClient) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
        isLoading={isLoading}
        error={error}
      />
    );
  }

  const activeChannels = channels.filter((c) => c.spaceId === activeSpaceId);

  // ── Main Layout ────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#313338] text-white select-none">
      {/* Col 1 — Server/Space icons */}
      <ServerSidebar
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        onSelectSpace={(id) => {
          setActiveSpaceId(id);
          setActiveChannelId(null);
        }}
      />

      {/* Col 2 — Channel list for active space */}
      <ChannelList
        channels={activeChannels}
        activeChannelId={activeChannelId}
        spaceName={spaces.find((s) => s.id === activeSpaceId)?.name ?? ''}
        onSelectChannel={setActiveChannelId}
        activeSpaceId={activeSpaceId}
        onSpaceCreated={(space) => setSpaces((prev) => [...prev, space])}
      />

      {/* Col 3 — Chat + optional Jitsi */}
      <ChatWindow
        channelId={activeChannelId}
        matrixClient={matrixClient}
      />
    </div>
  );
}
