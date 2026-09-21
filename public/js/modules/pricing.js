/* ============================================================
   GAV – The Incense Route
   Module: GAV Reference Index (Pricing)
   Path:   public/js/modules/pricing.js

   PURPOSE:
     - Display the internal GAV reference index table.
     - All values are Pi (π) only.
     - Show a mandatory disclaimer that this is NOT GCV and
       NOT a global price — it is an internal reference only.

   HARD RULES:
     - No GCV. No "Global Consensus Value". No 314,159.
     - No YER. No fiat. No currency conversion.
     - Pi-only reference values.
     - Read-only (server-authoritative).

   CONSTRAINTS:
     - No direct fetch() — through GavApi.
     - No fake data. Empty state if server returns nothing.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VIEW_NAME       = 'reference-index';
    const CONTAINER_ID    = 'reference-index-table';

    const DISCLAIMER_AR =
        'هذا المؤشر مرجعي داخلي لنظام GAV فقط، ويُعبَّر عنه بوحدات Pi (π). ' +
        'وهو ليس "قيمة توافق عالمي" (GCV)، وليس سعراً عالمياً رسمياً، ' +
        'ولا يمثل بأي شكل سعر الصرف الرسمي لشبكة Pi.';

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_PRICING_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/pricing] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_PRICING_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        rows:        [],
        loading:     false,
        loadedOnce:  false,
        updatedAt:   null
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/pricing] ' + msg, data);
        else                     fn.call(console, '[GAV/pricing] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatPi(amount) {
        const n = Number(amount);
        if (!isFinite(n) || n < 0) return '—';
        return n.toFixed(4) + ' π';
    }

    function formatPercent(change) {
        const n = Number(change);
        if (!isFinite(n)) return '—';
        const sign = n > 0 ? '+' : '';
        return sign + n.toFixed(2) + '%';
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

    function normalizeRows(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.index)) return data.index;
        if (Array.isArray(data.rows)) return data.rows;
        if (Array.isArray(data.items)) return data.items;
        return [];
    }

    /* --------------------------------------------
       Renderers
       -------------------------------------------- */
    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state"><p>جاري تحميل المؤشر المرجعي...</p></div>';
    }

    function renderEmpty(customMsg) {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        const msg = customMsg || 'لا توجد بيانات في المؤشر المرجعي حالياً.';
        wrap.innerHTML =
            '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>' +
            renderDisclaimer();
    }

    function renderError(msg) {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state"><p>' + escapeHtml(msg || 'تعذّر تحميل المؤشر.') + '</p></div>' +
            renderDisclaimer();
    }

    function renderDisclaimer() {
        return '<div class="index-disclaimer">⚠️ ' + escapeHtml(DISCLAIMER_AR) + '</div>';
    }

    function renderHeader() {
        return '' +
            '<div class="index-row index-header">' +
                '<div class="index-cell">المنتج</div>' +
                '<div class="index-cell numeric">القيمة المرجعية (π)</div>' +
                '<div class="index-cell numeric">التغير</div>' +
                '<div class="index-cell numeric">آخر تحديث</div>' +
            '</div>';
    }

    function renderRow(row) {
        const name   = escapeHtml(row.name || row.productName || '—');
        const price  = formatPi(row.referencePi != null ? row.referencePi : row.price);
        const change = formatPercent(row.changePercent != null ? row.changePercent : row.change);
        const date   = formatDate(row.updatedAt || row.timestamp);

        const changeClass =
            Number(row.changePercent || row.change) > 0 ? 'text-success' :
            Number(row.changePercent || row.change) < 0 ? 'text-danger'  : '';

        return '' +
            '<div class="index-row">' +
                '<div class="index-cell">' + name + '</div>' +
                '<div class="index-cell numeric">' + price + '</div>' +
                '<div class="index-cell numeric ' + changeClass + '">' + change + '</div>' +
                '<div class="index-cell numeric">' + date + '</div>' +
            '</div>';
    }

    function renderFooterMeta() {
        if (!state.updatedAt) return '';
        return '' +
            '<div class="form-hint" style="margin-top:0.5rem;text-align:center;">' +
                'آخر تحديث للمؤشر: ' + escapeHtml(formatDate(state.updatedAt)) +
            '</div>';
    }

    function renderTable() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;

        if (!state.rows.length) {
            renderEmpty();
            return;
        }

        const html = '' +
            renderHeader() +
            state.rows.map(renderRow).join('') +
            renderDisclaimer() +
            renderFooterMeta();

        wrap.innerHTML = html;
    }

    /* --------------------------------------------
       Data fetch
       -------------------------------------------- */
    async function loadIndex(options) {
        options = options || {};
        if (state.loading) return;
        if (!options.force && state.loadedOnce) return;

        if (!window.GavApi || !window.GavApi.endpoints) {
            renderError('خدمة المؤشر غير جاهزة.');
            return;
        }

        state.loading = true;
        renderLoading();

        const res = await window.GavApi.endpoints.getReferenceIndex();

        state.loading = false;

        if (!res || !res.ok) {
            renderError((res && res.error) || 'تعذّر تحميل المؤشر المرجعي.');
            safeLog('warn', 'loadIndex failed:', res);
            return;
        }

        const data = res.data || {};
        state.rows = normalizeRows(data);
        state.updatedAt = data.updatedAt || data.timestamp || null;
        state.loadedOnce = true;

        renderTable();
        safeLog('info', 'Reference index loaded: ' + state.rows.length + ' row(s).');
    }

    /* --------------------------------------------
       Event handlers
       -------------------------------------------- */
    function onViewChange(e) {
        const to = e && e.detail ? e.detail.to : null;
        if (to === VIEW_NAME) {
            loadIndex({ force: false });
        }
    }

    function onAuthLogout() {
        // Public read-only view — we keep data, but reset cached state.
        state.loadedOnce = false;
    }

    /* --------------------------------------------
       Wiring
       -------------------------------------------- */
    function bindEvents() {
        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:logout',  onAuthLogout,  false);
    }

    /* --------------------------------------------
       Init
       -------------------------------------------- */
    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        bindEvents();

        const currentView = window.GavRouter && window.GavRouter.current
            ? window.GavRouter.current()
            : null;

        if (currentView === VIEW_NAME) {
            loadIndex({ force: true });
        }

        safeLog('info', 'Pricing (reference-index) module initialized.');
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavPricing = Object.freeze({
        init:   init,
        reload: function () { return loadIndex({ force: true }); },
        getRows: function () {
            return state.rows.map(function (r) { return Object.assign({}, r); });
        },
        getDisclaimer: function () { return DISCLAIMER_AR; }
    });

    /* --------------------------------------------
       Bootstrap
       -------------------------------------------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();