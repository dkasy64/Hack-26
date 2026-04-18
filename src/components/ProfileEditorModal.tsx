import { useEffect, useMemo, useState } from 'react';
import {
  updateCurrentUserProfile,
  type CurrentUserProfile,
} from '../lib/matrixClient';

interface Props {
  isOpen: boolean;
  profile: CurrentUserProfile;
  onClose: () => void;
  onSaved: (profile: CurrentUserProfile) => void;
}

export function ProfileEditorModal({ isOpen, profile, onClose, onSaved }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setDisplayName(profile.displayName);
    setSelectedFile(null);
    setError(null);
  }, [isOpen, profile.displayName]);

  const previewUrl = useMemo(() => {
    if (selectedFile) return URL.createObjectURL(selectedFile);
    return profile.avatarUrl;
  }, [selectedFile, profile.avatarUrl]);

  useEffect(() => {
    return () => {
      if (previewUrl && selectedFile) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl, selectedFile]);

  if (!isOpen) return null;

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    try {
      const updated = await updateCurrentUserProfile({
        displayName,
        avatarFile: selectedFile,
      });
      onSaved(updated);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  }

  const initials = (displayName || profile.displayName || 'You').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-md rounded-lg bg-[#2b2d31] p-5 shadow-2xl">
        <h2 className="text-lg font-semibold text-white">Edit Profile</h2>
        <p className="mt-1 text-xs text-[#949ba4]">Update your display name and avatar.</p>

        <div className="mt-4 flex items-center gap-3">
          {previewUrl ? (
            <img src={previewUrl} alt="Profile preview" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {initials}
            </div>
          )}

          <label className="cursor-pointer rounded bg-[#1e1f22] px-3 py-2 text-xs font-semibold text-white hover:bg-[#35373c]">
            Change Picture
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#b5bac1]">
            Display Name
          </label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            className="w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Your display name"
          />
        </div>

        <p className="mt-2 text-xs text-[#949ba4]">User ID: {profile.userId}</p>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="rounded bg-[#36393f] px-3 py-2 text-xs font-semibold text-[#dcddde] hover:bg-[#4a4d55] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !displayName.trim()}
            className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
