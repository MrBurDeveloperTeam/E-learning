import { createOdooUser } from './_shared/auth'

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
    const metadata = body?.metadata || body || {}

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Missing email or password" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      })
    }

    const result = await createOdooUser(env, {
      email,
      password,
      name: metadata.full_name || metadata.name || email.split("@")[0],
      phone: metadata.phone,
      position: metadata.position,
      account_type: metadata.account_type || "individual",
      company_name: metadata.company_name,
      referral_code: metadata.referral_code,
      dob: metadata.dob,
      country: metadata.country,
    })

    return new Response(JSON.stringify({ result, pendingVerification: true }), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    })
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    )
  }
}
