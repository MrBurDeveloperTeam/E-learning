import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const modelId = 'gemini-3-flash-preview';

type ChatPart = { text: string };
type ChatMessage = { role: 'user' | 'model'; parts: ChatPart[] };

export async function chatWithMolarAI(
  history: ChatMessage[],
  message: string,
  userContext = ''
) {
  try {
    const hasContext = userContext.trim().length > 30;
    const systemInstruction = `
You are SNAI (Snabbb Assistant Intelligent), the AI assistant for Snabbb E-learning.

Your role:
- Help users find lessons, dental education videos, categories, saved content, creator channels, and learning workflows.
- Use the E-learning context when available.
- Give concise, practical guidance.
- Do not invent courses, videos, certificates, saved records, or database records that are not present in the context.
- If a user asks to change data, guide them to the relevant E-learning section unless an explicit UI action handler is available.

Useful UI guidance:
- Browse learning content from Home, Explore, Categories, Search, and Dental Videos.
- Saved content is in Saved.
- Creator uploads and analytics are in Upload and Studio.
- Profile and learning account settings are in Profile and Settings.

${hasContext ? `--- E-LEARNING CONTEXT ---\n${userContext}\n--- END CONTEXT ---` : ''}

Current date: ${new Date().toISOString().split('T')[0]}
`;

    const contents = [
      { role: 'user' as const, parts: [{ text: systemInstruction }] },
      { role: 'model' as const, parts: [{ text: 'I am SNAI, ready to help with E-learning.' }] },
      ...history,
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    const response = await ai.models.generateContent({
      model: modelId,
      contents,
      config: { responseMimeType: 'text/plain' },
    });

    const text = response.text;
    if (!text) throw new Error('No response from Gemini');
    return text;
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
// already produced minimized, model-safe facts. Gemini here NEVER
// decides which video is latest/most-viewed, never computes view
// counts, never decides current-follow state or notification-read
// state, and never receives the full `aiContext` string
// `chatWithMolarAI` does (which includes the user's raw email — see
// App.tsx) — only the user's question, the approved intent name, and
// the already-computed facts.
//
// CRITICAL: unlike `chatWithMolarAI`, this function THROWS on failure
// (missing API key, network error, empty response) rather than
// swallowing it into a friendly fallback string — the caller needs to
// distinguish success from failure so it can render a deterministic
// facts-only fallback instead (see
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
  const systemInstruction = `
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
`;

  const contents = [
    { role: 'user' as const, parts: [{ text: systemInstruction }] },
    { role: 'model' as const, parts: [{ text: 'Understood — I will use only the provided facts and invent nothing.' }] },
    { role: 'user' as const, parts: [{ text: question }] },
  ];

  const response = await ai.models.generateContent({
    model: modelId,
    contents,
    config: { responseMimeType: 'text/plain' },
  });

  const text = response.text;
  if (!text || !text.trim()) throw new Error('Empty grounded response from Gemini');

  return text.trim();
}
