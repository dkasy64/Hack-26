import { useState } from 'react';

interface Props {
  onLogin: (username: string, password: string) => void | Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function LoginScreen({ onLogin, isLoading, error }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#313338]">
      <div className="w-full max-w-sm rounded-lg bg-[#2b2d31] p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">Welcome back!</h1>
        <p className="mb-6 text-center text-sm text-[#b5bac1]">
          Connect to your local Synapse server
        </p>

        {error && (
          <div className="mb-4 rounded bg-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLogin(username, password)}
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="@user:localhost"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLogin(username, password)}
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={() => onLogin(username, password)}
            disabled={isLoading || !username || !password}
            className="w-full rounded bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? 'Connecting…' : 'Log In'}
          </button>
        </div>
      </div>
    </div>
  );
}
