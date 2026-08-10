# -*- coding: utf-8 -*-
{
    "name": "Snabbb E-Learning Product Purchases",
    "version": "18.0.1.0.0",
    "category": "Sales/Sales",
    "summary": "Bridges Snabbb partner products, checkout attribution and Snabbb Credit "
                "with the DentalLearn E-Learning app's featured product buttons.",
    "description": """
Snabbb E-Learning Product Purchases
====================================

Supports the E-Learning "featured product" flow: doctors attach Snabbb
partner products to their videos, viewers buy through the attached link,
and the doctor earns Snabbb Credit once the order is actually paid.

This module is the Odoo-side counterpart to the DentalLearn E-Learning app
(see the ``functions/api/products/search.ts`` and
``functions/api/products/purchase-webhook.ts`` Cloudflare Pages Functions in
that repo). It:

- Flags which products are "Snabbb partner products" and exposes them
  through a read-only search endpoint the E-Learning app's product picker
  calls.
- Captures ``ref_video`` / ``ref_creator`` attribution from the featured
  product link onto the resulting sale order.
- Notifies the E-Learning app's purchase webhook when an order tied to a
  featured product is paid, cancelled, refunded, or fails.
- Exposes a wallet-credit endpoint the E-Learning app calls to award
  Snabbb Credit to the doctor, once it has computed the amount from its own
  admin-configured credit rule.

IMPORTANT: the wallet crediting model in this module (``snabbb.credit.transaction``)
is a self-contained placeholder ledger. If Snabbb already has a dedicated
wallet/loyalty module backing the existing ``GET /api/wallet`` endpoint,
replace the body of ``res.partner._snabbb_credit_wallet()`` in
``models/res_partner.py`` with a call into that module instead of using this
ledger, so there's a single source of truth for balances. That is the one
integration seam to check before deploying this module to production.
""",
    "author": "Snabbb",
    "website": "https://mrbur.odoo.com",
    "license": "LGPL-3",
    "depends": ["sale_management", "website_sale", "payment"],
    "external_dependencies": {"python": ["requests"]},
    "data": [
        "security/ir.model.access.csv",
        "views/res_config_settings_views.xml",
        "views/product_template_views.xml",
        "views/sale_order_views.xml",
        "views/snabbb_credit_transaction_views.xml",
    ],
    "installable": True,
    "application": False,
}
