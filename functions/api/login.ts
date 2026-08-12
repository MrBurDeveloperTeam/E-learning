import { issueSupabaseSession, buildSetCookie, getCookieOptions } from './_shared/auth'

export const onRequestPost = async (context: any) => {
  const { request, env } = context
  const cookieOptions = getCookieOptions(request, env)
  
  // Handle CORS preflight if necessary (handled by _middleware if one exists, but safe to include)
  const origin = request.headers.get("Origin") || "*"
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  try {
    const body: any = await request.json()
    const email = body?.email?.trim()
    const password = body?.password

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      })
    }

    const ODOO_BASE = env.ODOO_BASE || "https://mrbur.odoo.com"
    const ODOO_DB = env.ODOO_DB || "aht-systemadmin-mrbur-main-20994444"

    // 1. Authenticate with Odoo
    const rpcBody = {
      jsonrpc: "2.0",
      method: "call",
      params: { db: ODOO_DB, login: email, password },
      id: 1,
    }

    const odooRes = await fetch(`${ODOO_BASE}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(rpcBody),
    })

    const odooData: any = await odooRes.json().catch(() => null)

    if (!odooRes.ok || odooData?.error) {
      return new Response(JSON.stringify({ error: odooData?.error?.message || "Odoo login failed" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      })
    }

    const result = odooData?.result || {}
    const uid = result?.uid

    if (!uid) {
      return new Response(JSON.stringify({ error: "Invalid Odoo credentials" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      })
    }

    // 2. Extract Session Cookie (for seamless SSO across other Snabbb apps)
    const setCookieHeader = odooRes.headers.get("Set-Cookie")
    let sessionCookie = ""
    if (setCookieHeader) {
      const match = setCookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/i)
      if (match) {
        sessionCookie = match[1]
      }
    }

    const name = result?.name ?? result?.partner_display_name ?? ""

    // 3. Exchange the verified central identity for a real, refreshable
    // Supabase Auth session. This server-side mapping sends no confirmation email.
    const responseBody = await issueSupabaseSession(env, { email, name, odooSub: uid })

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders
    })

    // Also set the mrbur_sso cookie for seamless login to other apps
    if (sessionCookie) {
      responseHeaders.append("Set-Cookie", buildSetCookie("mrbur_sso", sessionCookie, cookieOptions))
    }

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: responseHeaders
    })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    })
  }
}
