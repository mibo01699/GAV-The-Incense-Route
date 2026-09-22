/* ============================================================
   GAV – Module: Invoices
   Path:   public/js/modules/invoices.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'invoices';
    const CONTAINER_ID = 'invoices-list';

    if (window.__GAV_INVOICES_LOADED__ === true) return;
    window.__GAV_INVOICES_LOADED__ = true;

    const state = { invoices: [], loading: false, loadedOnce: false };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/invoices] ' + msg, data);
        else fn.call(console, '[GAV/invoices] ' + msg);
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
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد فواتير.') + '</p></div>';
    }

    function renderInvoices() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (!state.invoices.length) { renderEmpty(); return; }

        wrap.innerHTML = state.invoices.map(function (inv) {
            const id = escapeHtml(inv.id || '');
            const orderId = escapeHtml(inv.orderId || '—');
            const status = inv.status || 'unpaid';
            const total = formatPi(inv.totalPi);
            const date = formatDate(inv.createdAt);

            let badgeClass = 'badge-warning';
            let statusText = 'غير مدفوعة';
            if (status === 'paid') { badgeClass = 'badge-success'; statusText = 'مدفوعة'; }
            else if (status === 'cancelled') { badgeClass = 'badge-danger'; statusText = 'ملغاة'; }

            return '<div class="list-item" data-invoice-id="' + id + '">' +
                '<div class="list-item-icon">📄</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">فاتورة #' + id.slice(-8) + ' <span class="badge ' + badgeClass + '">' + statusText + '</span></div>' +
                    '<div class="list-item-subtitle">🆔 الطلب: ' + orderId.slice(-8) + ' · 📅 ' + date + '</div>' +
                '</div>' +
                '<div class="list-item-meta">' +
                    '<div class="list-item-amount">' + total + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async function loadInvoices(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints) { renderEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderLoading();

        let res;
        try {
            res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.listInvoices();
            });
        } catch (err) {
            state.loading = false;
            renderEmpty('تعذّر الاتصال.');
            return;
        }

        state.loading = false;

        if (!res || !res.ok) {
            renderEmpty((res && res.error) || 'تعذّر تحميل الفواتير.');
            return;
        }

        state.invoices = (res.data && Array.isArray(res.data.invoices)) ? res.data.invoices : [];
        state.loadedOnce = true;
        renderInvoices();
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadInvoices({ force: false });
    }

    function onAuthLogout() {
        state.invoices = [];
        state.loadedOnce = false;
        renderEmpty();
    }

    function bindEvents() {
        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:logout', onAuthLogout, false);
    }

    let initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
        const cur = window.GavRouter && window.GavRouter.current ? window.GavRouter.current() : null;
        if (cur === VIEW_NAME) loadInvoices({ force: true });
    }

    window.GavInvoices = Object.freeze({
        init: init,
        reload: function () { return loadInvoices({ force: true }); },
        getInvoices: function () { return state.invoices.slice(); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();