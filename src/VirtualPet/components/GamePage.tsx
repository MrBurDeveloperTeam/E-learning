import React, { useEffect, useState, useRef } from 'react';
import { TiArrowBack } from 'react-icons/ti';
import { useGameState } from '../hooks/useGameState';

const GAME_CONFIG: Record<string, { title: string; url: string; icon: string; gradient: string }> = {
    flappy: {
        title: 'Flappy Cat',
        url: '/games/flappy-cat/index.html',
        icon: '🕊️',
        gradient: 'from-yellow-400 to-orange-500'
    },
    paccat: {
        title: 'Pac-Cat',
        url: '/games/pac-cat/index.html',
        icon: '👻',
        gradient: 'from-blue-400 to-indigo-600'
    },
    tetris: {
        title: 'Tetris',
        url: '/games/tetris/index.html',
        icon: '🧱',
        gradient: 'from-red-400 to-pink-600'
    }
};

/**
 * Animated number component for the "increase" effect
 */
const AnimatedCounter: React.FC<{ value: number }> = ({ value }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const frameRef = useRef<number>(0);
    const startValue = useRef(value);
    const endValue = useRef(value);
    const startTime = useRef(0);
    const duration = 3000; // 1 second animation

    useEffect(() => {
        if (value === displayValue) return;

        // Reset animation state
        startValue.current = displayValue;
        endValue.current = value;
        startTime.current = performance.now();

        const animate = (now: number) => {
            const elapsed = now - startTime.current;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            const current = Math.floor(startValue.current + (endValue.current - startValue.current) * easedProgress);
            setDisplayValue(current);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            }
        };

        frameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameRef.current);
    }, [value]);

    return <span>{String(displayValue)}</span>;
};

interface GamePageProps {
    gameId: string;
    onClose: () => void;
    onExitApp: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ gameId, onClose, onExitApp }) => {
    const [isLoading, setIsLoading] = useState(true);
    const [isPortrait, setIsPortrait] = useState(false);
    const { stats, setStats } = useGameState();
    const [sessionCoins, setSessionCoins] = useState(0);
    const requiresLandscape = gameId === 'paccat' || gameId === 'tetris';

    const requestImmersiveMode = async () => {
        if (!requiresLandscape) return;

        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen?.();
            }
        } catch {
            // Fullscreen is unavailable on iOS Safari and some embedded browsers.
        }

        try {
            const orientation = screen.orientation as ScreenOrientation & {
                lock?: (orientation: 'landscape') => Promise<void>;
            };
            await orientation.lock?.('landscape');
        } catch {
            // The portrait notification remains visible when locking is unavailable.
        }
    };

    const leaveGame = async (onFinished: () => void) => {
        try {
            screen.orientation.unlock?.();
        } catch {
            // Orientation unlock is not supported everywhere.
        }

        try {
            if (document.fullscreenElement) await document.exitFullscreen?.();
        } catch {
            // Always allow navigation even if fullscreen exit is unavailable.
        }

        onFinished();
    };

    useEffect(() => {
        if (!requiresLandscape) {
            setIsPortrait(false);
            return;
        }

        const updateOrientation = () => {
            const width = window.visualViewport?.width || window.innerWidth;
            const height = window.visualViewport?.height || window.innerHeight;
            setIsPortrait(height > width);
        };

        updateOrientation();
        void requestImmersiveMode();
        window.addEventListener('resize', updateOrientation);
        window.addEventListener('orientationchange', updateOrientation);
        window.visualViewport?.addEventListener('resize', updateOrientation);

        return () => {
            window.removeEventListener('resize', updateOrientation);
            window.removeEventListener('orientationchange', updateOrientation);
            window.visualViewport?.removeEventListener('resize', updateOrientation);
            try {
                screen.orientation.unlock?.();
            } catch {
                // Orientation unlock is not supported everywhere.
            }
            if (document.fullscreenElement) {
                void document.exitFullscreen?.().catch(() => undefined);
            }
        };
    }, [requiresLandscape]);

    // Sync score from games
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            // Update temporary display score
            if (event.data?.type === 'GAME_SCORE_UPDATE') {
                const totalScore = event.data.score || 0;
                setSessionCoins(Math.floor(totalScore / 100));
            }

            // Persistence: Only add to official total when game ends
            if (event.data?.type === 'GAME_OVER') {
                const totalScore = event.data.score || 0;
                const reward = Math.floor(totalScore / 100);

                if (reward > 0) {
                    setStats(prev => ({
                        ...prev,
                        coins: (prev.coins || 0) + reward,
                        happiness: Math.min(100, (prev.happiness || 0) + 15)
                    }));
                }
                setSessionCoins(0); // Clear pending
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setStats]);

    // Prevent scroll when game is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = '';
        };
    }, []);

    if (!gameId || !GAME_CONFIG[gameId]) {
        onClose();
        return null;
    }

    const config = GAME_CONFIG[gameId];

    return (
        <div
            className="fixed inset-0 z-50 bg-black"
            style={{ fontFamily: "'Fredoka', sans-serif" }}
            onPointerDown={() => void requestImmersiveMode()}
        >
            {/* Container - Full Screen */}
            <div className="relative w-full h-full animate-in zoom-in-95 fade-in duration-300">

                {!(requiresLandscape && isPortrait) && (
                    <button
                        type="button"
                        onClick={() => void leaveGame(onExitApp)}
                        className="absolute left-[calc(env(safe-area-inset-left)_+_0.75rem)] top-[calc(env(safe-area-inset-top)_+_0.75rem)] z-[70] flex h-8 w-8 items-center justify-center rounded-lg border border-white/60 bg-white/75 p-0 text-slate-700 shadow-xl shadow-slate-900/10 backdrop-blur-md transition-all hover:-translate-x-0.5 hover:scale-105 hover:bg-white active:scale-95 sm:h-10 sm:w-10 sm:rounded-xl lg:left-[calc(env(safe-area-inset-left)_+_1.5rem)] lg:top-[calc(env(safe-area-inset-top)_+_1.5rem)] lg:h-14 lg:w-14 lg:rounded-2xl"
                        title="Back to main page"
                        aria-label="Back to main page"
                    >
                        <TiArrowBack className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10" strokeWidth={0} />
                    </button>
                )}

                {/* Top UI Area */}
                <div className="absolute top-6 right-6 z-50 flex flex-col items-end gap-2">
                    <div className="flex items-center gap-3">
                        {/* Session Progress (Pending Coins) */}
                        {sessionCoins > 0 && (
                            <div className="flex items-center gap-1.5 bg-yellow-500/10 backdrop-blur-md px-3 py-1.5 rounded-full border border-yellow-500/20 shadow-sm text-yellow-400 animate-in fade-in slide-in-from-top-2 duration-300">
                                <span className="text-[10px] font-black uppercase tracking-wider opacity-70">Coins</span>
                                <span className="font-black text-sm tracking-widest">+{sessionCoins}</span>
                            </div>
                        )}

                        {/* Accumulated Score Indicator (Persistent Wallet) */}
                        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-full border border-white/10 shadow-lg text-white transition-all duration-500 ring-1 ring-white/5">
                            <span className="text-xl">💰</span>
                            <span className="font-black text-lg tracking-widest min-w-[3ch] text-right">
                                <AnimatedCounter value={stats.coins || 0} />
                            </span>
                        </div>

                        {/* Floating Close Button */}
                        <button
                            onClick={() => void leaveGame(onClose)}
                            className="w-12 h-12 flex items-center justify-center rounded-full bg-black/40 hover:bg-black/80 text-white/70 hover:text-white border-2 border-white/10 backdrop-blur-sm transition-all hover:scale-110 active:scale-95 shadow-lg"
                            title="Exit Game"
                        >
                            <span className="text-2xl font-bold leading-none mb-1">×</span>
                        </button>
                    </div>
                </div>

                {/* Game Iframe Wrapper */}
                <div className="absolute inset-0 bg-slate-900">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                            <div className="flex flex-col items-center gap-4">
                                <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin" />
                                <span className="text-white/60 text-sm">Loading {config.title}...</span>
                            </div>
                        </div>
                    )}

                    <iframe
                        src={config.url}
                        className="w-full h-full border-0 block"
                        title={config.title}
                        onLoad={() => setIsLoading(false)}
                        allow="autoplay; fullscreen"
                    />

                    {requiresLandscape && isPortrait && (
                        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/90 px-6 text-white backdrop-blur-sm">
                            <div className="flex max-w-sm flex-col items-center text-center">
                                <div className="mb-3 flex items-center gap-3" aria-hidden="true">
                                    <span className="text-4xl">📱</span>
                                    <span className="inline-block animate-spin text-4xl [animation-duration:2s]">↻</span>
                                </div>
                                <h2 className="text-xl font-black tracking-wide text-sky-400">Rotate your device</h2>
                                <p className="mt-3 text-sm font-semibold leading-relaxed text-white/80">
                                    {config.title} is designed for landscape mode. Rotate your phone to continue playing.
                                </p>
                                <button
                                    type="button"
                                    onPointerDown={(event) => event.stopPropagation()}
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        void leaveGame(onClose);
                                    }}
                                    className="mt-5 rounded-xl border border-white/20 bg-white/10 px-5 py-2.5 text-sm font-black text-white transition hover:bg-white/20 active:scale-95"
                                >
                                    Back to games
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};