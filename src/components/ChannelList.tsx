import { useState } from 'react';
import type { Channel, Space } from '../App';
import {
  createSpace,
  createChannel,
  inviteUserToSpace,
  inviteUserToChannel,
} from '../lib/matrixClient';

interface Props {
  channels: Channel[];
  activeChannelId: string | null;
  spaceName: string;
  onSelectChannel: (id: string) => void;
  activeSpaceId: string | null;
  onSpaceCreated: (space: Space) => void;
  onChannelCreated: (channel: Channel) => void;
}

export function ChannelList({
  channels,
  activeChannelId,
  spaceName,
  onSelectChannel,
  activeSpaceId,
  onSpaceCreated,
  onChannelCreated,
}: Props) {
  const [creatingSpace, setCreatingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [creatingChannel, setCreatingChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [spaceInviteUser, setSpaceInviteUser] = useState('');
  const [channelInviteUser, setChannelInviteUser] = useState('');
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  async function handleCreateSpace() {
    if (!newSpaceName.trim()) return;
    const roomId = await createSpace({ name: newSpaceName.trim() });
    onSpaceCreated({ id: roomId, name: newSpaceName.trim() });
    setNewSpaceName('');
    setCreatingSpace(false);
  }

  async function handleCreateChannel() {
    if (!newChannelName.trim() || !activeSpaceId) return;
    const roomId = await createChannel(activeSpaceId, newChannelName.trim());
    onChannelCreated({ id: roomId, name: newChannelName.trim(), spaceId: activeSpaceId });
    setNewChannelName('');
    setCreatingChannel(false);
  }

  async function handleInviteToSpace() {
    if (!activeSpaceId || !spaceInviteUser.trim()) return;
    setInviteError(null);
    setInviteStatus(null);
    try {
      await inviteUserToSpace(activeSpaceId, spaceInviteUser);
      setInviteStatus(`Invited ${spaceInviteUser.trim()} to this space.`);
      setSpaceInviteUser('');
    } catch (e: any) {
      setInviteError(e?.message ?? 'Failed to invite user to space');
    }
  }

  async function handleInviteToChannel() {
    if (!activeChannelId || !channelInviteUser.trim()) return;
    setInviteError(null);
    setInviteStatus(null);
    try {
      await inviteUserToChannel(activeChannelId, channelInviteUser);
      setInviteStatus(`Invited ${channelInviteUser.trim()} to this channel.`);
      setChannelInviteUser('');
    } catch (e: any) {
      setInviteError(e?.message ?? 'Failed to invite user to channel');
    }
  }

  return (
    <aside className="flex w-60 flex-col bg-[#2b2d31]">
      <div className="flex h-12 items-center justify-between border-b border-[#1e1f22] px-4 shadow-sm">
        <span className="font-semibold text-white truncate">{spaceName || 'Select a Space'}</span>
      </div>

      {!activeSpaceId && (
        <div className="p-3">
          {creatingSpace ? (
            <div className="flex flex-col gap-2">
              <input
                autoFocus
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSpace()}
                placeholder="Space name…"
                className="rounded bg-[#1e1f22] px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button onClick={handleCreateSpace} className="flex-1 rounded bg-indigo-600 py-1 text-xs text-white hover:bg-indigo-500">
                  Create
                </button>
                <button onClick={() => setCreatingSpace(false)} className="flex-1 rounded bg-[#36393f] py-1 text-xs text-[#b5bac1]">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreatingSpace(true)}
              className="w-full rounded bg-indigo-600 py-2 text-sm text-white hover:bg-indigo-500"
            >
              + Create Private Space
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {activeSpaceId && (
          <div className="mb-3 rounded bg-[#232428] p-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
              Invite to Space
            </p>
            <div className="flex gap-1">
              <input
                value={spaceInviteUser}
                onChange={(e) => setSpaceInviteUser(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleInviteToSpace()}
                placeholder="@user:server or username"
                className="flex-1 rounded bg-[#1e1f22] px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                onClick={handleInviteToSpace}
                disabled={!spaceInviteUser.trim()}
                className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                Invite
              </button>
            </div>

            {activeChannelId && (
              <>
                <p className="mb-2 mt-3 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
                  Invite to Channel
                </p>
                <div className="flex gap-1">
                  <input
                    value={channelInviteUser}
                    onChange={(e) => setChannelInviteUser(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInviteToChannel()}
                    placeholder="@user:server or username"
                    className="flex-1 rounded bg-[#1e1f22] px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleInviteToChannel}
                    disabled={!channelInviteUser.trim()}
                    className="rounded bg-indigo-600 px-2 py-1 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
                  >
                    Invite
                  </button>
                </div>
              </>
            )}

            {inviteError && <p className="mt-2 text-xs text-red-400">{inviteError}</p>}
            {inviteStatus && <p className="mt-2 text-xs text-green-400">{inviteStatus}</p>}
          </div>
        )}

        <div className="mb-1 flex items-center justify-between px-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[#949ba4]">
            Text Channels
          </span>
          {activeSpaceId && (
            <button
              onClick={() => setCreatingChannel(true)}
              className="text-[#949ba4] hover:text-white"
              title="Create channel"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          )}
        </div>

        {creatingChannel && (
          <div className="mb-2 flex flex-col gap-1 px-2">
            <input
              autoFocus
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateChannel();
                if (e.key === 'Escape') setCreatingChannel(false);
              }}
              placeholder="channel-name"
              className="rounded bg-[#1e1f22] px-2 py-1 text-sm text-white outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

        {channels.map((ch) => (
          <button
            key={ch.id}
            onClick={() => onSelectChannel(ch.id)}
            className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm transition ${
              ch.id === activeChannelId
                ? 'bg-[#404249] text-white'
                : 'text-[#949ba4] hover:bg-[#35373c] hover:text-[#dcddde]'
            }`}
          >
            <span className="text-base">#</span>
            <span className="truncate">{ch.name}</span>
          </button>
        ))}
      </div>

      <div className="flex h-14 items-center gap-2 bg-[#232428] px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
          U
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-medium text-white">You</span>
          <span className="text-xs text-[#949ba4]">#0001</span>
        </div>
      </div>
    </aside>
  );
}