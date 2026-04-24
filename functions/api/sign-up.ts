import { getSupabaseUserByEmail, signHS256, buildSetCookie, getCookieOptions } from './_shared/auth'

export const onRequestPost = async (context: any) => {
  const { request, env } = context
  const cookieOptions = getCookieOptions(request, env)

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
    const metadata = body?.metadata || {}
    const name = metadata.full_name || email?.split("@")[0] || ""

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const ODOO_BASE = env.ODOO_BASE || "https://mrbur.odoo.com"
    const ODOO_DB = env.ODOO_DB || "aht-systemadmin-mrbur-main-20994444"

    // ── 1. Register user in Odoo ──────────────────────────────────────────────
    const registerRes = await fetch(`${ODOO_BASE}/api/v1/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-SSO-API-KEY": env.ODOO_SSO_API_KEY || "",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: {
          email,
          name,
          password,
          company_id: 2,
          account_type: metadata.account_type || "individual",
        },
        id: 1,
      }),
    })

    const registerData: any = await registerRes.json().catch(() => null)
    const registerErr = registerData?.error?.message || registerData?.result?.error || ""
    const isAlreadyExists =
      registerErr.toLowerCase().includes("already") ||
      registerErr.toLowerCase().includes("exists") ||
      registerErr.toLowerCase().includes("registered") ||
      registerErr.toLowerCase().includes("duplicate")

    // Only hard-fail if it's a real error (not "user already exists")
    if (!registerRes.ok || (registerData?.error && !isAlreadyExists)) {
      return new Response(
        JSON.stringify({
          error: "Failed to register with Odoo",
          details: registerErr || `HTTP ${registerRes.status}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    // ── 2. Authenticate with Odoo to get session_id + uid ────────────────────
    const authRes = await fetch(`${ODOO_BASE}/web/session/authenticate`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "call",
        params: { db: ODOO_DB, login: email, password },
        id: 1,
      }),
    })

    const authData: any = await authRes.json().catch(() => null)

    if (!authRes.ok || authData?.error || !authData?.result?.uid) {
      return new Response(
        JSON.stringify({
          error: authData?.error?.message || "Odoo authentication failed after registration",
        }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      )
    }

    const result = authData.result
    const uid = result.uid
    const odooName = result.name ?? result.partner_display_name ?? name

    // Extract session_id cookie from Odoo response
    const setCookieHeader = authRes.headers.get("Set-Cookie")
    let sessionCookie = ""
    if (setCookieHeader) {
      const match = setCookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/i)
      if (match) sessionCookie = match[1]
    }

    // ── 3. Find or create Supabase user ──────────────────────────────────────
    let sbUser = await getSupabaseUserByEmail(env, email)

    if (!sbUser) {
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
          password: crypto.randomUUID() + crypto.randomUUID(),
          user_metadata: {
            sso: "odoo",
            name: odooName,
            odoo_sub: uid,
            role: metadata.role || "member",
            account_type: metadata.account_type || "individual",
          },
        }),
      })

      const created: any = await createRes.json().catch(() => null)

      if (!createRes.ok) {
        const msg = (created?.message || created?.error_description || created?.error || "").toLowerCase()
        const alreadyExists =
          created?.error_code === "email_exists" ||
          msg.includes("already") ||
          msg.includes("registered")

        if (alreadyExists) {
          sbUser = await getSupabaseUserByEmail(env, email)
        } else {
          return new Response(
            JSON.stringify({ error: "Failed to create Supabase user", details: created }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
          )
        }
      } else {
        sbUser = created?.user ?? created
      }
    }

    if (!sbUser?.id) {
      return new Response(JSON.stringify({ error: "Could not resolve Supabase user" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // ── 4. Sign Supabase-compatible JWT ──────────────────────────────────────
    const secret = env.SUPABASE_JWT_SECRET
    if (!secret) {
      return new Response(JSON.stringify({ error: "Missing SUPABASE_JWT_SECRET" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const now = Math.floor(Date.now() / 1000)
    const supabaseToken = await signHS256({
      header: { alg: "HS256", typ: "JWT" },
      payload: {
        aud: "authenticated",
        role: "authenticated",
        sub: sbUser.id,
        email: sbUser.email,
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: sbUser.user_metadata,
        session_id: crypto.randomUUID(),
        iat: now,
        exp: now + 3600,
      },
      secret,
    })

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders,
    })

    // Set mrbur_sso cookie for seamless SSO across other Snabbb apps
    if (sessionCookie) {
      responseHeaders.append("Set-Cookie", buildSetCookie("mrbur_sso", sessionCookie, cookieOptions))
    }

    return new Response(
      JSON.stringify({
        access_token: supabaseToken,
        refresh_token: supabaseToken,
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: sbUser.id,
          email: sbUser.email,
          user_metadata: sbUser.user_metadata,
          aud: "authenticated",
          role: "authenticated",
        },
      }),
      { status: 200, headers: responseHeaders }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
}
