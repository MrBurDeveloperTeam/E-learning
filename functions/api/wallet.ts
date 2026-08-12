function parseCookies(request: Request): Record<string, string> {
  const cookieHeader = request.headers.get('Cookie') || ''

  return cookieHeader
    .split(';')
    .reduce<Record<string, string>>((cookies, part) => {
      const [name, ...valueParts] = part.trim().split('=')

      if (!name) return cookies

      cookies[name] = decodeURIComponent(valueParts.join('='))
      return cookies
    }, {})
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') || '*'

  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request),
    },
  })
}

function getOdooCookie(request: Request): string | null {
  const cookies = parseCookies(request)

  // E-learning 登录时把 Odoo session 存在 mrbur_sso。
  const sessionId = cookies.session_id || cookies.mrbur_sso

  if (!sessionId) return null

  return `session_id=${encodeURIComponent(sessionId)}`
}

export const onRequestOptions = async (context: {
  request: Request
}) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(context.request),
  })
}

export const onRequestGet = async (context: {
  request: Request
  env: {
    ODOO_BASE?: string
  }
}) => {
  const { request, env } = context

  try {
    const odooBase = String(
      env.ODOO_BASE || 'https://mrbur.odoo.com',
    ).replace(/\/$/, '')

    const odooCookie = getOdooCookie(request)

    if (!odooCookie) {
      return jsonResponse(
        request,
        {
          ok: false,
          error: 'Missing Odoo session',
        },
        401,
      )
    }

    /*
     * Step 1:
     * Use the existing Odoo session to retrieve partner_id.
     */
    const sessionResponse = await fetch(
      `${odooBase}/web/session/get_session_info`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Cookie: odooCookie,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'call',
          params: {},
          id: Date.now(),
        }),
      },
    )

    const sessionData: any = await sessionResponse
      .json()
      .catch(() => null)

    if (
      !sessionResponse.ok ||
      sessionData?.error ||
      !sessionData?.result
    ) {
      console.error('Odoo session response:', sessionData)

      return jsonResponse(
        request,
        {
          ok: false,
          error: 'Unable to retrieve Odoo session',
        },
        401,
      )
    }

    const partnerId =
      sessionData.result.partner_id ||
      sessionData.result.partnerId

    if (!partnerId) {
      return jsonResponse(
        request,
        {
          ok: false,
          error: 'Odoo partner_id was not found',
        },
        404,
      )
    }

    /*
     * Step 2:
     * Retrieve the user's Snabbb wallet.
     */
    const walletResponse = await fetch(
      `${odooBase}/api/wallet?partner_id=${encodeURIComponent(
        String(partnerId),
      )}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Cookie: odooCookie,
        },
      },
    )

    const walletData: any = await walletResponse
      .json()
      .catch(() => null)

    if (!walletResponse.ok) {
      console.error('Wallet response:', walletData)

      return jsonResponse(
        request,
        {
          ok: false,
          error: 'Unable to retrieve Snabbb Credit balance',
        },
        walletResponse.status || 502,
      )
    }

    /*
     * Different implementations may return either:
     *
     * data.snabbb_balance
     * data.balance
     * result.snabbb_balance
     * result.balance
     */
    const rawBalance =
      walletData?.data?.snabbb_balance ??
      walletData?.data?.balance ??
      walletData?.result?.snabbb_balance ??
      walletData?.result?.balance ??
      walletData?.snabbb_balance ??
      walletData?.balance

    const numericBalance = Number(rawBalance)

    if (!Number.isFinite(numericBalance)) {
      console.error('Unexpected wallet payload:', walletData)

      return jsonResponse(
        request,
        {
          ok: false,
          error: 'Wallet API returned an invalid balance',
        },
        502,
      )
    }

    return jsonResponse(request, {
      ok: true,
      partnerId,
      balance: numericBalance,
    })
  } catch (error: any) {
    console.error('Wallet API error:', error)

    return jsonResponse(
      request,
      {
        ok: false,
        error:
          error?.message ||
          'Snabbb Credit service is unavailable',
      },
      500,
    )
  }
}