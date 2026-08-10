# -*- coding: utf-8 -*-
from odoo import fields, models


class SnabbbCreditTransaction(models.Model):
    _name = "snabbb.credit.transaction"
    _description = "Snabbb Credit ledger entry"
    _order = "create_date desc"

    partner_id = fields.Many2one("res.partner", required=True, index=True, ondelete="cascade")
    amount = fields.Monetary(required=True, currency_field="currency_id")
    currency_id = fields.Many2one("res.currency", required=True,
                                   default=lambda self: self.env.company.currency_id)
    reason = fields.Selection(
        [("elearning_product_purchase", "E-Learning product purchase")],
        required=True,
        default="elearning_product_purchase",
    )
    source_reference = fields.Char(
        help="e.g. 'order:<id> product:<ref>' — free-form pointer back to what earned this credit."
    )
    idempotency_key = fields.Char(
        required=True,
        help="Prevents the same webhook delivery from crediting a doctor twice.",
    )
    state = fields.Selection(
        [("done", "Done"), ("failed", "Failed")],
        default="done",
        required=True,
    )

    _sql_constraints = [
        (
            "idempotency_key_uniq",
            "unique(idempotency_key)",
            "A Snabbb Credit transaction with this idempotency key already exists.",
        ),
    ]
