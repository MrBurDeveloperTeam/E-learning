// Meowdoku predates the shared `@mrburdeveloperteam/molar-experience`
// package and isn't one of its 3 built-in games (flappy-cat/pac-cat/
// tetris — those are now handled entirely inside the shared package's
// own Pet UI). This is an E-learning-local launcher extracted from the
// legacy `src/VirtualPet/components/GamePage.tsx` (now deleted) so
// Meowdoku keeps working after that legacy directory is retired.
//
// Coin bridge: the legacy version read/wrote coins through the local
// `useGameState` hook's `stats`/`setStats` — the same local state the
// legacy Pet UI persisted via a raw, non-atomic upsert. That local state
// no longer exists. Coin reads/writes here go through
// `elearningPetRepository`'s atomic `mutateCoins` RPC instead, the same
// one the shared Pet runtime itself uses, so Meowdoku and the shared Pet
// stay on one consistent, race-free coin balance rather than forking
// into two divergent local copies.
//
// Known, deliberate simplification: the legacy version also nudged the
// pet's `happiness` stat by +15 on a coin reward. There is no atomic
// RPC for that (only coins/inventory/XP have one), and bolting a
// read-modify-write onto `saveSnapshot` here would risk racing the
// shared Pet's own debounced snapshot save. Dropped for this release
// rather than reintroducing an unguarded write path.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { elearningPetRepository } from '../petExperience/elearningPetRepository';

const GAME_BUILD = '20260817-meowdoku-1';
const MEOWDOKU_URL = `/games/meowdoku/index.html?v=${GAME_BUILD}`;
const DEFAULT_COINS = 100;

interface MeowdokuLauncherProps {
  disabled?: boolean;
  userId: string | null;
}

export default function MeowdokuLauncher({ disabled = false, userId }: MeowdokuLauncherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [coins, setCoins] = useState(DEFAULT_COINS);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const coinsRef = useRef(coins);
  coinsRef.current = coins;

  const postToGame = (message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, window.location.origin);
  };

  const loadCurrentCoins = async () => {
    if (!userId) return DEFAULT_COINS;
    try {
      const snapshot = await elearningPetRepository.loadSnapshot(userId);
      return snapshot?.stats.coins ?? DEFAULT_COINS;
    } catch (error) {
      console.error('[MeowdokuLauncher] Failed to load coin balance:', error);
      return coinsRef.current;
    }
  };

  const loadMeowdokuAchievements = async () => {
    const { data, error } = await supabase.rpc('meowdoku_get_achievements');
    postToGame(error
      ? { type: 'MEOWDOKU_ACHIEVEMENTS_ERROR', message: error.message }
      : { type: 'MEOWDOKU_ACHIEVEMENTS', achievements: data });
  };

  const loadMeowdokuCheckIn = async () => {
    const { data, error } = await supabase.rpc('meowdoku_get_check_in');
    postToGame(error
      ? { type: 'MEOWDOKU_CHECK_IN_ERROR', message: error.message }
      : { type: 'MEOWDOKU_CHECK_IN', checkIn: data });
  };

  const loadMeowdokuProgress = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      postToGame({ type: 'MEOWDOKU_PROGRESS_LOCAL_ONLY' });
      return;
    }
    const { data, error } = await supabase.rpc('meowdoku_get_mode_progress');
    if (error) {
      console.error('Unable to load Meowdoku progress:', error);
      postToGame({ type: 'MEOWDOKU_PROGRESS_LOCAL_ONLY' });
      return;
    }
    postToGame({
      type: 'MEOWDOKU_PROGRESS',
      progress: data,
    });
  };

  const initializeMeowdoku = async () => {
    await loadMeowdokuProgress();
    await Promise.all([loadMeowdokuCheckIn(), loadMeowdokuAchievements()]);
  };

  const saveMeowdokuProgress = async (payload: {
    unlocked_level: number;
    completed_modes: Record<string, unknown>;
  }) => {
    const { data, error } = await supabase.rpc('meowdoku_complete_mode_with_achievements', payload);
    if (error) {
      console.error('Unable to save Meowdoku progress:', error);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (Array.isArray(result?.new_achievements) && result.new_achievements.length > 0) {
      postToGame({ type: 'MEOWDOKU_ACHIEVEMENTS_UNLOCKED', achievements: result.new_achievements });
    }
    await Promise.all([loadMeowdokuProgress(), loadMeowdokuAchievements()]);
  };

  const recordMeowdokuCatFound = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.rpc('meowdoku_record_cat_found', payload);
    if (error) {
      console.error('Unable to save Meowdoku cat discovery:', error);
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (Array.isArray(result?.new_achievements) && result.new_achievements.length > 0) {
      postToGame({ type: 'MEOWDOKU_ACHIEVEMENTS_UNLOCKED', achievements: result.new_achievements });
    }
    await loadMeowdokuAchievements();
  };

  const claimMeowdokuCheckIn = async () => {
    const { data, error } = await supabase.rpc('meowdoku_claim_check_in');
    if (error) {
      postToGame({ type: 'MEOWDOKU_CHECK_IN_ERROR', message: error.message });
      return;
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (result?.coins != null) {
      const nextCoins = Number(result.coins) || coinsRef.current;
      setCoins(nextCoins);
    }
    postToGame({ type: 'MEOWDOKU_CHECK_IN_CLAIMED', checkIn: result });
    if (Array.isArray(result?.new_achievements) && result.new_achievements.length > 0) {
      postToGame({ type: 'MEOWDOKU_ACHIEVEMENTS_UNLOCKED', achievements: result.new_achievements });
    }
    await loadMeowdokuAchievements();
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleMessage = async (event: MessageEvent) => {
      if (
        event.origin !== window.location.origin ||
        event.source !== iframeRef.current?.contentWindow
      ) return;

      switch (event.data?.type) {
        case 'MEOWDOKU_READY':
          postToGame({ type: 'MEOWDOKU_WALLET', coins: coinsRef.current });
          void initializeMeowdoku();
          break;
        case 'MEOWDOKU_SAVE_PROGRESS':
          void saveMeowdokuProgress(event.data.progress || {});
          break;
        case 'MEOWDOKU_CAT_FOUND':
          void recordMeowdokuCatFound(event.data || {});
          break;
        case 'MEOWDOKU_GET_CHECK_IN':
          void loadMeowdokuCheckIn();
          break;
        case 'MEOWDOKU_CLAIM_CHECK_IN':
          void claimMeowdokuCheckIn();
          break;
        case 'MEOWDOKU_GET_ACHIEVEMENTS':
          void loadMeowdokuAchievements();
          break;
        case 'MEOWDOKU_SPEND_COINS': {
          const amount = Math.max(0, Math.floor(Number(event.data.amount) || 0));
          const requestId = String(event.data.requestId || '');
          if (amount <= 0 || !userId) {
            postToGame({ type: 'MEOWDOKU_SPEND_RESULT', requestId, ok: false });
            break;
          }
          try {
            const nextCoins = await elearningPetRepository.mutateCoins!(userId, -amount);
            setCoins(nextCoins);
            postToGame({ type: 'MEOWDOKU_SPEND_RESULT', requestId, ok: true });
          } catch (error) {
            console.error('[MeowdokuLauncher] mutateCoins spend failed:', error);
            postToGame({ type: 'MEOWDOKU_SPEND_RESULT', requestId, ok: false });
          }
          break;
        }
        case 'MEOWDOKU_REWARD': {
          const reward = Math.max(0, Math.min(1000, Math.floor(Number(event.data.coins) || 0)));
          if (reward > 0 && userId) {
            try {
              const nextCoins = await elearningPetRepository.mutateCoins!(userId, reward);
              setCoins(nextCoins);
            } catch (error) {
              console.error('[MeowdokuLauncher] mutateCoins reward failed:', error);
            }
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleOpen = async () => {
    setIsLoading(true);
    const currentCoins = await loadCurrentCoins();
    setCoins(currentCoins);
    setIsOpen(true);
  };

  if (disabled) return null;

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Play Meowdoku"
        title="Meowdoku"
        className="fixed bottom-6 left-6 z-[9996] flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-white/80 text-2xl shadow-xl backdrop-blur-md transition-transform hover:scale-105 active:scale-95"
      >
        🐱
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black" style={{ fontFamily: "'Fredoka', sans-serif" }}>
          <div className="relative h-full w-full">
            <div
              className="absolute z-[70] flex items-center"
              style={{
                top: 'max(8px, env(safe-area-inset-top, 0px))',
                right: 'max(8px, env(safe-area-inset-right, 0px))',
                gap: 'clamp(6px, 1.8vmin, 12px)',
              }}
            >
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-white shadow-lg backdrop-blur-md">
                <span>💰</span>
                <span className="min-w-[3ch] text-right font-black tracking-widest">{coins}</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Meowdoku"
                title="Close"
                className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-white/10 bg-black/40 text-white/70 shadow-lg backdrop-blur-sm transition-all hover:scale-110 hover:bg-black/80 hover:text-white active:scale-95"
              >
                <span className="text-xl font-bold leading-none">×</span>
              </button>
            </div>

            <div className="absolute inset-0 bg-slate-900">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900">
                  <div className="flex flex-col items-center gap-4">
                    <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-white" />
                    <span className="text-sm text-white/60">Loading Meowdoku...</span>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={MEOWDOKU_URL}
                className="block h-full w-full border-0"
                title="Meowdoku"
                onLoad={() => setIsLoading(false)}
                allow="autoplay; fullscreen"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
