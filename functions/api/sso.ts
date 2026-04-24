import { getSupabaseUserByEmail, signHS256, verifyHS256, getTokenFromRequest, buildSetCookie, buildClearCookie } from './_shared/auth'

export const onRequestGet = async (context: any) => {
  const { request, env } = context
  
  const origin = request.headers.get("Origin") || "*"
  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, Cookie",
  }

  try {
    const token = getTokenFromRequest(request)

    if (!token) {
      return new Response(JSON.stringify({ error: "missing_sso" }), {
        status: 401,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
          "Set-Cookie": buildClearCookie(),
        },
      })
    }

    // Attempt to verify the token. 
    // It might be signed with APP_JWT_SECRET (from another Snabbb app) or SUPABASE_JWT_SECRET
    let decoded: any = null
    let email = ""
    let odooSub = null
    let name = ""

    const appSecret = env.APP_JWT_SECRET || env.SUPABASE_JWT_SECRET
    const supabaseSecret = env.SUPABASE_JWT_SECRET

    // Try APP_JWT_SECRET first
    let v = await verifyHS256({ token, secret: appSecret })
    if (!v.ok && appSecret !== supabaseSecret) {
      // Try SUPABASE_JWT_SECRET if different
      v = await verifyHS256({ token, secret: supabaseSecret })
    }

    if (!v.ok) {
      // Even if signature fails, try parsing to see if we can get email for lookup, 
      // but typically we should reject invalid signatures.
      return new Response(JSON.stringify({ error: v.error || "invalid_token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    decoded = v.payload
    email = decoded?.email?.trim().toLowerCase()
    name = decoded?.name?.trim() || ""
    odooSub = decoded?.sub ?? null

    if (!email) {
      return new Response(JSON.stringify({ error: "missing_email_in_token" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

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
            odoo_sub: odooSub,
          },
        }),
      })

      const created = await createRes.json().catch(() => null) as any
      if (!createRes.ok) {
        if (created?.error_code === "email_exists" || created?.msg?.toLowerCase()?.includes("registered")) {
          sbUser = await getSupabaseUserByEmail(env, email)
        } else {
          return new Response(JSON.stringify({ error: "Failed to create Supabase user", details: created }), {
            status: 500,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          })
        }
      } else {
        sbUser = created?.user ?? created
      }
    }

    if (!sbUser?.id) {
      return new Response(JSON.stringify({ error: "supabase_user_missing_id" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

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

    const supabaseToken = await signHS256({
      header: { alg: "HS256", typ: "JWT" },
      payload,
      secret: supabaseSecret,
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

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": buildSetCookie("mrbur_sso", token), // refresh cookie
        ...corsHeaders,
      },
    })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: "internal_error", message: err?.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  }
}

export const onRequestOptions = async (context: any) => {
  const origin = context.request.headers.get("Origin") || "*"
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Cookie",
    }
  })
}
