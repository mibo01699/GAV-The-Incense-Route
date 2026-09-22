/* ============================================================
   GAV – Module: Product Registry
   Path:   public/js/modules/registry.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'registry';
    const CONTAINER_ID = 'registry-list';

    if (window.__GAV_REGISTRY_LOADED__ === true) return;
    window.__GAV_REGISTRY_LOADED__ = true;

    const state = { products: [], loading: false, loadedOnce: false };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/registry] ' + msg, data);
        else fn.call(console, '[GAV/registry] ' + msg);
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

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
        } catch (_) { return '—'; }
    }

    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderEmpty(msg) {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد منتجات مسجلة.') + '</p></div>';
    }

    function renderList() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (!state.products.length) { renderEmpty(); return; }

        wrap.innerHTML = state.products.map(function (p) {
            const id = escapeHtml(p.id || '');
            const name = escapeHtml(p.name || 'منتج');
            const merchant = escapeHtml(p.merchantName || '—');
            const price = formatPi(p.price);
            const date = formatDate(p.createdAt);
            const active = p.active !== false ? '<span class="badge badge-success">نشط</span>' : '<span class="badge badge-warning">موقوف</span>';

            return '<div class="list-item" data-registry-id="' + id + '">' +
                '<div class="list-item-icon">📦</div>' +
                '<div class="list-item-body">' +
                '<div class="list-item-title">' + name + ' ' + active + '</div>' +
                '<div class="list-item-subtitle">🏬 ' + merchant + '</div>' +
                '<div class="list-item-subtitle">📅 ' + date + '</div>' +
                '</div>' +
                '<div class="list-item-meta"><div class="list-item-amount">' + price + '</div></div>' +
                '</div>';
        }).join('');
    }

    async function loadRegistry(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints) { renderEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderLoading();

        let res;
        try { res = await window.GavApi.endpoints.listProducts(); }
        catch (err) { state.loading = false; renderEmpty('تعذّر الاتصال.'); return; }

        state.loading = false;

        if (!res || !res.ok) { renderEmpty((res && res.error) || 'تعذّر التحميل.'); return; }

        state.products = (res.data && Array.isArray(res.data.products)) ? res.data.products : [];
        state.loadedOnce = true;
        renderList();
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadRegistry({ force: false });
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
        if (cur === VIEW_NAME) loadRegistry({ force: true });
    }

    window.GavRegistry = Object.freeze({
        init: init,
        reload: function () { return loadRegistry({ force: true }); },
        getProducts: function () { return state.products.slice(); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();