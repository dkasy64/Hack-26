/**
 * TEAMMATE A — Left rail showing Space icons (like Discord server icons)
 */

import type { Space } from '../App';

interface Props {
  spaces: Space[];
  activeSpaceId: string | null;
  isHomeActive: boolean;
  onSelectHome: () => void;
  onSelectSpace: (id: string) => void;
}

function SpaceIcon({ space, active, onClick }: { space: Space; active: boolean; onClick: () => void }) {
  const initials = space.name.slice(0, 2).toUpperCase();

  return (
    <div className="group relative flex items-center" onClick={onClick}>
      {/* Active pill indicator */}
      <div
        className={`absolute -left-3 h-10 w-1 rounded-r-full bg-white transition-all duration-200 ${
          active ? 'opacity-100' : 'opacity-0 group-hover:h-5 group-hover:opacity-100'
        }`}
      />
      <button
        className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-[24px] text-sm font-bold transition-all duration-200 group-hover:rounded-[16px] ${
          active
            ? 'rounded-[16px] bg-indigo-600 text-white'
            : 'bg-[#36393f] text-[#dcddde] hover:bg-indigo-600 hover:text-white'
        }`}
      >
        {space.emoji ?? initials}
      </button>
    </div>
  );
}

export function ServerSidebar({ spaces, activeSpaceId, isHomeActive, onSelectHome, onSelectSpace }: Props) {
  return (
    <nav className="flex w-[72px] flex-col items-center gap-2 overflow-y-auto bg-[#1e1f22] py-3">
      {/* Home button */}
      <button
        onClick={onSelectHome}
        className={`flex h-12 w-12 items-center justify-center rounded-[24px] text-white transition-all hover:rounded-[16px] ${
          isHomeActive ? 'bg-indigo-600' : 'bg-[#36393f] hover:bg-indigo-600'
        }`}
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
        </svg>
      </button>

      <div className="my-1 h-px w-8 bg-[#35373c]" />

      {spaces.map((space) => (
        <SpaceIcon
          key={space.id}
          space={space}
          active={space.id === activeSpaceId}
          onClick={() => onSelectSpace(space.id)}
        />
      ))}

      {/* Add Space button */}
      <button className="mt-1 flex h-12 w-12 items-center justify-center rounded-[24px] bg-[#36393f] text-green-400 transition-all hover:rounded-[16px] hover:bg-green-500 hover:text-white">
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </nav>
  );
}
