import { getSupabaseUserByEmail, signHS256, buildSetCookie } from './_shared/auth'

export const onRequestPost = async (context: any) => {
  const { request, env } = context
  
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
    const ODOO_DB = env.ODOO_DB || "mrbur"

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

    // 3. Get or Create Supabase User
    let sbUser = await getSupabaseUserByEmail(env, email)
    if (!sbUser) {
      // Create user
      const createRes = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
        method: "POST",
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          email_confirm: true,
          password: crypto.randomUUID() + crypto.randomUUID(), // Random password since Odoo is truth
          user_metadata: {
            sso: "odoo",
            name,
            odoo_sub: uid,
          },
        }),
      })

      const created = await createRes.json().catch(() => null) as any
      if (!createRes.ok) {
        if (created?.error_code === "email_exists" || created?.msg?.toLowerCase()?.includes("registered")) {
          sbUser = await getSupabaseUserByEmail(env, email)
        }
        if (!sbUser) {
          return new Response(JSON.stringify({ error: "Failed to sync user with Supabase" }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders }
          })
        }
      } else {
        sbUser = created?.user ?? created
      }
    }

    // 4. Generate Supabase JWT
    const now = Math.floor(Date.now() / 1000)
    const payload = {
      aud: "authenticated",
      role: "authenticated",
      sub: sbUser.id,
      email: sbUser.email,
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: sbUser.user_metadata,
      session_id: crypto.randomUUID(), // Mock session ID
      iat: now,
      exp: now + 3600, // 1 hour
    }

    // Must have SUPABASE_JWT_SECRET
    const secret = env.SUPABASE_JWT_SECRET || env.APP_JWT_SECRET
    if (!secret) {
      return new Response(JSON.stringify({ error: "Missing JWT Secret configuration" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      })
    }

    const supabaseToken = await signHS256({
      header: { alg: "HS256", typ: "JWT" },
      payload,
      secret,
    })

    // Prepare response
    const responseBody = {
      access_token: supabaseToken,
      refresh_token: supabaseToken, // We just return the same token, client can refresh via auth state change if needed, but standard is to handle custom refresh logic.
      token_type: "bearer",
      expires_in: 3600,
      user: {
        id: sbUser.id,
        email: sbUser.email,
        user_metadata: sbUser.user_metadata,
        aud: "authenticated",
        role: "authenticated",
      }
    }

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders
    })

    // Also set the mrbur_sso cookie for seamless login to other apps
    if (sessionCookie) {
      responseHeaders.append("Set-Cookie", buildSetCookie("mrbur_sso", sessionCookie))
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
