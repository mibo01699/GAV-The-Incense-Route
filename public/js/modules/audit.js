/* ============================================================
   GAV – Module: Audit Log
   Path:   public/js/modules/audit.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'audit';
    const CONTAINER_ID = 'audit-list';

    if (window.__GAV_AUDIT_LOADED__ === true) return;
    window.__GAV_AUDIT_LOADED__ = true;

    const state = { entries: [], loading: false, loadedOnce: false };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/audit] ' + msg, data);
        else fn.call(console, '[GAV/audit] ' + msg);
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
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد سجلات.') + '</p></div>';
    }

    function renderAudit() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (!state.entries.length) { renderEmpty(); return; }

        wrap.innerHTML = state.entries.map(function (entry) {
            const action = escapeHtml(entry.action || '');
            const target = escapeHtml(entry.target || '—');
            const date = formatDate(entry.at);

            let icon = '📝';
            if (action.indexOf('payment') !== -1) icon = '💳';
            else if (action.indexOf('product') !== -1) icon = '📦';
            else if (action.indexOf('auth') !== -1) icon = '🔐';
            else if (action.indexOf('barter') !== -1) icon = '🔄';

            return '<div class="list-item" data-audit-id="' + escapeHtml(entry.id || '') + '">' +
                '<div class="list-item-icon">' + icon + '</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">' + action + '</div>' +
                    '<div class="list-item-subtitle">🎯 ' + target + ' · 📅 ' + date + '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    async function loadAudit(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints) { renderEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderLoading();

        let res;
        try {
            res = await window.GavApi.withAuth(function () {
                return window.GavApi.endpoints.listAuditLog();
            });
        } catch (err) {
            state.loading = false;
            renderEmpty('تعذّر الاتصال.');
            return;
        }

        state.loading = false;

        if (!res || !res.ok) {
            renderEmpty((res && res.error) || 'تعذّر تحميل السجلات.');
            return;
        }

        state.entries = (res.data && Array.isArray(res.data.entries)) ? res.data.entries : [];
        state.loadedOnce = true;
        renderAudit();
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadAudit({ force: false });
    }

    function onAuthLogout() {
        state.entries = [];
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
        if (cur === VIEW_NAME) loadAudit({ force: true });
    }

    window.GavAudit = Object.freeze({
        init: init,
        reload: function () { return loadAudit({ force: true }); },
        getEntries: function () { return state.entries.slice(); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();