/* ============================================================
   GAV – The Incense Route
   Module: Toast Notifications
   Path:   public/js/ui/notifications.js

   PURPOSE:
     - Global window.showToast(type, message, options).
     - Manages #toast-container lifecycle.
     - Auto-dismiss with fade-out animation.
     - Deduplicates identical consecutive toasts.
     - Queue-safe: caps visible toasts to avoid flooding.

   CONSTRAINTS:
     - No network calls.
     - No business logic.
     - All user-visible strings rendered as text (never HTML).
     - Arabic-first.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const CONTAINER_ID   = 'toast-container';
    const DEFAULT_TTL    = 4000;    // ms
    const MAX_VISIBLE    = 4;
    const FADE_OUT_MS    = 300;

    const ALLOWED_TYPES = ['success', 'info', 'warning', 'error'];

    const TYPE_ICONS = Object.freeze({
        success: '✓',
        info:    'ℹ',
        warning: '⚠',
        error:   '✕'
    });

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_NOTIFICATIONS_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/notifications] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_NOTIFICATIONS_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        visible: [],           // { id, el, timer }
        lastMessage: null,
        lastAt: 0
    };

    let nextId = 1;

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/notifications] ' + msg, data);
        else                     fn.call(console, '[GAV/notifications] ' + msg);
    }

    function normalizeType(type) {
        if (!type) return 'info';
        const t = String(type).toLowerCase().trim();
        return ALLOWED_TYPES.indexOf(t) !== -1 ? t : 'info';
    }

    function getContainer() {
        let el = document.getElementById(CONTAINER_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = CONTAINER_ID;
            el.className = 'toast-container';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            el.setAttribute('aria-atomic', 'false');
            document.body.appendChild(el);
            safeLog('info', 'Created toast container dynamically.');
        }
        return el;
    }

    /* --------------------------------------------
       Removal
       -------------------------------------------- */
    function removeToast(entry) {
        if (!entry || entry.removing) return;
        entry.removing = true;

        if (entry.timer) {
            clearTimeout(entry.timer);
            entry.timer = null;
        }

        const el = entry.el;
        if (!el || !el.parentNode) {
            state.visible = state.visible.filter(function (x) { return x.id !== entry.id; });
            return;
        }

        el.classList.add('fade-out');

        setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
            state.visible = state.visible.filter(function (x) { return x.id !== entry.id; });
        }, FADE_OUT_MS);
    }

    function clearAll() {
        state.visible.slice().forEach(removeToast);
    }

    /* --------------------------------------------
       Core show
       -------------------------------------------- */
    function show(type, message, options) {
        options = options || {};

        // Support legacy call pattern show(message)
        if (type && typeof type === 'object' && !message) {
            options = type;
            message = options.message;
            type    = options.type;
        }

        const safeType = normalizeType(type);
        const text     = (message == null) ? '' : String(message);
        if (!text) {
            safeLog('warn', 'showToast called without message.');
            return null;
        }

        // Dedupe identical consecutive messages within 800ms
        const now = Date.now();
        if (state.lastMessage === text && (now - state.lastAt) < 800) {
            return null;
        }
        state.lastMessage = text;
        state.lastAt = now;

        const ttl = (typeof options.ttl === 'number' && options.ttl > 0)
            ? options.ttl
            : DEFAULT_TTL;

        const container = getContainer();

        // Cap visible toasts
        while (state.visible.length >= MAX_VISIBLE) {
            const oldest = state.visible[0];
            if (oldest) removeToast(oldest);
            else break;
        }

        // Build element via DOM API (safe; no HTML injection)
        const el = document.createElement('div');
        el.className = 'toast toast-' + safeType;
        el.setAttribute('data-toast-id', String(nextId));

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.setAttribute('aria-hidden', 'true');
        icon.textContent = TYPE_ICONS[safeType] || '•';

        const msg = document.createElement('span');
        msg.className = 'toast-message';
        msg.textContent = text;

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'إغلاق الإشعار');
        closeBtn.type = 'button';
        closeBtn.textContent = '✕';
        closeBtn.style.background = 'transparent';
        closeBtn.style.border = 'none';
        closeBtn.style.color = 'inherit';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '0.9rem';
        closeBtn.style.opacity = '0.7';
        closeBtn.style.marginRight = 'auto';
        closeBtn.style.padding = '0 0.25rem';

        el.appendChild(icon);
        el.appendChild(msg);
        el.appendChild(closeBtn);

        const entry = { id: nextId++, el: el, timer: null, removing: false };
        state.visible.push(entry);

        closeBtn.addEventListener('click', function () {
            removeToast(entry);
        }, false);

        // Click anywhere on toast dismisses (except on links/buttons inside)
        el.addEventListener('click', function (e) {
            const t = e.target;
            if (t && t.tagName && (t.tagName === 'A' || t.tagName === 'BUTTON')) return;
            removeToast(entry);
        }, false);

        container.appendChild(el);

        if (ttl > 0) {
            entry.timer = setTimeout(function () {
                removeToast(entry);
            }, ttl);
        }

        return entry.id;
    }

    /* --------------------------------------------
       Convenience wrappers
       -------------------------------------------- */
    function success(message, options) { return show('success', message, options); }
    function info(message, options)    { return show('info',    message, options); }
    function warning(message, options) { return show('warning', message, options); }
    function error(message, options)   { return show('error',   message, options); }

    /* --------------------------------------------
       Pi-payment specific helper
       -------------------------------------------- */
    function notifyPiPayment(status, paymentId, options) {
        options = options || {};
        const idText = paymentId ? (' (' + paymentId + ')') : '';

        switch (status) {
            case 'created':
                return info('تم إنشاء طلب الدفع' + idText + '.', options);
            case 'approved':
                return info('تم اعتماد الدفع على الخادم' + idText + '.', options);
            case 'completed':
                return success('تم إتمام الدفع بنجاح' + idText + ' 🎉', options);
            case 'cancelled':
                return warning('تم إلغاء عملية الدفع' + idText + '.', options);
            case 'failed':
                return error('فشلت عملية الدفع' + idText + '.', options);
            case 'incomplete':
                return warning('يوجد دفع غير مكتمل' + idText + ' قيد المعالجة.', options);
            default:
                return info('تحديث حالة الدفع' + idText + '.', options);
        }
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.showToast = function (type, message, options) {
        return show(type, message, options);
    };

    window.GavNotify = Object.freeze({
        show:            show,
        success:         success,
        info:            info,
        warning:         warning,
        error:           error,
        clearAll:        clearAll,
        notifyPiPayment: notifyPiPayment
    });

    if (window.console && console.info) {
        console.info('[GAV/notifications] Ready.');
    }

})();