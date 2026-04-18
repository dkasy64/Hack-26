import { useState, useEffect } from 'react';
import { getUserProfile, getRemoteUserProfile, getBio, getClient } from '../lib/matrixClient';

interface Props {
  userId: string;
  onClose: () => void;
}

export function ProfileModal({ userId, onClose }: Props) {
  const [profile, setProfile] = useState<{ displayName?: string; avatarUrl?: string | null } | null>(null);
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(true);
  const isSelf = userId === getClient().getUserId();

  useEffect(() => {
    async function loadProfile() {
      try {
        setProfile(getUserProfile(userId));

        const profileData = await getRemoteUserProfile(userId);
        setProfile({
          displayName: profileData.displayName,
          avatarUrl: profileData.avatarUrl,
        });

        if (isSelf) {
          const bioData = await getBio();
          setBio(bioData);
        }
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [userId, isSelf]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
        <div className="rounded-lg bg-[#2b2d31] p-6 text-white">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  const displayName = profile?.displayName || userId.split(':')[0].replace('@', '');
  const avatarUrl = profile?.avatarUrl ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div className="w-96 rounded-lg bg-[#2b2d31] p-6 text-white shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Profile</h2>
          <button onClick={onClose} className="text-[#949ba4] hover:text-white">✕</button>
        </div>
        <div className="flex flex-col items-center">
          <div className="mb-4 h-24 w-24 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full rounded-full object-cover" />
            ) : (
              displayName.slice(0, 2).toUpperCase()
            )}
          </div>
          <h3 className="text-xl font-semibold mb-2">{displayName}</h3>
          <p className="text-sm text-[#b5bac1] mb-4">{userId}</p>
          {isSelf && bio && (
            <div className="w-full">
              <p className="text-sm font-semibold text-[#949ba4] mb-1">Bio</p>
              <p className="text-sm text-[#dcddde]">{bio}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
