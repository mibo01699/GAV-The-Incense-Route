/* ============================================================
   GAV – Module: GAV Reference Index (Pricing)
   Path:   public/js/modules/pricing.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'reference-index';
    const CONTAINER_ID = 'reference-index-table';

    const DISCLAIMER_AR = 'هذا المؤشر مرجعي داخلي لنظام GAV فقط، ويُعبَّر عنه بوحدات Pi (π). ' +
        'وهو ليس "قيمة توافق عالمي" (GCV)، وليس سعراً عالمياً رسمياً، ' +
        'ولا يمثل بأي شكل سعر الصرف الرسمي لشبكة Pi.';

    if (window.__GAV_PRICING_LOADED__ === true) return;
    window.__GAV_PRICING_LOADED__ = true;

    const state = { rows: [], loading: false, loadedOnce: false, updatedAt: null };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/pricing] ' + msg, data);
        else fn.call(console, '[GAV/pricing] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatPi(amount) {
        const n = Number(amount);
        if (!isFinite(n) || n < 0) return '—';
        return n.toFixed(4) + ' π';
    }

    function formatPercent(v) {
        const n = Number(v);
        if (!isFinite(n)) return '—';
        return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') +
                ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        } catch (_) { return '—'; }
    }

    function normalizeRows(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.index)) return data.index;
        if (Array.isArray(data.rows)) return data.rows;
        return [];
    }

    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderDisclaimer() {
        return '<div class="index-disclaimer">⚠️ ' + escapeHtml(DISCLAIMER_AR) + '</div>';
    }

    function renderEmpty(msg) {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد بيانات.') + '</p></div>' + renderDisclaimer();
    }

    function renderHeader() {
        return '<div class="index-row index-header">' +
            '<div class="index-cell">المنتج</div>' +
            '<div class="index-cell numeric">القيمة (π)</div>' +
            '<div class="index-cell numeric">التغير</div>' +
            '<div class="index-cell numeric">آخر تحديث</div>' +
            '</div>';
    }

    function renderRow(row) {
        const name = escapeHtml(row.name || row.productName || '—');
        const price = formatPi(row.referencePi != null ? row.referencePi : row.price);
        const change = formatPercent(row.changePercent != null ? row.changePercent : row.change);
        const date = formatDate(row.updatedAt || row.timestamp);
        const cls = Number(row.changePercent || row.change) > 0 ? 'text-success' :
                    Number(row.changePercent || row.change) < 0 ? 'text-danger' : '';
        return '<div class="index-row">' +
            '<div class="index-cell">' + name + '</div>' +
            '<div class="index-cell numeric">' + price + '</div>' +
            '<div class="index-cell numeric ' + cls + '">' + change + '</div>' +
            '<div class="index-cell numeric">' + date + '</div>' +
            '</div>';
    }

    function renderTable() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (!state.rows.length) { renderEmpty(); return; }
        wrap.innerHTML = renderHeader() + state.rows.map(renderRow).join('') + renderDisclaimer();
    }

    async function loadIndex(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints) { renderEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderLoading();

        let res;
        try { res = await window.GavApi.endpoints.getReferenceIndex(); }
        catch (err) { state.loading = false; renderEmpty('تعذّر الاتصال.'); return; }

        state.loading = false;

        if (!res || !res.ok) { renderEmpty((res && res.error) || 'تعذّر التحميل.'); return; }

        const data = res.data || {};
        state.rows = normalizeRows(data);
        state.updatedAt = data.updatedAt || data.timestamp || null;
        state.loadedOnce = true;
        renderTable();
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadIndex({ force: false });
    }

    function bindEvents() {
        window.addEventListener('gav:view:change', onViewChange, false);
    }

    let initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
        const cur = window.GavRouter && window.GavRouter.current ? window.GavRouter.current() : null;
        if (cur === VIEW_NAME) loadIndex({ force: true });
    }

    window.GavPricing = Object.freeze({
        init: init,
        reload: function () { return loadIndex({ force: true }); },
        getRows: function () { return state.rows.slice(); },
        getDisclaimer: function () { return DISCLAIMER_AR; }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();