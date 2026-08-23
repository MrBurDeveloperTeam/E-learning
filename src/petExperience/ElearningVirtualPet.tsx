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
import { SharedVirtualPet } from '@mrburdeveloperteam/molar-experience/pet';
import { supabase } from '../lib/supabase';
import { elearningPetRepository } from './elearningPetRepository';

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
}

export default function ElearningVirtualPet({ isOpen, onClose }: ElearningVirtualPetProps) {
  const hasLoggedRef = useRef(false);
  const [detectedCurrency, setDetectedCurrency] = useState(DEFAULT_CURRENCY_CODE);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled) setUserId(session?.user?.id || null);
      } catch (err) {
        console.error('Error fetching session in ElearningVirtualPet:', err);
      }
    })();
    return () => { cancelled = true; };
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

  return (
    <SharedVirtualPet
      isOpen={isOpen}
      onClose={onClose}
      repository={elearningPetRepository}
      userId={userId}
      currencyCode={detectedCurrency}
    />
  );
}
