# -*- coding: utf-8 -*-
"""
Odoo-side counterpart to the DentalLearn E-Learning app's product-purchase
feature:

  GET  /api/v1/products/search   <- functions/api/products/search.ts
  POST /api/wallet/credit        <- functions/api/products/purchase-webhook.ts

Both endpoints authenticate with a shared key sent as X-SSO-API-KEY, checked
against the `snabbb_elearning.sso_api_key` system parameter (Settings >
General Settings > Snabbb E-Learning). This mirrors the X-SSO-API-KEY
pattern already used elsewhere for Odoo<->E-Learning calls
(see _shared/auth.ts createOdooUser in the E-Learning repo).
"""
import logging

from odoo import http
from odoo.http import request

_logger = logging.getLogger(__name__)


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
