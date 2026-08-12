# -*- coding: utf-8 -*-
from odoo import fields, models


class ProductTemplate(models.Model):
    _inherit = "product.template"

    is_snabbb_partner_product = fields.Boolean(
        string="Snabbb Partner Product",
        default=False,
        help="Products doctors can attach to E-Learning videos as featured "
             "products. Only products flagged here are returned by the "
             "E-Learning app's 'Add product' search.",
    )

    def _elearning_product_ref(self):
        """Stable identifier sent to the E-Learning app and echoed back on
        purchase webhooks so a doctor's video attachment can be matched to
        the order line it generated. Prefers the internal reference
        (default_code) since that's stable across price/stock changes;
        falls back to the template id if none is set.
        """
        self.ensure_one()
        return self.default_code or str(self.id)

    def _elearning_product_payload(self):
        """Shape expected by the E-Learning app's product search proxy
        (functions/api/products/search.ts -> mapOdooProduct)."""
        self.ensure_one()
        price = self.list_price
        currency = self.currency_id.name or "MYR"
        image_url = False
        if self.image_1920:
            image_url = "/web/image/product.template/%s/image_1920" % self.id

        base_url = self.env["ir.config_parameter"].sudo().get_param("web.base.url", "")
        product_url = "%s/shop/product/%s" % (base_url.rstrip("/"), self.id)

        return {
            "product_ref": self._elearning_product_ref(),
            "name": self.name,
            "image_url": image_url and "%s%s" % (base_url.rstrip("/"), image_url) or None,
            "price": price,
            "currency": currency,
            "product_url": product_url,
            "in_stock": (self.qty_available > 0) if "qty_available" in self._fields else True,
        }
