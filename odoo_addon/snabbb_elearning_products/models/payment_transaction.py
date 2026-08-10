# -*- coding: utf-8 -*-
"""
Hooks into Odoo's payment transaction state machine (_set_done / _set_canceled
/ _set_error — the standard extension points in odoo/addons/payment's
payment.transaction model since Odoo 17) to notify the E-Learning app's
purchase webhook at the moment an order's payment status actually changes,
rather than guessing from sale.order.state alone.

ASSUMPTION: relies on payment.transaction.sale_order_ids, the standard link
Odoo's `sale` + `payment` integration sets up between a transaction and the
order(s) it pays for. If Snabbb's checkout uses a different payment
integration (e.g. a fully custom flow that bypasses payment.transaction),
this file's hooks won't fire — wire _notify_elearning_purchase() (see
sale_order.py) into whatever confirms payment there instead.
"""
from odoo import models


class PaymentTransaction(models.Model):
    _inherit = "payment.transaction"

    # *args/**kwargs pass-through throughout: the exact keyword signature of
    # these state-transition hooks has shifted a little release to release
    # (e.g. an optional state message argument on _set_error). Forwarding
    # everything untouched keeps this compatible without pinning to one
    # exact signature.

    def _set_done(self, *args, **kwargs):
        result = super()._set_done(*args, **kwargs)
        for tx in self:
            status = "refunded" if getattr(tx, "operation", None) == "refund" else "paid"
            tx.sale_order_ids._notify_elearning_purchase(status)
        return result

    def _set_canceled(self, *args, **kwargs):
        result = super()._set_canceled(*args, **kwargs)
        self.sale_order_ids._notify_elearning_purchase("cancelled")
        return result

    def _set_error(self, *args, **kwargs):
        result = super()._set_error(*args, **kwargs)
        self.sale_order_ids._notify_elearning_purchase("failed")
        return result
