// Server-only Gemini boundary for Molar AI (E-Learning). This is the ONLY
// place in this project's Molar chat feature that reads a Gemini provider
// credential or calls the Gemini API — see ../../src/services/geminiService.ts,
// which now only forwards requests here via an authenticated fetch to
// /api/molar-chat and never touches a Gemini credential itself.
//
// Requires a real Supabase-authenticated session for every request — this
// is NOT an anonymous public provider endpoint. Rejects with 401 if the
// caller's bearer token is missing or Supabase Auth itself rejects it.
// Verification is delegated to Supabase's own Auth server via
// `supabase.auth.getUser(token)` — the same pattern already used by
// functions/api/categorize-dental-videos.ts and
// functions/api/fetch-dental-videos.ts (though those construct their
// client with the service-role key for their own admin-only DB reads;
// this endpoint deliberately uses only SUPABASE_ANON_KEY, since
// `auth.getUser(token)` needs no elevated privilege and this endpoint
// performs no database access at all). This avoids introducing the
// separate, more sensitive SUPABASE_JWT_SECRET (used by
// functions/api/sso.ts for a different, cross-app SSO token type) into
// this endpoint's configuration surface.
//
// Two request modes, mirroring the two pre-existing client functions
// exactly (prompts/model unchanged, only relocated):
//   - "general": free-form General Chat (chatWithMolarAI's prior body).
//   - "grounded": grounded Data-Chat phrasing over host-selected,
//     already-minimized facts (chatWithGroundedElearningFacts's prior
//     body). This function never queries E-Learning tables, never selects
//     which video/creator update matters, and never computes view counts
//     — it only performs language generation over facts the client
//     already resolved deterministically before calling here.
//
// Deliberately independent from functions/api/categorize-dental-videos.ts
// (a separate, unrelated feature with its own model and env binding) — no
// shared helper extraction, no behavior change there.

import { createClient } from '@supabase/supabase-js'

function getBearerToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization')
  return authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
}

const modelId = 'gemini-3-flash-preview'

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '*'
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  }
}

function json(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  })
}

type ChatMessage = { role: 'user' | 'model'; parts: { text: string }[] }

function isValidHistory(history: unknown): history is ChatMessage[] {
  if (!Array.isArray(history)) return false
  return history.every(
    (entry) =>
      entry &&
      typeof entry === 'object' &&
      (entry.role === 'user' || entry.role === 'model') &&
      Array.isArray(entry.parts) &&
      entry.parts.every((p: unknown) => typeof (p as { text?: unknown })?.text === 'string')
  )
}

function buildGeneralSystemInstruction(userContext: string): string {
  const hasContext = userContext.trim().length > 30
  return `
You are SNAI (Snabbb Assistant Intelligent), the AI assistant for Snabbb E-learning.

Your role:
- Help users find lessons, dental education videos, categories, saved content, creator channels, and learning workflows.
- Use the E-learning context when available.
- Give concise, practical guidance.
- Do not invent courses, videos, certificates, saved records, or database records that are not present in the context.
- If a user asks to change data, guide them to the relevant E-learning section unless an explicit UI action handler is available.

Useful UI guidance:
- Browse learning content from Home, Explore, Categories, Dental Videos, Search, and Saved.
- Creator uploads and analytics are in Upload and Studio.
- Profile and learning account settings are in Profile and Settings.

${hasContext ? `--- E-LEARNING CONTEXT ---\n${userContext}\n--- END CONTEXT ---` : ''}

Current date: ${new Date().toISOString().split('T')[0]}
`
}

function buildGroundedSystemInstruction(intent: string, facts: unknown): string {
  return `
You are answering ONE specific E-learning creator-analytics or followed-creator question using ONLY the structured facts provided below.

Approved intent: ${intent}
Facts (JSON, already computed by deterministic code — do not recompute or second-guess any number):
${JSON.stringify(facts)}

Rules — follow ALL of these exactly:
- Only state facts present in the JSON above. Do not invent view counts, video titles, creator names, or engagement metrics.
- If a creator display name is not present in the facts, do not invent one.
- Do not calculate, estimate, or infer any new count beyond what is given.
- Do not claim a notification was marked read, or that a follow/like/publish action occurred — you cannot make changes, only report data.
- Do NOT output a \`\`\`json code block or any similar machine-readable tag under any circumstance.
- If the JSON's "count" is greater than "shownCount", clearly say only some matching updates are shown (e.g. "Showing 5 of 12").
- If a relevant boolean/count indicates none/zero, clearly state that — do not imply otherwise.
- Be concise — a sentence or two at most.
`
}

async function callGemini(env: any, apiKey: string, contents: unknown): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { responseMimeType: 'text/plain' } }),
    }
  )

  if (!res.ok) {
    console.error('[molar-chat] Gemini provider HTTP error:', res.status)
    return null
  }

  const data: any = await res.json().catch(() => null)
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || ''
  return text || null
}

export const onRequestOptions = async (context: any) => {
  return new Response(null, { status: 204, headers: corsHeaders(context.request) })
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context

  // --- Require a real Supabase-authenticated session. Never treat the
  // mere presence of an Authorization header as proof of a real user, and
  // never trust a client-supplied user id — the only identity this
  // endpoint accepts is whatever Supabase's own Auth server returns for
  // the supplied access token. ---
  const token = getBearerToken(request)
  if (!token) {
    return json(request, { ok: false, error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = env.SUPABASE_URL
  const supabaseAnonKey = env.SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnonKey) {
    // Server misconfiguration, not a user auth failure — must not be
    // reported as 401.
    console.error('[molar-chat] Missing SUPABASE_URL/SUPABASE_ANON_KEY runtime configuration.')
    return json(request, { ok: false, error: 'Server is not configured.' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) {
    return json(request, { ok: false, error: 'Unauthorized' }, 401)
  }

  const apiKey = env.GEMINI_API_KEY
  if (!apiKey) {
    console.error('[molar-chat] Missing server-side GEMINI_API_KEY configuration.')
    return json(request, { ok: false, error: 'AI service is not configured.' }, 500)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(request, { ok: false, error: 'Invalid request body.' }, 400)
  }

  const { mode } = (body ?? {}) as { mode?: unknown }

  if (mode !== 'general' && mode !== 'grounded') {
    return json(request, { ok: false, error: 'Invalid or missing mode.' }, 400)
  }

  if (mode === 'general') {
    const { message, history, userContext } = body as {
      message?: unknown
      history?: unknown
      userContext?: unknown
    }

    if (typeof message !== 'string' || !message.trim()) {
      return json(request, { ok: false, error: 'Message is required.' }, 400)
    }
    if (history !== undefined && !isValidHistory(history)) {
      return json(request, { ok: false, error: 'Invalid history.' }, 400)
    }
    if (userContext !== undefined && typeof userContext !== 'string') {
      return json(request, { ok: false, error: 'Invalid context.' }, 400)
    }

    try {
      const systemInstruction = buildGeneralSystemInstruction(typeof userContext === 'string' ? userContext : '')

      const contents = [
        { role: 'user', parts: [{ text: systemInstruction }] },
        { role: 'model', parts: [{ text: 'I am SNAI, ready to help with E-learning.' }] },
        ...((history as ChatMessage[] | undefined) ?? []),
        { role: 'user', parts: [{ text: message }] },
      ]

      const text = await callGemini(env, apiKey, contents)
      if (!text) {
        return json(request, { ok: false, error: 'No response from AI service.' }, 502)
      }

      return json(request, { ok: true, text })
    } catch (error) {
      console.error('[molar-chat] General chat provider error:', error)
      return json(request, { ok: false, error: 'AI service request failed.' }, 502)
    }
  }

  // mode === 'grounded'
  const { question, intent, facts } = body as {
    question?: unknown
    intent?: unknown
    facts?: unknown
  }

  if (typeof question !== 'string' || !question.trim()) {
    return json(request, { ok: false, error: 'Question is required.' }, 400)
  }
  if (typeof intent !== 'string' || !intent.trim()) {
    return json(request, { ok: false, error: 'Intent is required.' }, 400)
  }
  if (facts === undefined) {
    return json(request, { ok: false, error: 'Facts are required.' }, 400)
  }

  try {
    const systemInstruction = buildGroundedSystemInstruction(intent, facts)

    const contents = [
      { role: 'user', parts: [{ text: systemInstruction }] },
      { role: 'model', parts: [{ text: 'Understood — I will use only the provided facts and invent nothing.' }] },
      { role: 'user', parts: [{ text: question }] },
    ]

    const text = await callGemini(env, apiKey, contents)
    if (!text || !text.trim()) {
      return json(request, { ok: false, error: 'Empty response from AI service.' }, 502)
    }

    return json(request, { ok: true, text: text.trim() })
  } catch (error) {
    console.error('[molar-chat] Grounded chat provider error:', error)
    return json(request, { ok: false, error: 'AI service request failed.' }, 502)
  }
}
