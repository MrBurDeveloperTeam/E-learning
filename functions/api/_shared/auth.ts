// Auth Utilities for Cloudflare Pages Functions
// Extracted from Snabbb worker logic

export function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.length;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

export function base64UrlEncodeJson(obj: any): string {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  return base64UrlEncodeBytes(bytes);
}

export async function signHS256({ header, payload, secret }: { header: any, payload: any, secret: string }): Promise<string> {
  const enc = new TextEncoder();
  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
  const sig = base64UrlEncodeBytes(new Uint8Array(sigBuf));

  return `${signingInput}.${sig}`;
}

export async function verifyHS256({ token, secret }: { token: string, secret: string }): Promise<{ ok: boolean, payload?: any, error?: string }> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { ok: false, error: "bad_format" };
  
    const [h, p, sig] = parts;
    const signingInput = `${h}.${p}`;
  
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  
    const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(signingInput));
    const expected = base64UrlEncodeBytes(new Uint8Array(sigBuf));
  
    if (expected !== sig) return { ok: false, error: "bad_sig" };
  
    const jsonStr = atob(p.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((p.length + 3) % 4));
    const payload = JSON.parse(jsonStr);
  
    const now = Math.floor(Date.now() / 1000);
    if (payload?.exp && now >= payload.exp) return { ok: false, error: "expired" };
  
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, error: "verify_failed" };
  }
}

export function buildSetCookie(name: string, value: string, domain: string = ".mrbur.shop", maxAge: number = 60 * 60): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    `Domain=${domain}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
  ].join("; ");
}

export function buildClearCookie(name: string = "mrbur_sso", domain: string = ".mrbur.shop"): string {
  return [
    `${name}=`,
    "Path=/",
    `Domain=${domain}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    "Max-Age=0",
  ].join("; ");
}

export function getTokenFromRequest(req: Request): string | null {
  const cookie = req.headers.get("Cookie") || "";
  const parts = cookie.split(";").map((v) => v.trim());
  for (const part of parts) {
    if (part.startsWith("mrbur_sso=")) {
      return decodeURIComponent(part.slice("mrbur_sso".length + 1));
    }
  }

  const auth = req.headers.get("Authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);

  return null;
}

export async function getSupabaseUserByEmail(env: any, email: string): Promise<any | null> {
  const target = String(email || "").trim().toLowerCase();
  if (!target) return null;

  let page = 1;
  const perPage = 200;

  while (true) {
    const res = await fetch(
      `${env.SUPABASE_URL}/auth/v1/admin/users?page=${page}&per_page=${perPage}`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
  
    const data: any = await res.json().catch(() => null);
  
    if (!res.ok) {
      console.log("list users failed", res.status, data);
      return null;
    }
  
    const users = Array.isArray(data?.users) ? data.users : [];
    const match = users.find(
      (u: any) => String(u?.email || "").trim().toLowerCase() === target
    );
  
    if (match) return match;
  
    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

export async function createOdooUser(env: any, params: any) {
  // If env.ODOO_API_URL is missing, fallback to env.ODOO_BASE
  const baseUrl = env.ODOO_API_URL || env.ODOO_BASE || "https://mrbur.odoo.com";
  const upstreamUrl = `${baseUrl}/api/v1/users`;

  const requestData = {
    jsonrpc: "2.0",
    method: "call",
    params: {
      email: params.email,
      name: params.name || params.email.split('@')[0],
      password: params.password,
      phone: params.phone,
      account_type: params.account_type,
      job_position: params.position,
      company_name: params.company_name,
      company_id: 2, // adjust if needed
    },
    id: 1,
  };

  const res = await fetch(upstreamUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-SSO-API-KEY": env.ODOO_SSO_API_KEY || "", // Assuming this is needed or optional
    },
    body: JSON.stringify(requestData),
  });

  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  if (!res.ok) throw new Error(`Odoo HTTP ${res.status}`);
  if (data?.error) throw new Error(data.error?.message || "Odoo error");
  if (data?.result?.ok === false) throw new Error(data.result?.error || "Odoo create user failed");

  return data?.result;
}
