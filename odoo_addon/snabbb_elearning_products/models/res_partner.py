# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ResPartner(models.Model):
    _inherit = "res.partner"

    snabbb_credit_transaction_ids = fields.One2many(
        "snabbb.credit.transaction", "partner_id", string="Snabbb Credit transactions"
    )
    snabbb_credit_currency_id = fields.Many2one(
        "res.currency",
        compute="_compute_snabbb_credit_balance",
        string="Snabbb Credit currency",
    )
    snabbb_credit_balance = fields.Monetary(
        string="Snabbb Credit balance (E-Learning ledger)",
        compute="_compute_snabbb_credit_balance",
        currency_field="snabbb_credit_currency_id",
        help="Sum of this module's own credit ledger. NOTE: if Snabbb already has "
             "a dedicated wallet module backing the existing GET /api/wallet "
             "endpoint, this is a separate, parallel balance — see the "
             "integration note in _snabbb_credit_wallet() below and in the "
             "module description before relying on this in production.",
    )

    @api.depends("snabbb_credit_transaction_ids.amount", "snabbb_credit_transaction_ids.state")
    def _compute_snabbb_credit_balance(self):
        company_currency = self.env.company.currency_id
        for partner in self:
            done = partner.snabbb_credit_transaction_ids.filtered(lambda t: t.state == "done")
            partner.snabbb_credit_currency_id = company_currency
            partner.snabbb_credit_balance = sum(done.mapped("amount"))

    def _snabbb_credit_wallet(self, amount, reason, idempotency_key, source_reference=None, currency=None):
        """Single integration point for awarding Snabbb Credit, called by the
        POST /api/wallet/credit controller (see controllers/main.py) on
        behalf of the E-Learning app's purchase webhook.

        *** INTEGRATION NOTE ***
        This default implementation just writes to this module's own
        snabbb.credit.transaction ledger. If Snabbb already has a real
        wallet/loyalty module (there must be one, since GET /api/wallet
        already returns live balances elsewhere in the system), replace the
        body of this method with a call into that module's public API
        instead — keep the signature and idempotency guarantee the same so
        controllers/main.py doesn't need to change.

        Returns a plain dict; never raises, so a bad credit attempt can't
        take down the webhook response the E-Learning app is waiting on.
        """
        self.ensure_one()
        Transaction = self.env["snabbb.credit.transaction"].sudo()

        existing = Transaction.search([("idempotency_key", "=", idempotency_key)], limit=1)
        if existing:
            return {
                "ok": True,
                "already_processed": True,
                "balance": self.snabbb_credit_balance,
            }

        currency_record = self.env["res.currency"].search([("name", "=", currency)], limit=1) \
            if currency else self.env.company.currency_id

        Transaction.create({
            "partner_id": self.id,
            "amount": amount,
            "currency_id": (currency_record or self.env.company.currency_id).id,
            "reason": reason or "elearning_product_purchase",
            "source_reference": source_reference,
            "idempotency_key": idempotency_key,
            "state": "done",
        })

        return {"ok": True, "already_processed": False, "balance": self.snabbb_credit_balance}
