/* Mobile Tetris controls: swipe, tap, double tap, long press and HOLD C. */
(function () {
    var viewport = document.getElementById('tetris-viewport');
    var overlay = document.getElementById('overlay');
    var holdButton = document.getElementById('mobile-hold-button');
    var guideButton = document.getElementById('mobile-guide-button');
    var guideModal = document.getElementById('mobile-guide-modal');
    var closeButtons = document.querySelectorAll('[data-mobile-guide-close]');
    if (!viewport) return;

    var isTouch = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    var pointerId = null, startX = 0, startY = 0, startAt = 0, horizontalStep = 0;
    var moved = false, longPressed = false, longTimer = 0, downTimer = 0, tapTimer = 0;
    var lastTapAt = 0, lastTapX = 0, lastTapY = 0;
    var SWIPE_STEP = 28, MOVE_LIMIT = 14, LONG_DELAY = 380, DOUBLE_DELAY = 240;

    function key(type, code, repeat) {
        var values = { ArrowUp: ['ArrowUp', 38], ArrowDown: ['ArrowDown', 40], Space: [' ', 32], KeyC: ['c', 67] };
        var value = values[code];
        if (!value) return;
        var event = new KeyboardEvent(type, { key: value[0], code: code, bubbles: true, cancelable: true, repeat: !!repeat });
        try {
            Object.defineProperty(event, 'keyCode', { get: function () { return value[1]; } });
            Object.defineProperty(event, 'which', { get: function () { return value[1]; } });
        } catch (_) {}
        document.body.dispatchEvent(event);
    }
    function press(code) { key('keydown', code, false); key('keyup', code, false); }
    function overlayVisible() {
        return (guideModal && !guideModal.hidden) || (overlay && getComputedStyle(overlay).display !== 'none');
    }
    function interactive(target) { return target instanceof Element && !!target.closest('button,a,input,select,textarea'); }
    function horizontal(direction) {
        var api = window.tetrisMobileApi;
        if (!api) return;
        if (direction < 0 && api.moveLeft) api.moveLeft();
        if (direction > 0 && api.moveRight) api.moveRight();
    }
    function startDown() {
        if (downTimer) return;
        key('keydown', 'ArrowDown', false);
        downTimer = setInterval(function () { key('keydown', 'ArrowDown', true); }, 70);
    }
    function stopDown() {
        if (downTimer) clearInterval(downTimer);
        downTimer = 0;
        key('keyup', 'ArrowDown', false);
    }
    function reset() {
        if (longTimer) clearTimeout(longTimer);
        pointerId = null; longTimer = 0; moved = false; longPressed = false; horizontalStep = 0;
        stopDown();
    }
    function tap(x, y) {
        var now = Date.now();
        var near = Math.hypot(x - lastTapX, y - lastTapY) <= 48;
        if (tapTimer && now - lastTapAt <= DOUBLE_DELAY && near) {
            clearTimeout(tapTimer); tapTimer = 0; lastTapAt = 0; press('ArrowUp'); return;
        }
        if (tapTimer) { clearTimeout(tapTimer); press('Space'); }
        lastTapAt = now; lastTapX = x; lastTapY = y;
        tapTimer = setTimeout(function () { tapTimer = 0; lastTapAt = 0; press('Space'); }, DOUBLE_DELAY);
    }

    if (isTouch) {
        viewport.addEventListener('pointerdown', function (event) {
            if (pointerId !== null || overlayVisible() || interactive(event.target)) return;
            event.preventDefault(); pointerId = event.pointerId; startX = event.clientX; startY = event.clientY;
            startAt = Date.now(); horizontalStep = 0; moved = false; longPressed = false;
            try { viewport.setPointerCapture(pointerId); } catch (_) {}
            longTimer = setTimeout(function () { if (pointerId === event.pointerId && !moved) { longPressed = true; startDown(); } }, LONG_DELAY);
        }, { passive: false });
        viewport.addEventListener('pointermove', function (event) {
            if (event.pointerId !== pointerId) return;
            event.preventDefault();
            var dx = event.clientX - startX, dy = event.clientY - startY;
            if (Math.abs(dx) > MOVE_LIMIT || Math.abs(dy) > MOVE_LIMIT) {
                moved = true; if (longTimer) clearTimeout(longTimer); longTimer = 0;
                if (longPressed) { longPressed = false; stopDown(); }
            }
            if (Math.abs(dx) > Math.abs(dy) * 1.15) {
                var target = Math.trunc(dx / SWIPE_STEP);
                while (horizontalStep < target) { horizontal(1); horizontalStep++; }
                while (horizontalStep > target) { horizontal(-1); horizontalStep--; }
            }
        }, { passive: false });
        viewport.addEventListener('pointerup', function (event) {
            if (event.pointerId !== pointerId) return;
            event.preventDefault();
            var distance = Math.hypot(event.clientX - startX, event.clientY - startY);
            var wasLong = longPressed, usedSwipe = horizontalStep !== 0;
            if (!wasLong && !usedSwipe && distance <= MOVE_LIMIT && Date.now() - startAt < LONG_DELAY) tap(event.clientX, event.clientY);
            reset();
        }, { passive: false });
        viewport.addEventListener('pointercancel', reset, { passive: false });
        viewport.addEventListener('contextmenu', function (event) { event.preventDefault(); });
    }

    function syncHold() {
        if (holdButton) holdButton.classList.toggle('is-gameplay-visible', isTouch && !overlayVisible());
    }
    function openGuide() { if (!guideModal) return; reset(); guideModal.hidden = false; guideButton.setAttribute('aria-expanded', 'true'); syncHold(); }
    function closeGuide() { if (!guideModal) return; guideModal.hidden = true; guideButton.setAttribute('aria-expanded', 'false'); syncHold(); }
    if (guideButton) guideButton.addEventListener('click', function (event) { event.stopPropagation(); openGuide(); });
    closeButtons.forEach(function (button) { button.addEventListener('click', function (event) { event.stopPropagation(); closeGuide(); }); });
    if (holdButton) holdButton.addEventListener('click', function (event) { event.stopPropagation(); press('KeyC'); });
    syncHold();
    if (overlay && window.MutationObserver) new MutationObserver(syncHold).observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', function () { if (document.hidden) reset(); });
})();
