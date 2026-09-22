/* ============================================================
   GAV – Module: Orders
   Path:   public/js/modules/orders.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'orders';
    const CONTAINER_ID = 'orders-list';

    if (window.__GAV_ORDERS_LOADED__ === true) return;
    window.__GAV_ORDERS_LOADED__ = true;

    const state = { orders: [], loading: false, loadedOnce: false };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/orders] ' + msg, data);
        else fn.call(console, '[GAV/orders] ' + msg);
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
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد طلبات.') + '</p></div>';
    }

    function renderOrders() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (!state.orders.length) { renderEmpty(); return; }

        wrap.innerHTML = state.orders.map(function (o) {
            const id = escapeHtml(o.id || '');
            const status = o.status || 'pending';
            const total = formatPi(o.totalPi);
            const date = formatDate(o.createdAt);
            const itemCount = Array.isArray(o.items) ? o.items.length : 0;

            let badgeClass = 'badge-info';
            let statusText = 'قيد الانتظار';
            if (status === 'completed') { badgeClass = 'badge-success'; statusText = 'مكتمل'; }
            else if (status === 'paid') { badgeClass = 'badge-warning'; statusText = 'مدفوع'; }
            else if (status === 'cancelled') { badgeClass = 'badge-danger'; statusText = 'ملغي'; }

            return '<div class="list-item" data-order-id="' + id + '">' +
                '<div class="list-item-icon">📋</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">طلب #' + id.slice(-8) + ' <span class="badge ' + badgeClass + '">' + statusText + '</span></div>' +
                    '<div class="list-item-subtitle">📦 ' + itemCount + ' منتج · 📅 ' + date + '</div>' +
                '</div>' +
                '<div class="list-item-meta">' +
                    '<div class="list-item-amount">' + total + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async function loadOrders(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints) { renderEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderLoading();

        let res;
        try {
            res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.listOrders();
            });
        } catch (err) {
            state.loading = false;
            renderEmpty('تعذّر الاتصال.');
            return;
        }

        state.loading = false;

        if (!res || !res.ok) {
            renderEmpty((res && res.error) || 'تعذّر تحميل الطلبات.');
            return;
        }

        state.orders = (res.data && Array.isArray(res.data.orders)) ? res.data.orders : [];
        state.loadedOnce = true;
        renderOrders();
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadOrders({ force: false });
    }

    function onAuthLogout() {
        state.orders = [];
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
        if (cur === VIEW_NAME) loadOrders({ force: true });
    }

    window.GavOrders = Object.freeze({
        init: init,
        reload: function () { return loadOrders({ force: true }); },
        getOrders: function () { return state.orders.slice(); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();