import { useCallback, useState } from 'react';

export default function useSellerProfile({ API_BASE }) {
  const [userProfile, setUserProfile] = useState(null);

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/me`, {
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.user) {
        setUserProfile(data.user);
      } else {
        console.error(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [API_BASE]);

  return {
    userProfile,
    setUserProfile,
    fetchUserProfile
  };
}
