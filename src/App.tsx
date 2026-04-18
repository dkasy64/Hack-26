import { useState, useEffect } from 'react';
import { ServerSidebar } from './components/ServerSidebar';
import { ChannelList } from './components/ChannelList';
import { ChatWindow } from './components/ChatWindow';
import { MemberList } from './components/MemberList';
import { HomeView } from './components/HomeView';
import { ProfileEditorModal } from './components/ProfileEditorModal';
import { LoginScreen } from './components/LoginScreen';
import {
  loginWithPassword,
  registerWithPassword,
  getClient,
  getCurrentUserProfile,
  onCurrentUserProfileChanged,
  type CurrentUserProfile,
} from './lib/matrixClient';
import type { MatrixClient, Room } from 'matrix-js-sdk';

export interface Space {
  id: string;
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
  const [isHomeActive, setIsHomeActive] = useState(true);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProfileEditorOpen, setIsProfileEditorOpen] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<CurrentUserProfile | null>(null);

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

  useEffect(() => {
    if (!matrixClient) return;

    function syncRooms() {
      const client = getClient();
      const allRooms: Room[] = client.getRooms();

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

      const channelRooms = allRooms.filter(
        (r) => r.currentState.getStateEvents('m.room.create', '')
          ?.getContent()?.type !== 'm.space'
      );

      setChannels(
        channelRooms.map((r) => {
          const parentSpace = spaceRooms.find((s) =>
            s.currentState.getStateEvents('m.space.child', r.roomId) != null
          );
          return {
            id: r.roomId,
            name: r.name,
            spaceId: parentSpace?.roomId ?? '',
          };
        })
      );
    }

    syncRooms();
    matrixClient.on('sync' as any, syncRooms);
    return () => { matrixClient.off('sync' as any, syncRooms); };
  }, [matrixClient]);

  useEffect(() => {
    if (!matrixClient) return;

    try {
      setCurrentUserProfile(getCurrentUserProfile());
    } catch {
      // Ignore initial profile read failures until sync settles.
    }

    return onCurrentUserProfileChanged(setCurrentUserProfile);
  }, [matrixClient]);

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
  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null;
  const activeSpace = spaces.find((s) => s.id === activeSpaceId) ?? null;
  const fallbackUserId = matrixClient.getUserId() ?? '@you:unknown';
  const profile = currentUserProfile ?? {
    userId: fallbackUserId,
    displayName: fallbackUserId.replace(/^@/, '').split(':')[0] || 'You',
    avatarMxcUrl: null,
    avatarUrl: null,
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#313338] text-white select-none">
      <ServerSidebar
        spaces={spaces}
        activeSpaceId={activeSpaceId}
        isHomeActive={isHomeActive}
        onSelectHome={() => {
          setIsHomeActive(true);
          setActiveSpaceId(null);
          setActiveChannelId(null);
        }}
        onSelectSpace={(id) => {
          setIsHomeActive(false);
          setActiveSpaceId(id);
          setActiveChannelId(null);
        }}
      />

      {isHomeActive ? (
        <HomeView
          matrixClient={matrixClient}
          currentUserDisplayName={profile.displayName}
          currentUserAvatarUrl={profile.avatarUrl}
          currentUserTag={profile.userId}
          onOpenProfile={() => setIsProfileEditorOpen(true)}
        />
      ) : (
        <>
          <ChannelList
            channels={activeChannels}
            activeChannelId={activeChannelId}
            spaceName={spaces.find((s) => s.id === activeSpaceId)?.name ?? ''}
            currentUserDisplayName={profile.displayName}
            currentUserAvatarUrl={profile.avatarUrl}
            currentUserTag={profile.userId}
            onOpenProfile={() => setIsProfileEditorOpen(true)}
            onSelectChannel={setActiveChannelId}
            activeSpaceId={activeSpaceId}
            onSpaceLeft={() => {
              setActiveSpaceId(null);
              setActiveChannelId(null);
            }}
            onSpaceCreated={(space) => setSpaces((prev) => [...prev, space])}
            onChannelCreated={(channel) => setChannels((prev) => [...prev, channel])}
          />

          <ChatWindow
            channelId={activeChannelId}
            matrixClient={matrixClient}
          />

          <MemberList
            activeSpaceId={activeSpaceId}
            activeChannelId={activeChannelId}
            activeSpaceName={activeSpace?.name ?? ''}
            activeChannelName={activeChannel?.name ?? ''}
          />
        </>
      )}

      <ProfileEditorModal
        isOpen={isProfileEditorOpen}
        profile={profile}
        onClose={() => setIsProfileEditorOpen(false)}
        onSaved={setCurrentUserProfile}
      />
    </div>
  );
}