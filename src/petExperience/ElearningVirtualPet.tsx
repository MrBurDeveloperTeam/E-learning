// PHASE 6E (Virtual Pet migration): thin host wrapper around
// `@mrburdeveloperteam/molar-experience/pet`'s <SharedVirtualPet>.
//
// Everything generic (room UI, adoption UI, shop/inventory UI, stat
// runtime/decay tick, XP/level/coin arithmetic, mini-game embedding shell,
// landscape/fullscreen handling) now lives in the shared package —
// confirmed byte-identical to E-Learning's own pre-migration
// `VirtualPet/context/GameStateContext.tsx` / `components/GamePage.tsx` by
// reading the installed `dist/pet.js` directly. What stays here, unchanged
// from the old `VirtualPet/VirtualPetContainer.tsx`, is exactly what's
// genuinely E-Learning-specific and Supabase-coupled:
//   - IP geolocation + currency detection (`detectAndLogVisit`,
//     `virtual_pet_visits` writes) — byte-identical to the pre-migration
//     source, ported mechanically.
//   - Resolving the authenticated user id via `supabase.auth.getSession()`
//     internally, exactly as the original `GameStateContext` /
//     `VirtualPetContainer` already did — E-Learning's own Pet code has
//     never trusted a host-composition-passed user id, so this preserves
//     its current effective identity semantics rather than introducing a
//     new boundary. (`App.tsx`'s own `session` — from `useAuth()` — has no
//     placeholder/default-user object the way To-Do's `AppUser` state
//     does, but there is no reason to diverge from what E-Learning's own
//     Pet code already does today.)
//
// The old `VirtualPetContainer.tsx` also toggled
// `document.body.style.overflow` ('hidden'/'auto') on open/close — dropped
// here since `SharedVirtualPet` already performs the exact same toggle
// internally (confirmed by reading `dist/pet.js`); keeping it host-side
// too would just be a redundant second write to the same style property,
// not a behavior difference.
import { useEffect, useRef, useState } from 'react';
import { SharedVirtualPet, type ExtraGame } from '@mrburdeveloperteam/molar-experience/pet';
import { supabase } from '../lib/supabase';
import { elearningPetRepository } from './elearningPetRepository';
import { PET_ASSET_URLS } from '../aiExperience/molarExperienceAssets';

interface GeoInfo {
  ip: string;
  country_name: string;
  country_code: string;
  city: string;
  region: string;
  timezone: string;
  currency: string; // e.g. "MYR", "USD", "EUR"
}

const DEFAULT_CURRENCY_CODE = 'USD';

const normalizeCurrencyCode = (currency?: string | null) => {
  const normalized = (currency || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalized) ? normalized : DEFAULT_CURRENCY_CODE;
};

const getSupportedPricingCurrency = async (currency?: string | null): Promise<string> => {
  const requestedCurrency = normalizeCurrencyCode(currency);
  if (requestedCurrency === DEFAULT_CURRENCY_CODE) return DEFAULT_CURRENCY_CODE;

  try {
    const { data, error } = await supabase
      .from('aiboard_pricing_currencies')
      .select('currency_code')
      .ilike('currency_code', requestedCurrency)
      .maybeSingle();

    if (!error && data?.currency_code) {
      return normalizeCurrencyCode(data.currency_code);
    }
  } catch (err) {
    console.warn('[Currency] Failed to verify pricing currency:', err);
  }

  console.warn(`[Currency] ${requestedCurrency} is not configured in aiboard_pricing_currencies. Using USD.`);
  return DEFAULT_CURRENCY_CODE;
};

// Detect IP/country and log the visit to Supabase
// Fallback chain: ipapi.co → last stored visit currency → 'USD'
async function detectAndLogVisit(): Promise<string> {
  // --- Attempt 1: Live geolocation ---
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const geo: GeoInfo = await res.json();

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id ?? null;

      if (userId) {
        const { error: visitError } = await supabase.from('virtual_pet_visits').upsert(
          {
            user_id: userId,
            ip: geo.ip,
            country: geo.country_name,
            country_code: geo.country_code,
            city: geo.city,
            region: geo.region,
            timezone: geo.timezone,
            currency: normalizeCurrencyCode(geo.currency),
            visited_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        );

        if (visitError) {
          console.warn('[VirtualPet] Could not save visit location:', visitError.message);
        }
      }

      console.log(`[VirtualPet] Visit logged — ${geo.city}, ${geo.country_name} (${geo.currency})`);
      return getSupportedPricingCurrency(geo.currency);
    }
  } catch {
    console.warn('[VirtualPet] Geolocation failed, trying stored record...');
  }

  // --- Attempt 2: Use last known currency from Supabase ---
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id ?? null;

    if (userId) {
      const { data: lastVisit } = await supabase
        .from('virtual_pet_visits')
        .select('currency')
        .eq('user_id', userId)
        .not('currency', 'is', null)
        .order('visited_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastVisit?.currency) {
        console.log(`[VirtualPet] Using stored currency: ${lastVisit.currency}`);
        return getSupportedPricingCurrency(lastVisit.currency);
      }
    }
  } catch {
    console.warn('[VirtualPet] Could not fetch stored visit currency.');
  }

  // --- Fallback: USD ---
  return DEFAULT_CURRENCY_CODE;
}

interface ElearningVirtualPetProps {
  isOpen: boolean;
  onClose: () => void;
  /** molar-experience 0.9.5's host-extension games — see `ExtraGame`'s
   *  own doc in the shared package. Passed straight through. */
  extraGames?: ExtraGame[];
}

export default function ElearningVirtualPet({ isOpen, onClose, extraGames }: ElearningVirtualPetProps) {
  const hasLoggedRef = useRef(false);
  const [detectedCurrency, setDetectedCurrency] = useState(DEFAULT_CURRENCY_CODE);
  const [userId, setUserId] = useState<string | null>(null);
  // Distinguishes "identity still unknown" (initial getSession() hasn't
  // resolved yet) from "confirmed no authenticated user" — both start out
  // looking like `userId === null`, but only the latter is a legitimate
  // reason to treat this as a logged-out visitor. Mounting SharedVirtualPet
  // while identity is merely unknown was the root cause of the account
  // hydration race: its own internal hydration effect runs exactly once on
  // mount and skips the backend load entirely when `userId` is falsy at
  // that moment, silently falling back to starter/local state even for an
  // authenticated user whose session just hadn't resolved yet.
  const [authResolved, setAuthResolved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) {
          setUserId(session?.user?.id || null);
          setAuthResolved(true);
        }
      } catch (err) {
        console.error('Error fetching session in ElearningVirtualPet:', err);
        // Resolution genuinely failed rather than merely being in-flight —
        // still surface this as "no session" so the Pet doesn't stay stuck
        // pretending identity is unknown forever.
        if (!cancelled) {
          setUserId(null);
          setAuthResolved(true);
        }
      }
    })();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUserId(session?.user?.id || null);
      setAuthResolved(true);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Detect geo only once per open session
      if (!hasLoggedRef.current) {
        hasLoggedRef.current = true;
        detectAndLogVisit().then((currency) => {
          setDetectedCurrency(currency);
        });
      }
    } else {
      hasLoggedRef.current = false; // Reset so next open logs again
    }
  }, [isOpen]);

  // Identity must be confirmed — not merely "not yet known" — before the
  // Shared runtime is allowed to mount at all. `authResolved === false`
  // means UNKNOWN, never "logged out"; the previous code passed
  // `userId={null}` at that stage too, but never delayed mounting
  // SharedVirtualPet on it, letting its one-shot hydration effect run
  // against a not-yet-real `null` and permanently skip the backend load
  // for that mount's lifetime. `key={userId}` below additionally forces a
  // fresh mount (and therefore a fresh hydration run) whenever the
  // authenticated account itself actually changes, so switching accounts
  // in the same tab can never retain the previous account's in-memory
  // state.
  if (!authResolved || !userId) return null;

  return (
    <SharedVirtualPet
      key={userId}
      isOpen={isOpen}
      onClose={onClose}
      repository={elearningPetRepository}
      userId={userId}
      currencyCode={detectedCurrency}
      assetUrls={PET_ASSET_URLS}
      extraGames={extraGames}
    />
  );
}
