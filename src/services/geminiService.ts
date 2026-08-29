// Client-side transport layer only. This file must NEVER import
// @google/genai, construct a GoogleGenAI client, read
// VITE_GEMINI_API_KEY, or call generateContent directly — all of that
// now lives exclusively in the server-only Cloudflare Pages Function at
// functions/api/molar-chat.ts, which this file calls via an authenticated
// fetch('/api/molar-chat', ...). The Supabase access token is attached as
// an explicit Authorization bearer header (obtained fresh from
// supabase.auth.getSession() on every call, never cached/logged) — the
// server independently verifies its signature, never trusts a
// client-supplied user id. Public function signatures are preserved so
// src/aiExperience/elearningMolarAdapter.ts requires no change.
import { supabase } from '../lib/supabase';

type ChatPart = { text: string };
type ChatMessage = { role: 'user' | 'model'; parts: ChatPart[] };

async function invokeMolarChat(payload: Record<string, unknown>): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;
  if (!accessToken) {
    throw new Error('No active session');
  }

  const res = await fetch('/api/molar-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => null) as { ok?: boolean; text?: string; error?: string } | null;

  if (!res.ok || !data?.ok) {
    throw new Error(data?.error || `AI service request failed (${res.status})`);
  }

  return data.text ?? '';
}

export async function chatWithMolarAI(
  history: ChatMessage[],
  message: string,
  userContext = ''
) {
  try {
    return await invokeMolarChat({ mode: 'general', history, message, userContext });
  } catch (error) {
    console.error('Gemini Chat Error:', error);
    return "I'm having trouble connecting to the Snabbb Assistant Intelligent servers right now. Please try again shortly.";
  }
}

// ─────────────────────────────────────────────────────────────
// DATA-DRIVEN CHAT — grounded response phrasing ONLY.
//
// Architecturally SEPARATE from `chatWithMolarAI` above: called only
// AFTER a deterministic local intent router + deterministic own-video-
// analytics/social provider (see src/aiExperience/dataChat/) have
// already produced minimized, model-safe facts. The Pages Function this
// calls NEVER decides which video is latest/most-viewed, never computes
// view counts, never decides current-follow state or notification-read
// state, and never receives the full `aiContext` string
// `chatWithMolarAI` does (which includes the user's raw email — see
// App.tsx) — only the user's question, the approved intent name, and
// the already-computed facts.
//
// CRITICAL: unlike `chatWithMolarAI`, this function THROWS on failure
// (missing session, network error, non-2xx response, empty response)
// rather than swallowing it into a friendly fallback string — the caller
// needs to distinguish success from failure so it can render a
// deterministic facts-only fallback instead (see
// src/aiExperience/dataChat/utils/formatGroundedElearningFallback.ts)
// rather than ever falling through to the full legacy General Chat
// pipeline.
//
// The returned text is plain assistant text ONLY. It is never scanned
// for fenced ```json action blocks — this function has no path to
// `window.__MOLAR_ACTIONS__` or any mutation.
export async function chatWithGroundedElearningFacts(
  question: string,
  intent: string,
  facts: unknown
): Promise<string> {
  return invokeMolarChat({ mode: 'grounded', question, intent, facts });
}
