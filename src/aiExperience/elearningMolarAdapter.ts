// PHASE 6D (Molar AI migration): the LOCAL orchestration adapter connecting
// the shared `@mrburdeveloperteam/molar-experience/ai` chat UI runtime to
// E-Learning's own General Chat + Data-Driven Chat pipelines. The shared
// package only ever calls `sendMessage` and renders the returned
// `AIResponse.text` — every business decision below (mutation guard,
// deterministic intent classification, scope guards, grounded facts
// resolution, deterministic fallback, AIBoard keyword lookup, Gemini calls)
// is moved mechanically from the pre-migration `MolarAIFloat.jsx`, in the
// exact same priority order, not redesigned.
//
// Known cases are always returned as a normal `AIResponse` (never thrown) so
// their specific wording reaches the user — only a genuinely unexpected
// failure (e.g. a network error from the AIBoard keyword-lookup queries)
// propagates as a thrown error, which `SharedMolarAI`'s own outer catch
// turns into the identical generic "SNAI Error: Unable to process request."
// text the pre-migration component's own outer catch produced.
//
// `window.__MOLAR_ACTIONS__` fenced-json action-block parsing from the
// pre-migration `MolarAIFloat.jsx` is NOT ported here — a fresh repo-wide
// audit (see Phase 6D report) confirmed zero producer ever assigns
// `window.__MOLAR_ACTIONS__` anywhere in this repo, and its only defined
// actions were navigation-only (OPEN_LESSON/OPEN_CATEGORY/OPEN_SEARCH), so
// it was dead code, safely removed rather than ported.
import type { AIAdapter, AIMessage, AIRequest, AIResponse } from '@mrburdeveloperteam/molar-experience/contracts';
import { supabase } from '../lib/supabase';
import { chatWithMolarAI, chatWithGroundedElearningFacts } from '../services/geminiService';
import { isElearningMutationRequest } from './dataChat/router/isElearningMutationRequest';
import { classifyElearningDataIntent } from './dataChat/router/classifyElearningDataIntent';
import { resolveElearningDataQuery } from './dataChat/resolver/resolveElearningDataQuery';
import {
  buildUnsupportedParameterMessage,
  buildUnsupportedScopeMessage,
  buildUnsupportedSensitiveScopeMessage,
  buildUnavailableMessage,
} from './dataChat/utils/unsupportedParameterMessage';
import { formatGroundedElearningFallback } from './dataChat/utils/formatGroundedElearningFallback';
import type { ElearningDataChatSources } from './dataChat/hooks/useElearningDataChatSources';

interface CreateElearningMolarAdapterDeps {
  /** App.tsx's existing `aiContext` string (module/route/session/user/email
   *  summary) — built and owned entirely by the host, unchanged. */
  userContext: string;
  /** Phase-3 Data-Driven Chat sources, read from the existing React Query
   *  cache (see useElearningDataChatSources.ts) — unchanged. */
  dataChatSources: ElearningDataChatSources;
}

/** Maps SharedMolarAI's normalized `{role, text}` history into Gemini's
 *  native `{role, parts:[{text}]}` shape — kept entirely inside this
 *  adapter so the Gemini SDK's message shape never crosses the shared
 *  package boundary (the shared package must never see it). */
function toGeminiHistory(history: AIMessage[]) {
  return history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

export function createElearningMolarAdapter(deps: CreateElearningMolarAdapterDeps): AIAdapter {
  return {
    async sendMessage(request: AIRequest): Promise<AIResponse> {
      const msg = request.text.trim();

      // ── Phase-3 Data-Driven Chat (read-only) ──────────────────────────
      // Runs BEFORE the legacy General Chat pipeline below, and is fully
      // separate from it: a matched request here never calls the DB-backed
      // predefined-keyword lookup or `chatWithMolarAI`.

      // 1. Explicit mutation-shaped requests are intercepted with a
      // deterministic refusal — zero Gemini calls, zero mutation.
      if (isElearningMutationRequest(msg)) {
        return { text: "This data chat can check your video and creator-update information, but it can't make changes." };
      }

      // 2. Deterministic LOCAL intent classification (no Gemini call).
      const dataRoute = classifyElearningDataIntent(msg);

      if (dataRoute.kind === 'unsupported_sensitive_scope') {
        return { text: buildUnsupportedSensitiveScopeMessage(dataRoute.reason) };
      }

      if (dataRoute.kind === 'unsupported_parameter') {
        return { text: buildUnsupportedParameterMessage(dataRoute.reason) };
      }

      if (dataRoute.kind === 'unsupported_scope') {
        return { text: buildUnsupportedScopeMessage(dataRoute.reason) };
      }

      if (dataRoute.kind === 'matched') {
        const result = resolveElearningDataQuery(dataRoute.intent, deps.dataChatSources);

        let dataChatResponseText: string;
        if (result.status === 'unavailable') {
          // Unknown/unavailable source state is never reinterpreted as a
          // zero-result answer — a matched grounded intent owns this
          // request even when its source is temporarily unavailable; it
          // does not fall through to legacy chat.
          dataChatResponseText = buildUnavailableMessage(result.reasonCode);
        } else {
          try {
            // 3. Grounded Gemini phrasing — receives ONLY the question, the
            // approved intent, and the already-minimized facts.
            dataChatResponseText = await chatWithGroundedElearningFacts(msg, result.intent, result.facts);
          } catch (groundedErr) {
            // Mandatory deterministic fallback — never falls through to
            // legacy General Chat on a Gemini failure at this stage.
            console.error('Grounded elearning response failed:', groundedErr);
            dataChatResponseText = formatGroundedElearningFallback(result.intent, result.facts);
          }
        }

        return { text: dataChatResponseText };
      }
      // ── End Phase-3 Data-Driven Chat (dataRoute.kind === 'no_match') ──

      let response: string | null = null;

      // 1. Check custom AIBoard keyword responses first.
      const { data: apps } = await supabase
        .from('aiboard_response_target_apps')
        .select('response_id')
        .in('app_name', ['E-learning', 'All']);

      if (apps && apps.length > 0) {
        const responseIds = apps.map((a) => a.response_id);
        const { data: keywords } = await supabase
          .from('aiboard_response_keywords')
          .select('keyword, response_id')
          .in('response_id', responseIds);

        if (keywords && keywords.length > 0) {
          const matchedKeyword = keywords.find((k) => msg.toLowerCase().includes(k.keyword.toLowerCase()));

          if (matchedKeyword) {
            const { data: respData } = await supabase
              .from('aiboard_responses')
              .select('response')
              .eq('id', matchedKeyword.response_id)
              .single();

            if (respData) {
              response = respData.response;
            }
          }
        }
      }

      // 2. Fallback to Gemini.
      if (!response) {
        response = await chatWithMolarAI(toGeminiHistory(request.history), msg, deps.userContext);
      }

      return { text: response };
    },
  };
}
