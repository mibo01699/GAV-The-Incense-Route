/* ============================================================
   GAV – Module: Supply Chain
   Path:   public/js/modules/supply-chain.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'supply-chain';
    const CONTAINER_ID = 'supply-chain-list';

    const STAGE_LABELS = Object.freeze({
        origin: 'المصدر', harvest: 'الحصاد', processing: 'المعالجة',
        packaging: 'التغليف', transit: 'النقل', warehouse: 'المستودع',
        distribution: 'التوزيع', retail: 'البيع بالتجزئة',
        delivery: 'التسليم', delivered: 'تم التسليم'
    });

    if (window.__GAV_SUPPLY_CHAIN_LOADED__ === true) return;
    window.__GAV_SUPPLY_CHAIN_LOADED__ = true;

    const state = { records: [], filtered: [], loading: false, loadedOnce: false, query: '', stageFilter: 'all' };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/supply-chain] ' + msg, data);
        else fn.call(console, '[GAV/supply-chain] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatDate(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            if (isNaN(d.getTime())) return '—';
            return d.getFullYear() + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + String(d.getDate()).padStart(2,'0');
        } catch (_) { return '—'; }
    }

    function stageLabel(key) { return STAGE_LABELS[key] || key || '—'; }

    function normalizeRecords(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.records)) return data.records;
        return [];
    }

    function applyFilters() {
        const q = state.query.toLowerCase();
        state.filtered = state.records.filter(function (rec) {
            if (state.stageFilter !== 'all' && rec.stage !== state.stageFilter) return false;
            if (!q) return true;
            const h = [rec.productName, rec.productId, rec.merchantName, rec.location, rec.stage].filter(Boolean).join(' ').toLowerCase();
            return h.indexOf(q) !== -1;
        });
    }

    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderEmpty(msg) {
        const wrap = $(CONTAINER_ID);
        if (wrap) wrap.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد سجلات.') + '</p></div>';
    }

    function renderRecordItem(rec) {
        const id = escapeHtml(rec.id || '');
        const product = escapeHtml(rec.productName || 'منتج');
        const merchant = escapeHtml(rec.merchantName || '—');
        const location = escapeHtml(rec.location || '—');
        const stage = escapeHtml(stageLabel(rec.stage));
        const ts = formatDate(rec.timestamp || rec.createdAt);
        const verified = rec.verified === true ? '<span class="badge badge-success">موثّق</span>' : '<span class="badge badge-warning">معلّق</span>';

        return '<div class="list-item" data-record-id="' + id + '">' +
            '<div class="list-item-icon">🔗</div>' +
            '<div class="list-item-body">' +
            '<div class="list-item-title">' + product + ' ' + verified + '</div>' +
            '<div class="list-item-subtitle">🏷 ' + stage + ' · 📍 ' + location + '</div>' +
            '<div class="list-item-subtitle">🏬 ' + merchant + '</div>' +
            '</div>' +
            '<div class="list-item-meta"><div class="list-item-date">' + ts + '</div></div>' +
            '</div>';
    }

    function renderList() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        if (!state.filtered.length) { renderEmpty(state.records.length ? 'لا توجد نتائج مطابقة.' : 'لا توجد سجلات.'); return; }
        const sorted = state.filtered.slice().sort(function (a, b) {
            return new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0);
        });
        wrap.innerHTML = sorted.map(renderRecordItem).join('');
    }

    async function loadRecords(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.endpoints) { renderEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderLoading();

        let res;
        try { res = await window.GavApi.endpoints.listSupplyChain(); }
        catch (err) { state.loading = false; renderEmpty('تعذّر الاتصال.'); return; }

        state.loading = false;

        if (!res || !res.ok) { renderEmpty((res && res.error) || 'تعذّر التحميل.'); return; }

        state.records = normalizeRecords(res.data);
        state.loadedOnce = true;
        applyFilters(); renderList();
    }

    function ensureFilterBar() {
        const wrap = $(CONTAINER_ID);
        if (!wrap || !wrap.parentNode || document.getElementById('sc-filter-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'sc-filter-bar';
        bar.className = 'search-bar';
        bar.style.marginBottom = '1rem';

        const stages = ['all'].concat(Object.keys(STAGE_LABELS));
        const opts = stages.map(function (s) {
            const label = s === 'all' ? 'كل المراحل' : stageLabel(s);
            return '<option value="' + escapeHtml(s) + '">' + escapeHtml(label) + '</option>';
        }).join('');

        bar.innerHTML = '<input id="sc-search" class="input-field" type="text" placeholder="ابحث..." />' +
            '<select id="sc-stage" class="input-field" style="max-width:180px;">' + opts + '</select>';

        wrap.parentNode.insertBefore(bar, wrap);

        const si = document.getElementById('sc-search');
        const ss = document.getElementById('sc-stage');
        if (si) {
            let t = null;
            si.addEventListener('input', function () {
                if (t) clearTimeout(t);
                t = setTimeout(function () {
                    state.query = (si.value || '').trim();
                    applyFilters(); renderList();
                }, 300);
            }, false);
        }
        if (ss) ss.addEventListener('change', function () {
            state.stageFilter = ss.value || 'all';
            applyFilters(); renderList();
        }, false);
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) {
            ensureFilterBar();
            loadRecords({ force: false });
        }
    }

    function onAuthLogout() { state.records = []; state.filtered = []; state.loadedOnce = false; renderEmpty(); }

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
        if (cur === VIEW_NAME) { ensureFilterBar(); loadRecords({ force: true }); }
    }

    window.GavSupplyChain = Object.freeze({
        init: init,
        reload: function () { return loadRecords({ force: true }); },
        getRecords: function () { return state.filtered.slice(); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();