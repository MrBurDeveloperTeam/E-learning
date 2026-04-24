import { getSupabaseUserByEmail, signHS256, buildSetCookie, createOdooUser } from './_shared/auth'

export const onRequestPost = async (context: any) => {
  const { request, env } = context
  
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

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      })
    }

    // 1. Register with Odoo
    try {
      await createOdooUser(env, {
        email,
        password,
        name: metadata.full_name || email.split('@')[0],
        account_type: metadata.account_type || "individual",
        // Extract other metadata if available, avoiding undefined
      })
    } catch (err: any) {
      // If user already exists in Odoo, handle gracefully or let it fail
      const errMsg = err.message || String(err)
      if (!errMsg.toLowerCase().includes("already exists")) {
        return new Response(JSON.stringify({ error: "Failed to register with Odoo", details: errMsg }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        })
      }
    }

    // 2. Authenticate with Odoo to get session and uid
    const ODOO_BASE = env.ODOO_BASE || "https://mrbur.odoo.com"
    const ODOO_DB = env.ODOO_DB || "mrbur"

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
      return new Response(JSON.stringify({ error: odooData?.error?.message || "Login after registration failed" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      })
    }

    const result = odooData?.result || {}
    const uid = result?.uid
    const name = result?.name ?? result?.partner_display_name ?? metadata.full_name ?? ""

    const setCookieHeader = odooRes.headers.get("Set-Cookie")
    let sessionCookie = ""
    if (setCookieHeader) {
      const match = setCookieHeader.match(/(?:^|;\s*)session_id=([^;]+)/i)
      if (match) {
        sessionCookie = match[1]
      }
    }

    // 3. Create or get Supabase user
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
            name,
            odoo_sub: uid,
            ...metadata
          },
        }),
      })

      const created = await createRes.json().catch(() => null) as any
      if (!createRes.ok) {
        if (created?.error_code === "email_exists" || created?.msg?.toLowerCase()?.includes("registered")) {
          sbUser = await getSupabaseUserByEmail(env, email)
        } else {
          return new Response(JSON.stringify({ error: "Failed to create user in Supabase", details: created }), {
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
      session_id: crypto.randomUUID(),
      iat: now,
      exp: now + 3600,
    }

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

    const responseBody = {
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
      }
    }

    const responseHeaders = new Headers({
      "Content-Type": "application/json",
      ...corsHeaders
    })

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
