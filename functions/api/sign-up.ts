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
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Use Supabase's native sign-up endpoint — no Odoo dependency
    const signUpRes = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          name: metadata.full_name || email.split("@")[0],
          role: metadata.role || "member",
          account_type: metadata.account_type || "individual",
        },
      }),
    })

    const signUpData: any = await signUpRes.json().catch(() => null)

    if (!signUpRes.ok) {
      const errMsg = signUpData?.message || signUpData?.error_description || signUpData?.error || "Sign up failed"
      return new Response(JSON.stringify({ error: errMsg }), {
        status: signUpRes.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    // Supabase returns access_token + refresh_token directly on sign-up
    return new Response(
      JSON.stringify({
        access_token: signUpData.access_token,
        refresh_token: signUpData.refresh_token,
        token_type: signUpData.token_type || "bearer",
        expires_in: signUpData.expires_in || 3600,
        user: signUpData.user,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
}
