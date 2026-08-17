// Small, presentation-only component. Deliberately contains NO
// deterministic business logic — it only renders whatever candidate
// useElearningPersonalizedInsight already resolved. All eligibility/
// read-state/follow-relationship/tie-break decisions live in
// ../providers, ../utils, and ../resolver, never here.
//
// Reuses the app's own existing `.card` utility (src/index.css — the same
// class RetryCard.tsx uses for its own small notice card) plus the
// existing shadcn-style `Button` component, rather than inventing new
// visual primitives or hardcoded colors — theme-token-based (`bg-card`,
// `border-border`, `text-foreground`) so it stays correct in both light
// and dark mode automatically, unlike this repo's older hardcoded-hex
// components (e.g. NotificationBell.tsx).
//
// No dismiss/close button: per this slice's product rule, the card must
// disappear only because the underlying notification becomes read or the
// current-follow relationship no longer holds — never because of an
// unrelated local "hidden" boolean. `onAction` is the only interactive
// affordance, and it is the caller's responsibility (see Home.tsx) to wire
// it to the real mark-read mutation + real video route, never a new
// mark-read implementation.

import type { InsightCandidate } from '../contracts/insightCandidate';

interface PersonalizedInsightProps {
  // `unknown` here (never `any`) — this component only ever reads
  // `.message`/`.action`, never `.facts`, so any concrete
  // `InsightCandidate<TFacts>` is structurally assignable.
  candidate: InsightCandidate<unknown> | null;
  onAction: () => void;
}

export function PersonalizedInsight({ candidate, onAction }: PersonalizedInsightProps) {
  if (!candidate) return null;

  return (
    <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-6">
      <div className="card flex items-center gap-3 border-l-4 border-l-primary bg-card px-4 py-3">
        <p className="flex-1 text-sm text-foreground">{candidate.message}</p>
        {candidate.action && (
          <button
            type="button"
            onClick={onAction}
            className="btn-outline shrink-0 px-3 py-1.5 text-sm"
          >
            {candidate.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
