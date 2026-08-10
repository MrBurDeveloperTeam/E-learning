# -*- coding: utf-8 -*-
"""
Captures E-Learning attribution (?ref_video=&ref_creator=) from featured
product links (see src/components/video/FeaturedProductCard.tsx in the
DentalLearn repo) onto the shopper's cart order, so
sale_order._notify_elearning_purchase() can report the right video back to
the E-Learning app's purchase webhook once the order is paid.

ASSUMPTION: this inherits odoo.addons.website_sale.controllers.main.WebsiteSale,
which is the standard Odoo storefront. If the Snabbb shop is a customised or
differently-named module, point these overrides at the actual product-page
and cart routes instead — the important part is just: read ref_video/
ref_creator from the querystring, stash them in the session, and write them
onto request.website.sale_get_order() so they end up on the confirmed order.
"""
import logging

from odoo import http
from odoo.http import request

try:
    from odoo.addons.website_sale.controllers.main import WebsiteSale
except ImportError:  # pragma: no cover - defensive, see module docstring
    WebsiteSale = None

_logger = logging.getLogger(__name__)

SESSION_VIDEO_KEY = "snabbb_elearning_ref_video"
SESSION_CREATOR_KEY = "snabbb_elearning_ref_creator"


def _capture_and_stamp(**kwargs):
    """Reads ref_video/ref_creator from kwargs or the session, remembers
    them in the session, and writes them onto the current cart order if one
    exists and isn't already attributed (first-touch attribution)."""
    ref_video = kwargs.get("ref_video") or request.session.get(SESSION_VIDEO_KEY)
    ref_creator = kwargs.get("ref_creator") or request.session.get(SESSION_CREATOR_KEY)

    if kwargs.get("ref_video"):
        request.session[SESSION_VIDEO_KEY] = kwargs["ref_video"]
    if kwargs.get("ref_creator"):
        request.session[SESSION_CREATOR_KEY] = kwargs["ref_creator"]

    if not ref_video:
        return

    try:
        order = request.website.sale_get_order(force_create=True)
    except Exception:  # pragma: no cover - never let attribution break checkout
        _logger.exception("Snabbb E-Learning: could not fetch/create cart order to stamp attribution")
        return

    if order and not order.elearning_ref_video_id:
        order.sudo().write({
            "elearning_ref_video_id": ref_video,
            "elearning_ref_creator_id": ref_creator,
        })


if WebsiteSale is not None:

    class SnabbbElearningWebsiteSale(WebsiteSale):

        @http.route()
        def product(self, product, category="", search="", **kwargs):
            _capture_and_stamp(**kwargs)
            return super().product(product, category=category, search=search, **kwargs)

        @http.route()
        def cart(self, access_token=None, revive="", **kwargs):
            _capture_and_stamp(**kwargs)
            return super().cart(access_token=access_token, revive=revive, **kwargs)
