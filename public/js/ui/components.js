/* ============================================================
   GAV – The Incense Route
   Module: Shared UI Components
   Path:   public/js/ui/components.js

   PURPOSE:
     - Reusable rendering helpers (no business logic).
     - Product card, list item, badge, empty state, spinner.
     - Modal + Confirm dialog builders.
     - Pi-only formatters.

   CONSTRAINTS:
     - No network calls.
     - No direct DOM queries of app state.
     - No GCV, no YER, no fiat. Pi-only.
     - All user-visible strings in Arabic.
     - All interpolation goes through escapeHtml().
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_UI_COMPONENTS_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/ui/components] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_UI_COMPONENTS_LOADED__ = true;

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPi(amount, decimals) {
        const n = Number(amount);
        const d = (typeof decimals === 'number') ? decimals : 2;
        if (!isFinite(n) || n < 0) return '0.' + '0'.repeat(d) + ' π';
        return n.toFixed(d) + ' π';
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return yyyy + '/' + mm + '/' + dd + ' ' + hh + ':' + mi;
        } catch (_) {
            return '—';
        }
    }

    function pad2(n) {
        return String(n).padStart(2, '0');
    }

    function relativeTime(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            const diff = Date.now() - d.getTime();
            const sec = Math.floor(diff / 1000);
            if (sec < 60)   return 'الآن';
            const min = Math.floor(sec / 60);
            if (min < 60)   return 'قبل ' + min + ' دقيقة';
            const hr = Math.floor(min / 60);
            if (hr < 24)    return 'قبل ' + hr + ' ساعة';
            const day = Math.floor(hr / 24);
            if (day < 30)   return 'قبل ' + day + ' يوم';
            return formatDate(iso);
        } catch (_) {
            return '—';
        }
    }

    /* --------------------------------------------
       Static HTML builders
       -------------------------------------------- */

    /**
     * Badge — status pill
     * variant: 'success' | 'warning' | 'danger' | 'info' | 'pi'
     */
    function renderBadge(text, variant) {
        const v = variant || 'info';
        const allowed = ['success', 'warning', 'danger', 'info', 'pi'];
        const safeVariant = allowed.indexOf(v) !== -1 ? v : 'info';
        return '<span class="badge badge-' + safeVariant + '">' +
               escapeHtml(text) +
               '</span>';
    }

    /**
     * Empty state block
     */
    function renderEmptyState(message) {
        const msg = message || 'لا توجد بيانات.';
        return '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>';
    }

    /**
     * Loading state block (spinner style, matches existing CSS)
     */
    function renderLoadingState(message) {
        const msg = message || 'جاري التحميل...';
        return '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>';
    }

    /**
     * Product card (used in marketplace grid)
     * product: { id, name, price (Pi), merchantName?, image? }
     * options: { addToCart: boolean }
     */
    function renderProductCard(product, options) {
        options = options || {};
        if (!product || typeof product !== 'object') {
            return renderEmptyState('منتج غير صالح.');
        }

        const id       = escapeHtml(product.id || '');
        const name     = escapeHtml(product.name || 'منتج');
        const price    = formatPi(product.price, 2);
        const merchant = product.merchantName
            ? escapeHtml(product.merchantName)
            : '';

        const imageHtml = product.image
            ? '<img src="' + escapeHtml(product.image) + '" alt="' + name + '" loading="lazy" />'
            : '📦';

        const addBtn = options.addToCart === true
            ? '<button class="btn btn-primary btn-block" style="margin-top:0.5rem;" data-add-cart="' + id + '">➕ أضف إلى السلة</button>'
            : '';

        return '' +
            '<div class="product-card" data-product-id="' + id + '">' +
                '<div class="product-image">' + imageHtml + '</div>' +
                '<div class="product-info">' +
                    '<div class="product-name">' + name + '</div>' +
                    (merchant ? '<div class="product-merchant">' + merchant + '</div>' : '') +
                    '<div class="product-price">' + price + '</div>' +
                    addBtn +
                '</div>' +
            '</div>';
    }

    /**
     * Generic list item
     * item: { id?, icon?, title, subtitle?, amount?, date?, badgeText?, badgeVariant?, actions? }
     * actions: array of { label, action, variant? }
     */
    function renderListItem(item) {
        if (!item || typeof item !== 'object') return '';

        const id     = item.id ? escapeHtml(item.id) : '';
        const icon   = item.icon ? escapeHtml(item.icon) : '•';
        const title  = escapeHtml(item.title || '—');
        const sub    = item.subtitle ? escapeHtml(item.subtitle) : '';
        const amount = item.amount ? escapeHtml(item.amount) : '';
        const date   = item.date ? escapeHtml(item.date) : '';

        const badge = item.badgeText
            ? ' ' + renderBadge(item.badgeText, item.badgeVariant || 'info')
            : '';

        let actionsHtml = '';
        if (Array.isArray(item.actions) && item.actions.length) {
            actionsHtml = '<div style="display:flex;gap:0.25rem;margin-top:0.25rem;">' +
                item.actions.map(function (a) {
                    const label   = escapeHtml(a.label || '');
                    const action  = escapeHtml(a.action || '');
                    const variant = (a.variant === 'secondary') ? 'btn-secondary' : 'btn-primary';
                    return '<button class="btn ' + variant + '" ' +
                           'style="padding:0.35rem 0.6rem;font-size:0.75rem;" ' +
                           'data-action="' + action + '" ' +
                           'data-item-id="' + id + '">' + label + '</button>';
                }).join('') +
            '</div>';
        }

        return '' +
            '<div class="list-item"' + (id ? ' data-item-id="' + id + '"' : '') + '>' +
                '<div class="list-item-icon">' + icon + '</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">' + title + badge + '</div>' +
                    (sub ? '<div class="list-item-subtitle">' + sub + '</div>' : '') +
                    actionsHtml +
                '</div>' +
                ((amount || date)
                    ? '<div class="list-item-meta">' +
                          (amount ? '<div class="list-item-amount">' + amount + '</div>' : '') +
                          (date   ? '<div class="list-item-date">'   + date   + '</div>' : '') +
                      '</div>'
                    : '') +
            '</div>';
    }

    /**
     * Stat card
     */
    function renderStatCard(label, value) {
        return '' +
            '<div class="stat-card">' +
                '<span class="stat-label">' + escapeHtml(label || '') + '</span>' +
                '<span class="stat-value">' + escapeHtml(String(value == null ? '0' : value)) + '</span>' +
            '</div>';
    }

    /* --------------------------------------------
       Modal builder
       -------------------------------------------- */
    /**
     * showModal({ title, bodyHTML, footerHTML, onClose, onMount })
     * Returns { close() } handle.
     */
    function showModal(config) {
        config = config || {};

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        const titleHTML  = escapeHtml(config.title || '');
        const bodyHTML   = config.bodyHTML || '';
        const footerHTML = config.footerHTML || '';

        overlay.innerHTML = '' +
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<div class="modal-title">' + titleHTML + '</div>' +
                    '<button class="modal-close" data-modal-close aria-label="إغلاق">✕</button>' +
                '</div>' +
                '<div class="modal-body">' + bodyHTML + '</div>' +
                (footerHTML ? '<div class="modal-footer">' + footerHTML + '</div>' : '') +
            '</div>';

        document.body.appendChild(overlay);

        let closed = false;

        function close() {
            if (closed) return;
            closed = true;
            window.removeEventListener('keydown', onKey, false);
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (typeof config.onClose === 'function') {
                try { config.onClose(); } catch (_) {}
            }
        }

        function onKey(e) {
            if (e.key === 'Escape') close();
        }

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { close(); return; }
            const t = e.target.closest ? e.target.closest('[data-modal-close]') : null;
            if (t) { close(); return; }
        }, false);

        window.addEventListener('keydown', onKey, false);

        if (typeof config.onMount === 'function') {
            try { config.onMount(overlay, close); } catch (err) {
                if (window.console) console.error('[GAV/ui] onMount error:', err);
            }
        }

        return { el: overlay, close: close };
    }

    /**
     * showConfirm({ title, message, confirmText, cancelText, danger })
     * Returns Promise<boolean>.
     */
    function showConfirm(config) {
        config = config || {};

        return new Promise(function (resolve) {
            let resolved = false;

            function finish(value) {
                if (resolved) return;
                resolved = true;
                resolve(value);
            }

            const confirmText = escapeHtml(config.confirmText || 'تأكيد');
            const cancelText  = escapeHtml(config.cancelText  || 'إلغاء');
            const variant     = config.danger ? 'btn-danger' : 'btn-primary';

            const footerHTML =
                '<button class="btn btn-secondary" data-confirm-cancel>' + cancelText + '</button>' +
                '<button class="btn ' + variant + '" data-confirm-ok>' + confirmText + '</button>';

            const handle = showModal({
                title: config.title || 'تأكيد',
                bodyHTML: '<p style="text-align:center;color:var(--text-secondary);">' +
                          escapeHtml(config.message || '') + '</p>',
                footerHTML: footerHTML,
                onClose: function () { finish(false); },
                onMount: function (overlay, close) {
                    overlay.addEventListener('click', function (e) {
                        const ok  = e.target.closest && e.target.closest('[data-confirm-ok]');
                        const can = e.target.closest && e.target.closest('[data-confirm-cancel]');
                        if (ok)  { finish(true);  close(); }
                        if (can) { finish(false); close(); }
                    }, false);
                }
            });

            // If the caller somehow removed the modal externally, we still resolve false.
            void handle;
        });
    }

    /* --------------------------------------------
       Focus / a11y helper
       -------------------------------------------- */
    function focusFirstInput(rootEl) {
        if (!rootEl) return;
        const el = rootEl.querySelector('input, select, textarea, button');
        if (el && typeof el.focus === 'function') {
            try { el.focus(); } catch (_) {}
        }
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavUI = Object.freeze({
        escapeHtml:        escapeHtml,
        formatPi:          formatPi,
        formatDate:        formatDate,
        relativeTime:      relativeTime,
        pad2:              pad2,

        renderBadge:        renderBadge,
        renderEmptyState:   renderEmptyState,
        renderLoadingState: renderLoadingState,
        renderProductCard:  renderProductCard,
        renderListItem:     renderListItem,
        renderStatCard:     renderStatCard,

        showModal:          showModal,
        showConfirm:        showConfirm,
        focusFirstInput:    focusFirstInput
    });

    if (window.console && console.info) {
        console.info('[GAV/ui/components] Ready.');
    }

})();