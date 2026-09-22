/* ============================================================
   GAV – Module: Payments Log
   Path:   public/js/modules/payments.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'payments';
    const CONTAINER_ID = 'payments-list';

    if (window.__GAV_PAYMENTS_LOG_LOADED__ === true) return;
    window.__GAV_PAYMENTS_LOG_LOADED__ = true;

    const state = { payments: [], loading: false, loadedOnce: false };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/payments] ' + msg, data);
        else fn.call(console, '[GAV/payments] ' + msg);
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
            return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
        } catch (_) { return '—'; }
    }

    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderEmpty(msg) {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد معاملات.') + '</p></div>';
    }

    function renderPayments() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (!state.payments.length) { renderEmpty(); return; }

        wrap.innerHTML = state.payments.map(function (p) {
            const paymentId = escapeHtml(p.paymentId || '');
            const txid = escapeHtml(p.txid || '—');
            const status = p.status || 'created';
            const amount = formatPi(p.amount);
            const date = formatDate(p.createdAt);

            let badgeClass = 'badge-info';
            let statusText = 'منشأة';
            if (status === 'approved') { badgeClass = 'badge-warning'; statusText = 'معتمدة'; }
            else if (status === 'completed') { badgeClass = 'badge-success'; statusText = 'مكتملة'; }
            else if (status === 'cancelled') { badgeClass = 'badge-danger'; statusText = 'ملغاة'; }

            return '<div class="list-item" data-payment-id="' + paymentId + '">' +
                '<div class="list-item-icon">💳</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">عملية #' + paymentId.slice(-8) + ' <span class="badge ' + badgeClass + '">' + statusText + '</span></div>' +
                    '<div class="list-item-subtitle">📅 ' + date + ' · 🔗 ' + txid.slice(0, 12) + '...</div>' +
                '</div>' +
                '<div class="list-item-meta">' +
                    '<div class="list-item-amount">' + amount + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async function loadPayments(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints) { renderEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderLoading();

        let res;
        try {
            res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.listPayments();
            });
        } catch (err) {
            state.loading = false;
            renderEmpty('تعذّر الاتصال.');
            return;
        }

        state.loading = false;

        if (!res || !res.ok) {
            renderEmpty((res && res.error) || 'تعذّر تحميل المعاملات.');
            return;
        }

        state.payments = (res.data && Array.isArray(res.data.payments)) ? res.data.payments : [];
        state.loadedOnce = true;
        renderPayments();
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadPayments({ force: false });
    }

    function onAuthLogout() {
        state.payments = [];
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
        if (cur === VIEW_NAME) loadPayments({ force: true });
    }

    window.GavPayments = Object.freeze({
        init: init,
        reload: function () { return loadPayments({ force: true }); },
        getPayments: function () { return state.payments.slice(); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();