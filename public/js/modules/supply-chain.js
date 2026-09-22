/* ============================================================
   GAV – The Incense Route
   Module: Supply Chain Tracking
   Path:   public/js/modules/supply-chain.js

   PURPOSE:
     - Read-only view of supply-chain tracking records.
     - Show chain-of-custody timeline per product.
     - Filter by product / merchant / stage / date.
     - Server-authoritative — client never mutates records.

   CONSTRAINTS:
     - No direct fetch() — through GavApi.
     - No GCV, no YER, no fiat prices.
     - No client-side mutations (read-only module).
     - Server-verified identity for any authenticated view.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VIEW_NAME        = 'supply-chain';
    const CONTAINER_ID     = 'supply-chain-list';

    const STAGE_LABELS = Object.freeze({
        origin:       'المصدر',
        harvest:      'الحصاد',
        processing:   'المعالجة',
        packaging:    'التغليف',
        transit:      'النقل',
        warehouse:    'المستودع',
        distribution: 'التوزيع',
        retail:       'البيع بالتجزئة',
        delivery:     'التسليم',
        delivered:    'تم التسليم'
    });

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_SUPPLY_CHAIN_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/supply-chain] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_SUPPLY_CHAIN_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        records:     [],
        filtered:    [],
        loading:     false,
        loadedOnce:  false,
        query:       '',
        stageFilter: 'all'      // 'all' | stage key
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/supply-chain] ' + msg, data);
        else                     fn.call(console, '[GAV/supply-chain] ' + msg);
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
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            return yyyy + '/' + mm + '/' + dd + ' · ' + hh + ':' + mi;
        } catch (_) {
            return '—';
        }
    }

    function stageLabel(key) {
        if (!key) return '—';
        return STAGE_LABELS[key] || String(key);
    }

    function normalizeRecords(data) {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.records)) return data.records;
        if (Array.isArray(data.items))   return data.items;
        return [];
    }

    /* --------------------------------------------
       Filtering
       -------------------------------------------- */
    function applyFilters() {
        const q = state.query.toLowerCase();
        state.filtered = state.records.filter(function (rec) {
            if (state.stageFilter !== 'all' && rec.stage !== state.stageFilter) {
                return false;
            }
            if (!q) return true;

            const haystack = [
                rec.productName,
                rec.productId,
                rec.merchantName,
                rec.merchant,
                rec.location,
                rec.stage
            ].filter(Boolean).join(' ').toLowerCase();

            return haystack.indexOf(q) !== -1;
        });
    }

    /* --------------------------------------------
       Renderers
       -------------------------------------------- */
    function renderLoading() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state"><p>جاري تحميل سجلات التتبع...</p></div>';
    }

    function renderEmpty(customMsg) {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        const msg = customMsg || 'لا توجد سجلات تتبع.';
        wrap.innerHTML =
            '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>';
    }

    function renderError(msg) {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;
        wrap.innerHTML =
            '<div class="empty-state"><p>' + escapeHtml(msg || 'تعذّر تحميل السجلات.') + '</p></div>';
    }

    function renderRecordItem(rec) {
        const id         = escapeHtml(rec.id || '');
        const product    = escapeHtml(rec.productName || rec.productId || 'منتج');
        const merchant   = escapeHtml(rec.merchantName || rec.merchant || '—');
        const location   = escapeHtml(rec.location || '—');
        const stage      = escapeHtml(stageLabel(rec.stage));
        const timestamp  = formatDate(rec.timestamp || rec.createdAt);
        const batch      = rec.batchId ? escapeHtml(rec.batchId) : null;
        const notes      = rec.notes ? escapeHtml(rec.notes) : null;

        const verifiedBadge = rec.verified === true
            ? '<span class="badge badge-success">موثّق</span>'
            : '<span class="badge badge-warning">معلّق</span>';

        return '' +
            '<div class="list-item" data-record-id="' + id + '">' +
                '<div class="list-item-icon">🔗</div>' +
                '<div class="list-item-body">' +
                    '<div class="list-item-title">' + product + ' ' + verifiedBadge + '</div>' +
                    '<div class="list-item-subtitle">' +
                        '🏷 ' + stage + ' · 📍 ' + location +
                    '</div>' +
                    '<div class="list-item-subtitle">' +
                        '🏬 ' + merchant +
                        (batch ? ' · 🧾 دفعة: ' + batch : '') +
                    '</div>' +
                    (notes ? '<div class="list-item-subtitle">📝 ' + notes + '</div>' : '') +
                '</div>' +
                '<div class="list-item-meta">' +
                    '<div class="list-item-date">' + timestamp + '</div>' +
                '</div>' +
            '</div>';
    }

    function renderList() {
        const wrap = $(CONTAINER_ID);
        if (!wrap) return;

        if (!state.filtered.length) {
            renderEmpty(
                state.records.length
                    ? 'لا توجد نتائج مطابقة للفلترة.'
                    : 'لا توجد سجلات تتبع.'
            );
            return;
        }

        // Newest first
        const sorted = state.filtered.slice().sort(function (a, b) {
            const ta = new Date(a.timestamp || a.createdAt || 0).getTime();
            const tb = new Date(b.timestamp || b.createdAt || 0).getTime();
            return tb - ta;
        });

        wrap.innerHTML = sorted.map(renderRecordItem).join('');
    }

    /* --------------------------------------------
       Data fetch
       -------------------------------------------- */
    async function loadRecords(options) {
        options = options || {};
        if (state.loading) return;
        if (!options.force && state.loadedOnce) return;

        if (!window.GavApi || !window.GavApi.endpoints) {
            renderError('خدمة سلسلة التوريد غير جاهزة.');
            return;
        }

        state.loading = true;
        renderLoading();

        const res = await window.GavApi.endpoints.listSupplyChain();

        state.loading = false;

        if (!res || !res.ok) {
            renderError((res && res.error) || 'تعذّر تحميل السجلات.');
            safeLog('warn', 'loadRecords failed:', res);
            return;
        }

        state.records = normalizeRecords(res.data);
        state.loadedOnce = true;

        applyFilters();
        renderList();
        safeLog('info', 'Loaded ' + state.records.length + ' supply-chain record(s).');
    }

    /* --------------------------------------------
       Filter UI (injected minimally, no design break)
       -------------------------------------------- */
    function ensureFilterBar() {
        const wrap = $(CONTAINER_ID);
        if (!wrap || !wrap.parentNode) return;

        // Skip if already exists
        if (document.getElementById('sc-filter-bar')) return;

        const bar = document.createElement('div');
        bar.id = 'sc-filter-bar';
        bar.className = 'search-bar';
        bar.style.marginBottom = '1rem';

        const stages = ['all'].concat(Object.keys(STAGE_LABELS));
        const optionsHtml = stages.map(function (s) {
            const label = s === 'all' ? 'كل المراحل' : stageLabel(s);
            return '<option value="' + escapeHtml(s) + '">' + escapeHtml(label) + '</option>';
        }).join('');

        bar.innerHTML = '' +
            '<input id="sc-search" class="input-field" type="text" placeholder="ابحث عن منتج أو تاجر أو موقع..." />' +
            '<select id="sc-stage" class="input-field" style="max-width:180px;">' + optionsHtml + '</select>';

        wrap.parentNode.insertBefore(bar, wrap);

        const searchInput = document.getElementById('sc-search');
        const stageSelect = document.getElementById('sc-stage');

        if (searchInput) {
            let timer = null;
            searchInput.addEventListener('input', function () {
                if (timer) clearTimeout(timer);
                timer = setTimeout(function () {
                    state.query = (searchInput.value || '').trim();
                    applyFilters();
                    renderList();
                }, 300);
            }, false);
        }

        if (stageSelect) {
            stageSelect.addEventListener('change', function () {
                state.stageFilter = stageSelect.value || 'all';
                applyFilters();
                renderList();
            }, false);
        }
    }

    /* --------------------------------------------
       Event handlers
       -------------------------------------------- */
    function onViewChange(e) {
        const to = e && e.detail ? e.detail.to : null;
        if (to === VIEW_NAME) {
            ensureFilterBar();
            loadRecords({ force: false });
        }
    }

    function onAuthLogout() {
        state.records = [];
        state.filtered = [];
        state.loadedOnce = false;
        renderEmpty();
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
            ensureFilterBar();
            loadRecords({ force: true });
        }

        safeLog('info', 'Supply-chain module initialized.');
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavSupplyChain = Object.freeze({
        init:   init,
        reload: function () { return loadRecords({ force: true }); },
        setQuery: function (q) {
            state.query = String(q || '').trim();
            const el = document.getElementById('sc-search');
            if (el) el.value = state.query;
            applyFilters();
            renderList();
        },
        setStage: function (stage) {
            if (stage !== 'all' && !STAGE_LABELS[stage]) return;
            state.stageFilter = stage;
            const el = document.getElementById('sc-stage');
            if (el) el.value = stage;
            applyFilters();
            renderList();
        },
        getRecords: function () {
            return state.filtered.slice();
        }
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