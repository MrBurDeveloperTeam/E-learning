# -*- coding: utf-8 -*-
from odoo import fields, models


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    snabbb_elearning_enabled = fields.Boolean(
        string="Enable E-Learning product purchase integration",
        config_parameter="snabbb_elearning.enabled",
        default=True,
    )
    snabbb_elearning_webhook_url = fields.Char(
        string="E-Learning purchase webhook URL",
        config_parameter="snabbb_elearning.webhook_url",
        help="e.g. https://your-dentallearn-domain/api/products/purchase-webhook",
    )
    snabbb_elearning_webhook_secret = fields.Char(
        string="E-Learning webhook shared secret",
        config_parameter="snabbb_elearning.webhook_secret",
        help="Must match PRODUCT_WEBHOOK_SECRET configured on the E-Learning app's "
             "Cloudflare Pages project.",
    )
    snabbb_elearning_sso_api_key = fields.Char(
        string="E-Learning API key",
        config_parameter="snabbb_elearning.sso_api_key",
        help="Shared key the E-Learning app sends as X-SSO-API-KEY when calling "
             "this module's controllers (product search, wallet credit). Can reuse "
             "the same key already issued for ODOO_SSO_API_KEY in the E-Learning app "
             "if one exists, or a dedicated one.",
    )
