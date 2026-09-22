// src/hooks/useProfileImage.ts
import { useState, useEffect } from "react";
import { fetchAccountProfile } from "../lib/accountProfile";

export function useProfileImage(isLoggedIn: boolean | null) {
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setProfileImageUrl(null);
      return;
    }

    let active = true;
    fetchAccountProfile()
      .then((profile) => {
        if (active) setProfileImageUrl(profile.imageUrl);
      })
      .catch(() => {
        if (active) setProfileImageUrl(null);
      });

    return () => { active = false; };
  }, [isLoggedIn]); // ← re-run when login state changes

  return { profileImageUrl };
}
