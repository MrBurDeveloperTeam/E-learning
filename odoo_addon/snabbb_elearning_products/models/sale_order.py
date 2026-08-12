# -*- coding: utf-8 -*-
import logging

import requests

from odoo import fields, models

_logger = logging.getLogger(__name__)

WEBHOOK_TIMEOUT_SECONDS = 8


class SaleOrder(models.Model):
    _inherit = "sale.order"

    elearning_ref_video_id = fields.Char(
        string="E-Learning video ref",
        help="Video id captured from the ?ref_video= param on the featured "
             "product link that started this order. Set once, on cart "
             "creation, by SnabbbElearningWebsiteSale in controllers/website_sale.py.",
        copy=False,
    )
    elearning_ref_creator_id = fields.Char(
        string="E-Learning creator ref",
        help="Doctor (creator) id captured from the ?ref_creator= param on "
             "the featured product link that started this order.",
        copy=False,
    )

    def _notify_elearning_purchase(self, status):
        """Best-effort POST to the E-Learning app's purchase webhook for
        every order line on a Snabbb-partner product, when this order
        carries E-Learning attribution.

        `status` is one of: 'paid', 'cancelled', 'refunded', 'failed'
        (matches ORDER_STATUS_MAP in functions/api/products/purchase-webhook.ts).

        Fire-and-forget by design: a webhook failure must never block order
        confirmation, payment processing, or cancellation. Errors are logged
        for manual follow-up.
        """
        for order in self:
            if not order.elearning_ref_video_id:
                continue

            ICP = self.env["ir.config_parameter"].sudo()
            enabled = ICP.get_param("snabbb_elearning.enabled", "True") in ("True", "true", "1")
            webhook_url = ICP.get_param("snabbb_elearning.webhook_url")
            webhook_secret = ICP.get_param("snabbb_elearning.webhook_secret")

            if not enabled or not webhook_url or not webhook_secret:
                _logger.info(
                    "Snabbb E-Learning webhook skipped for order %s: not configured "
                    "(see Settings > Snabbb E-Learning).",
                    order.name,
                )
                continue

            eligible_lines = order.order_line.filtered(
                lambda line: line.product_id.product_tmpl_id.is_snabbb_partner_product
            )
            if not eligible_lines:
                continue

            for line in eligible_lines:
                payload = {
                    "order_id": str(order.id),
                    "order_line_id": str(line.id),
                    "product_ref": line.product_id.product_tmpl_id._elearning_product_ref(),
                    "ref_video": order.elearning_ref_video_id,
                    "status": status,
                    "amount": line.price_total,
                    "currency": order.currency_id.name,
                    "buyer_email": order.partner_id.email,
                    "buyer_partner_id": str(order.partner_id.id),
                }

                try:
                    response = requests.post(
                        webhook_url,
                        json=payload,
                        headers={
                            "Content-Type": "application/json",
                            "X-Snabbb-Webhook-Secret": webhook_secret,
                        },
                        timeout=WEBHOOK_TIMEOUT_SECONDS,
                    )
                    if not response.ok:
                        _logger.warning(
                            "Snabbb E-Learning webhook returned %s for order %s line %s: %s",
                            response.status_code,
                            order.name,
                            line.id,
                            response.text[:500],
                        )
                except requests.RequestException:
                    _logger.exception(
                        "Snabbb E-Learning webhook call failed for order %s line %s",
                        order.name,
                        line.id,
                    )

    def action_cancel(self):
        result = super().action_cancel()
        self._notify_elearning_purchase("cancelled")
        return result
