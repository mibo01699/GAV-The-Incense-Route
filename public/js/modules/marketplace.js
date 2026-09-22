/* ============================================================
   GAV – Module: Marketplace
   Path:   public/js/modules/marketplace.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'marketplace';
    const GRID_ID = 'products-grid';
    const SEARCH_INPUT = 'marketplace-search';
    const SEARCH_BTN = 'search-btn';
    const DEBOUNCE_MS = 400;

    if (window.__GAV_MARKETPLACE_LOADED__ === true) return;
    window.__GAV_MARKETPLACE_LOADED__ = true;

    const state = { query: '', loading: false, loadedOnce: false, products: [] };
    let searchTimer = null;

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/marketplace] ' + msg, data);
        else fn.call(console, '[GAV/marketplace] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatPi(amount) {
        const n = Number(amount);
        if (!isFinite(n) || n < 0) return '0.00 π';
        return n.toFixed(2) + ' π';
    }

    function renderLoading() {
        const grid = $(GRID_ID);
        if (grid) grid.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderEmpty(msg) {
        const grid = $(GRID_ID);
        if (grid) grid.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد منتجات.') + '</p></div>';
    }

    function renderError(msg) {
        const grid = $(GRID_ID);
        if (grid) grid.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>';
    }

    function renderProducts(products) {
        const grid = $(GRID_ID);
        if (!grid) return;
        if (!products || !products.length) { renderEmpty('لا توجد منتجات مطابقة.'); return; }

        grid.innerHTML = products.map(function (p) {
            const id = escapeHtml(p.id || '');
            const name = escapeHtml(p.name || 'منتج');
            const price = formatPi(p.price);
            const merchant = escapeHtml(p.merchantName || '');
            const img = p.image
                ? '<img src="' + escapeHtml(p.image) + '" alt="' + name + '" loading="lazy" />'
                : '📦';
            return '<div class="product-card" data-product-id="' + id + '" role="button" tabindex="0">' +
                '<div class="product-image">' + img + '</div>' +
                '<div class="product-info">' +
                '<div class="product-name">' + name + '</div>' +
                (merchant ? '<div class="product-merchant">' + merchant + '</div>' : '') +
                '<div class="product-price">' + price + '</div>' +
                '</div></div>';
        }).join('');
    }

    async function loadProducts(options) {
        options = options || {};
        if (state.loading) return;
        if (!options.force && state.loadedOnce) return;

        if (!window.GavApi || !window.GavApi.endpoints) {
            renderError('خدمة المنتجات غير جاهزة.'); return;
        }

        state.loading = true;
        renderLoading();

        const res = await window.GavApi.endpoints.listProducts(state.query);
        state.loading = false;

        if (!res.ok) {
            renderError(res.error || 'تعذّر تحميل المنتجات.');
            safeLog('warn', 'loadProducts failed:', res);
            return;
        }

        state.products = (res.data && Array.isArray(res.data.products)) ? res.data.products : [];
        state.loadedOnce = true;
        renderProducts(state.products);
        safeLog('info', 'Loaded ' + state.products.length + ' products.');
    }

    function onGridClick(e) {
        const card = e.target.closest ? e.target.closest('[data-product-id]') : null;
        if (!card) return;
        const id = card.getAttribute('data-product-id');
        if (id && window.GavState) {
            const p = state.products.find(function (x) { return x.id === id; });
            if (p) window.GavState.addToCart(p, 1);
            else window.GavState.addToCart({ id: id, name: 'منتج', price: 0 }, 1);
            if (typeof window.showToast === 'function') window.showToast('success', 'أُضيف إلى السلة.');
        }
    }

    function onSearchInput() {
        const input = $(SEARCH_INPUT);
        if (!input) return;
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
            state.query = (input.value || '').trim();
            state.loadedOnce = false;
            loadProducts({ force: true });
        }, DEBOUNCE_MS);
    }

    function onSearchSubmit(e) {
        if (e && e.preventDefault) e.preventDefault();
        const input = $(SEARCH_INPUT);
        state.query = input ? (input.value || '').trim() : '';
        state.loadedOnce = false;
        loadProducts({ force: true });
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadProducts({ force: false });
    }

    function bindEvents() {
        const grid = $(GRID_ID);
        if (grid) grid.addEventListener('click', onGridClick, false);
        const input = $(SEARCH_INPUT);
        if (input) input.addEventListener('input', onSearchInput, false);
        const btn = $(SEARCH_BTN);
        if (btn) btn.addEventListener('click', onSearchSubmit, false);
        window.addEventListener('gav:view:change', onViewChange, false);
    }

    let initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
        const cur = window.GavRouter && window.GavRouter.current ? window.GavRouter.current() : 'marketplace';
        if (cur === VIEW_NAME) loadProducts({ force: true });
        safeLog('info', 'Marketplace initialized.');
    }

    window.GavMarketplace = Object.freeze({
        init: init,
        reload: function () { return loadProducts({ force: true }); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();