# -*- coding: utf-8 -*-
"""
Odoo-side counterpart to the DentalLearn E-Learning app's product-purchase
feature:

  GET  /api/v1/products/search   <- functions/api/products/search.ts
  POST /api/wallet/credit        <- functions/api/products/purchase-webhook.ts
  GET  /api/sso/elearning        <- functions/api/sso/shop-redirect.ts

The first two authenticate with a shared key (X-SSO-API-KEY) against
`snabbb_elearning.sso_api_key`.  The SSO endpoint uses a separate HS256 JWT
signed with `snabbb_elearning.app_jwt_secret` (set to the same value as the
Cloudflare Worker's APP_JWT_SECRET env var).
"""
import base64
import hashlib
import hmac as _hmac
import json
import logging
import time

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


def _verify_hs256_jwt(token: str, secret: str):
    """Verify an HS256-signed JWT and return the payload dict, or None on failure."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header_b64, payload_b64, sig_b64 = parts
        signing_input = f"{header_b64}.{payload_b64}"

        raw_sig = _hmac.new(
            secret.encode("utf-8"),
            signing_input.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        expected = base64.urlsafe_b64encode(raw_sig).rstrip(b"=").decode("utf-8")

        if not _hmac.compare_digest(expected, sig_b64):
            return None

        # Decode payload
        pad = 4 - len(payload_b64) % 4
        payload_bytes = base64.urlsafe_b64decode(payload_b64 + "=" * pad)
        payload = json.loads(payload_bytes)

        if payload.get("exp") and time.time() > payload["exp"]:
            return None

        return payload
    except Exception:
        return None


def _check_api_key():
    """Returns True if the request carries a valid X-SSO-API-KEY, or if no
    key has been configured yet (open, for initial setup/testing — set
    snabbb_elearning.sso_api_key before going live)."""
    configured_key = request.env["ir.config_parameter"].sudo().get_param("snabbb_elearning.sso_api_key")
    if not configured_key:
        _logger.warning(
            "Snabbb E-Learning: snabbb_elearning.sso_api_key is not set — "
            "endpoints are unauthenticated. Configure it in Settings before going live."
        )
        return True
    provided_key = request.httprequest.headers.get("X-SSO-API-KEY")
    return provided_key == configured_key


class SnabbbElearningProductsController(http.Controller):

    @http.route("/api/sso/elearning", type="http", auth="public", methods=["GET"], csrf=False, website=True)
    def elearning_sso(self, token=None, next="/", **kwargs):
        """
        Receives a short-lived HS256-signed JWT from the E-Learning app
        (functions/api/sso/shop-redirect.ts), verifies it, and sets the
        session_id cookie on this domain so the user is auto-logged in when
        they land on the shop after clicking a featured product.

        Setup: in Odoo, set the system parameter
        `snabbb_elearning.app_jwt_secret` to the same value as the Cloudflare
        Worker's SUPABASE_JWT_SECRET (or APP_JWT_SECRET if you add one later).
        Technial Settings → System Parameters → New.
        """
        secret = (
            request.env["ir.config_parameter"].sudo().get_param("snabbb_elearning.app_jwt_secret")
            or request.env["ir.config_parameter"].sudo().get_param("snabbb_elearning.sso_api_key")
            or ""
        )

        redirect_target = next or "/"

        if not secret or not token:
            _logger.warning("Snabbb E-Learning SSO: missing secret or token — redirecting without login")
            return request.redirect(redirect_target)

        payload = _verify_hs256_jwt(token, secret)
        if not payload:
            _logger.warning("Snabbb E-Learning SSO: invalid or expired token — redirecting without login")
            return request.redirect(redirect_target)

        session_id = payload.get("session_id")
        if not session_id:
            _logger.warning("Snabbb E-Learning SSO: token has no session_id")
            return request.redirect(redirect_target)

        # Set the session_id cookie for this domain so Odoo recognises the
        # user on subsequent requests.  The same Odoo session that was
        # established on .snabbb.com is now also usable on mrbur.shop.
        response = request.redirect(redirect_target)
        response.set_cookie(
            "session_id",
            session_id,
            max_age=3600,
            httponly=True,
            samesite="Lax",
        )
        return response

    @http.route("/api/v1/products/search", type="http", auth="public", methods=["GET"], csrf=False)
    def search_partner_products(self, **kwargs):
        if not _check_api_key():
            return request.make_json_response({"error": "Unauthorized"}, status=401)

        query = (kwargs.get("q") or "").strip()
        try:
            limit = max(1, min(int(kwargs.get("limit", 20)), 50))
        except (TypeError, ValueError):
            limit = 20

        domain = [
            ("is_snabbb_partner_product", "=", True),
            ("sale_ok", "=", True),
            ("active", "=", True),
        ]
        if query:
            domain += ["|", ("name", "ilike", query), ("default_code", "ilike", query)]

        templates = request.env["product.template"].sudo().search(domain, limit=limit)
        products = [template._elearning_product_payload() for template in templates]

        return request.make_json_response({"products": products})

    @http.route("/api/wallet/credit", type="json", auth="public", methods=["POST"], csrf=False)
    def credit_wallet(self, email=None, amount=None, currency=None, idempotency_key=None,
                       reason=None, metadata=None, **kwargs):
        if not _check_api_key():
            return {"ok": False, "error": "Unauthorized"}

        if not email or amount is None or not idempotency_key:
            return {"ok": False, "error": "email, amount and idempotency_key are required"}

        try:
            numeric_amount = float(amount)
        except (TypeError, ValueError):
            return {"ok": False, "error": "amount must be numeric"}

        if numeric_amount <= 0:
            return {"ok": False, "error": "amount must be positive"}

        partner = request.env["res.partner"].sudo().search(
            [("email", "=ilike", email)], limit=1
        )
        if not partner:
            _logger.warning("Snabbb E-Learning: wallet credit requested for unknown email %s", email)
            return {"ok": False, "error": "No Odoo partner found for that email"}

        source_reference = None
        if isinstance(metadata, dict):
            source_reference = "order:%s product:%s video:%s" % (
                metadata.get("order_id"),
                metadata.get("product_ref"),
                metadata.get("video_id"),
            )

        result = partner._snabbb_credit_wallet(
            amount=numeric_amount,
            reason=reason,
            idempotency_key=idempotency_key,
            source_reference=source_reference,
            currency=currency,
        )
        return result
