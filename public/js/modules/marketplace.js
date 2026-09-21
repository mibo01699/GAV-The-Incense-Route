/* ============================================================
   GAV – The Incense Route
   Module: Marketplace View
   Path:   public/js/modules/marketplace.js

   PURPOSE:
     - Fetch product list via GavApi.endpoints.listProducts().
     - Render into #products-grid with loading / empty / error states.
     - Wire #marketplace-search + #search-btn for server-side search.
     - "Add to cart" → GavState.addToCart().
     - React to gav:view:change to (re)load when marketplace becomes active.
     - React to gav:auth:success / logout for badge display.

   CONSTRAINTS:
     - No direct fetch() — always through GavApi.
     - No DOM creation outside this view's container.
     - Never trust client-side identity.
     - Never computes or displays "GCV" or any global price.
     - All amounts shown in Pi (π) only.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VIEW_NAME      = 'marketplace';
    const GRID_ID        = 'products-grid';
    const SEARCH_INPUT   = 'marketplace-search';
    const SEARCH_BTN     = 'search-btn';
    const DEBOUNCE_MS    = 400;

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_MARKETPLACE_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/marketplace] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_MARKETPLACE_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        query: '',
        loading: false,
        loadedOnce: false,
        lastError: null,
        lastFetchAt: 0
    };

    let searchDebounceTimer = null;

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/marketplace] ' + msg, data);
        else                     fn.call(console, '[GAV/marketplace] ' + msg);
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
        if (!isFinite(n) || n < 0) return '0.00 π';
        return n.toFixed(2) + ' π';
    }

    /* --------------------------------------------
       Renderers
       -------------------------------------------- */
    function renderLoading() {
        const grid = $(GRID_ID);
        if (!grid) return;
        grid.innerHTML =
            '<div class="empty-state">' +
                '<p>جاري تحميل المنتجات...</p>' +
            '</div>';
    }

    function renderEmpty(customMsg) {
        const grid = $(GRID_ID);
        if (!grid) return;
        const msg = customMsg || 'لا توجد منتجات متاحة حالياً.';
        grid.innerHTML =
            '<div class="empty-state">' +
                '<p>' + escapeHtml(msg) + '</p>' +
            '</div>';
    }

    function renderError(msg) {
        const grid = $(GRID_ID);
        if (!grid) return;
        grid.innerHTML =
            '<div class="empty-state">' +
                '<p>' + escapeHtml(msg || 'تعذّر تحميل المنتجات.') + '</p>' +
            '</div>';
    }

    function renderProducts(products) {
        const grid = $(GRID_ID);
        if (!grid) return;

        if (!Array.isArray(products) || products.length === 0) {
            renderEmpty('لا توجد منتجات مطابقة.');
            return;
        }

        const html = products.map(function (p) {
            const id       = escapeHtml(p.id || '');
            const name     = escapeHtml(p.name || 'منتج');
            const price    = formatPi(p.price);
            const merchant = escapeHtml(p.merchantName || p.merchant || '');
            const image    = p.image
                ? '<img src="' + escapeHtml(p.image) + '" alt="' + name + '" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.textContent=\'📦\';" />'
                : '📦';

            return '' +
                '<div class="product-card" data-product-id="' + id + '" role="button" tabindex="0">' +
                    '<div class="product-image">' + image + '</div>' +
                    '<div class="product-info">' +
                        '<div class="product-name">' + name + '</div>' +
                        (merchant ? '<div class="product-merchant">' + merchant + '</div>' : '') +
                        '<div class="product-price">' + price + ' <small>Pi</small></div>' +
                    '</div>' +
                '</div>';
        }).join('');

        grid.innerHTML = html;
    }

    /* --------------------------------------------
       Data fetch
       -------------------------------------------- */
    async function loadProducts(options) {
        options = options || {};

        if (state.loading) return;
        if (options.force !== true && state.loadedOnce && !state.query) {
            // Skip redundant reloads unless forced
            return;
        }

        if (!window.GavApi || !window.GavApi.endpoints) {
            safeLog('error', 'GavApi not available.');
            renderError('خدمة المنتجات غير جاهزة.');
            return;
        }

        state.loading = true;
        renderLoading();

        const res = await window.GavApi.endpoints.listProducts(state.query);

        state.loading = false;
        state.lastFetchAt = Date.now();

        if (!res.ok) {
            state.lastError = res.error || 'تعذّر تحميل المنتجات.';
            renderError(state.lastError);
            safeLog('warn', 'loadProducts failed:', res);
            return;
        }

        state.loadedOnce = true;
        state.lastError = null;

        const products = (res.data && Array.isArray(res.data.products))
            ? res.data.products
            : (Array.isArray(res.data) ? res.data : []);

        renderProducts(products);
        safeLog('info', 'Loaded ' + products.length + ' product(s).');
    }

    /* --------------------------------------------
       Add to cart
       -------------------------------------------- */
    function handleAddToCart(productId) {
        if (!productId) return;
        if (!window.GavState) {
            safeLog('error', 'GavState unavailable.');
            return;
        }

        // We only have the id in the card; query state.products for full data.
        const all = (window.GavState.select('products') || []);
        const product = all.find(function (p) { return p && p.id === productId; });

        if (!product) {
            // Fallback: minimal object (server re-validates price later)
            window.GavState.addToCart({ id: productId, name: 'منتج', price: 0 }, 1);
            if (typeof window.showToast === 'function') {
                window.showToast('info', 'أُضيف إلى السلة.');
            }
            return;
        }

        window.GavState.addToCart(product, 1);

        if (typeof window.showToast === 'function') {
            window.showToast('success', 'أُضيف «' + product.name + '» إلى السلة.');
        }
    }

    /* --------------------------------------------
       Event handlers
       -------------------------------------------- */
    function onGridClick(e) {
        const card = e.target.closest ? e.target.closest('[data-product-id]') : null;
        if (!card) return;
        const id = card.getAttribute('data-product-id');
        handleAddToCart(id);
    }

    function onGridKeydown(e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const card = e.target.closest ? e.target.closest('[data-product-id]') : null;
        if (!card) return;
        e.preventDefault();
        handleAddToCart(card.getAttribute('data-product-id'));
    }

    function onSearchInput() {
        const input = $(SEARCH_INPUT);
        if (!input) return;

        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(function () {
            state.query = (input.value || '').trim();
            state.loadedOnce = false; // force refresh with new query
            loadProducts({ force: true });
        }, DEBOUNCE_MS);
    }

    function onSearchSubmit(e) {
        if (e && typeof e.preventDefault === 'function') e.preventDefault();
        const input = $(SEARCH_INPUT);
        state.query = input ? (input.value || '').trim() : '';
        state.loadedOnce = false;
        loadProducts({ force: true });
    }

    function onViewChange(e) {
        const to = e && e.detail ? e.detail.to : null;
        if (to === VIEW_NAME) {
            loadProducts({ force: false });
        }
    }

    function onAuthSuccess() {
        // Force refresh products after login (server may personalize list).
        state.loadedOnce = false;
        const currentView = window.GavRouter && window.GavRouter.current
            ? window.GavRouter.current()
            : null;
        if (currentView === VIEW_NAME) {
            loadProducts({ force: true });
        }
    }

    /* --------------------------------------------
       Wiring
       -------------------------------------------- */
    function bindEvents() {
        const grid = $(GRID_ID);
        if (grid) {
            grid.addEventListener('click', onGridClick, false);
            grid.addEventListener('keydown', onGridKeydown, false);
        }

        const input = $(SEARCH_INPUT);
        if (input) {
            input.addEventListener('input', onSearchInput, false);
        }

        const btn = $(SEARCH_BTN);
        if (btn) {
            btn.addEventListener('click', onSearchSubmit, false);
        }

        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:success', onAuthSuccess, false);
    }

    /* --------------------------------------------
       Init
       -------------------------------------------- */
    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        bindEvents();

        // Initial load only if the marketplace is the current view
        const currentView = window.GavRouter && window.GavRouter.current
            ? window.GavRouter.current()
            : 'marketplace';

        if (currentView === VIEW_NAME) {
            loadProducts({ force: true });
        }

        safeLog('info', 'Marketplace module initialized.');
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavMarketplace = Object.freeze({
        init:     init,
        reload:   function () { return loadProducts({ force: true }); },
        setQuery: function (q) {
            state.query = String(q || '').trim();
            const input = $(SEARCH_INPUT);
            if (input) input.value = state.query;
            state.loadedOnce = false;
            return loadProducts({ force: true });
        },
        getQuery: function () { return state.query; }
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