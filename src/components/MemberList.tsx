import { useEffect, useState } from 'react';
import {
  getRoomMembers,
  onRoomMembersChanged,
  type RoomMemberInfo,
} from '../lib/matrixClient';

interface Props {
  activeSpaceId: string | null;
  activeChannelId: string | null;
  activeSpaceName: string;
  activeChannelName: string;
}

export function MemberList({
  activeSpaceId,
  activeChannelId,
  activeSpaceName,
  activeChannelName,
}: Props) {
  const [spaceMembers, setSpaceMembers] = useState<RoomMemberInfo[]>([]);
  const [channelMembers, setChannelMembers] = useState<RoomMemberInfo[]>([]);

  useEffect(() => {
    if (!activeSpaceId) {
      setSpaceMembers([]);
      return;
    }

    setSpaceMembers(getRoomMembers(activeSpaceId));
    return onRoomMembersChanged(activeSpaceId, setSpaceMembers);
  }, [activeSpaceId]);

  useEffect(() => {
    if (!activeChannelId) {
      setChannelMembers([]);
      return;
    }

    setChannelMembers(getRoomMembers(activeChannelId));
    return onRoomMembersChanged(activeChannelId, setChannelMembers);
  }, [activeChannelId]);

  return (
    <aside className="flex w-64 flex-col border-l border-[#1e1f22] bg-[#2b2d31]">
      <div className="flex h-12 items-center border-b border-[#1e1f22] px-4">
        <span className="text-sm font-semibold text-white">Members</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!activeSpaceId && !activeChannelId && (
          <p className="text-xs text-[#949ba4]">Select a space or channel to view members.</p>
        )}

        {activeSpaceId && (
          <MemberSection
            title={activeSpaceName ? `Space: ${activeSpaceName}` : 'Space Members'}
            members={spaceMembers}
          />
        )}

        {activeChannelId && (
          <MemberSection
            title={activeChannelName ? `Channel: #${activeChannelName}` : 'Channel Members'}
            members={channelMembers}
          />
        )}
      </div>
    </aside>
  );
}

function MemberSection({ title, members }: { title: string; members: RoomMemberInfo[] }) {
  return (
    <section className="mb-4">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[#949ba4]">
        {title} ({members.length})
      </h3>

      {members.length === 0 ? (
        <p className="rounded bg-[#232428] px-2 py-1 text-xs text-[#949ba4]">No visible members.</p>
      ) : (
        <ul className="space-y-1">
          {members.map((member) => {
            const shortName = member.displayName.replace(/^@/, '').split(':')[0] || member.displayName;
            return (
              <li key={`${member.membership}-${member.userId}`} className="flex items-center justify-between rounded bg-[#232428] px-2 py-1.5">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
                    {shortName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="truncate text-xs text-white">{shortName}</span>
                </div>
                <span
                  className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                    member.membership === 'join'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-yellow-500/20 text-yellow-300'
                  }`}
                >
                  {member.membership}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}