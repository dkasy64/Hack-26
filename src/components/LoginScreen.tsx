import { useEffect, useState } from 'react';

const HOMESERVER_STORAGE_KEY = 'hackqu.lastHomeserver';
const DEFAULT_HOMESERVER = 'http://10.111.110.222:8008';

type HomeserverMode = 'default' | 'custom';

interface Props {
  onLogin: (username: string, password: string, homeserver: string) => void | Promise<void>;
  onRegister: (username: string, password: string, homeserver: string) => void | Promise<void>;
  isLoading: boolean;
  error: string | null;
}

export function LoginScreen({ onLogin, onRegister, isLoading, error }: Props) {
  const [customHomeserver, setCustomHomeserver] = useState(() => {
    const saved = window.localStorage.getItem(HOMESERVER_STORAGE_KEY);
    return saved && saved.trim().length > 0 ? saved : DEFAULT_HOMESERVER;
  });
  const [homeserverMode, setHomeserverMode] = useState<HomeserverMode>(() => {
    const saved = window.localStorage.getItem(HOMESERVER_STORAGE_KEY);
    if (!saved || saved.trim().length === 0) return 'default';
    return saved.trim() === DEFAULT_HOMESERVER ? 'default' : 'custom';
  });
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const homeserver = homeserverMode === 'default' ? DEFAULT_HOMESERVER : customHomeserver;

  useEffect(() => {
    window.localStorage.setItem(HOMESERVER_STORAGE_KEY, homeserver);
  }, [homeserver]);

  const canSubmit =
    homeserver.trim().length > 0
    &&
    username.trim().length > 0
    && password.length > 0
    && (!isRegisterMode || (confirmPassword.length > 0 && password === confirmPassword));

  function submit() {
    if (!canSubmit || isLoading) return;

    if (isRegisterMode) {
      onRegister(username, password, homeserver);
      return;
    }

    onLogin(username, password, homeserver);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#313338]">
      <div className="w-full max-w-sm rounded-lg bg-[#2b2d31] p-8 shadow-xl">
        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          {isRegisterMode ? 'Create account' : 'Welcome back!'}
        </h1>
        <p className="mb-6 text-center text-sm text-[#b5bac1]">
          {isRegisterMode
            ? 'Create a Matrix account on your chosen homeserver'
            : 'Connect to your Matrix homeserver'}
        </p>

        {error && (
          <div className="mb-4 rounded bg-red-500/20 px-3 py-2 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
              Homeserver
            </label>
            <select
              value={homeserverMode}
              onChange={(e) => setHomeserverMode(e.target.value as HomeserverMode)}
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="default">Default (10.111.110.222:8008)</option>
              <option value="custom">Custom homeserver</option>
            </select>
          </div>

          {homeserverMode === 'custom' && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
                Custom Homeserver URL
              </label>
              <input
                type="text"
                value={customHomeserver}
                onChange={(e) => setCustomHomeserver(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://matrix.org"
              />
            </div>
          )}

          {homeserverMode === 'default' && (
            <p className="text-xs text-[#b5bac1]">Using {DEFAULT_HOMESERVER}</p>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="alice"
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
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {isRegisterMode && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {confirmPassword.length > 0 && password !== confirmPassword && (
                <p className="mt-1 text-xs text-red-400">Passwords do not match.</p>
              )}
            </div>
          )}

          <button
            onClick={submit}
            disabled={isLoading || !canSubmit}
            className="w-full rounded bg-indigo-600 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading
              ? (isRegisterMode ? 'Creating account…' : 'Connecting…')
              : (isRegisterMode ? 'Create Account' : 'Log In')}
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegisterMode((prev) => !prev);
              setConfirmPassword('');
            }}
            disabled={isLoading}
            className="w-full text-center text-xs font-semibold text-[#b5bac1] underline-offset-2 transition hover:text-white hover:underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRegisterMode ? 'Already have an account? Log in' : 'Need an account? Create one'}
          </button>
        </div>
      </div>
    </div>
  );
}
