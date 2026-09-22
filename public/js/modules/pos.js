/* ============================================================
   GAV – Module: Point of Sale (POS)
   Path:   public/js/modules/pos.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'pos';
    const PRODUCTS_GRID_ID = 'pos-products-grid';
    const CART_ITEMS_ID = 'pos-cart-items';
    const TOTAL_ID = 'pos-total';
    const CHECKOUT_BTN_ID = 'pos-checkout-btn';

    if (window.__GAV_POS_LOADED__ === true) return;
    window.__GAV_POS_LOADED__ = true;

    const state = {
        products: [],
        cart: [],
        loading: false,
        loadedOnce: false,
        submitting: false
    };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/pos] ' + msg, data);
        else fn.call(console, '[GAV/pos] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function formatPi(amount) {
        const n = Number(amount);
        if (!isFinite(n) || n < 0) return '0.00';
        return n.toFixed(2);
    }

    function cartTotal() {
        return state.cart.reduce(function (sum, it) { return sum + (Number(it.price) * Number(it.qty)); }, 0);
    }

    /* ---------- Renderers ---------- */
    function renderProductsLoading() {
        const grid = $(PRODUCTS_GRID_ID);
        if (grid) grid.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderProductsEmpty(msg) {
        const grid = $(PRODUCTS_GRID_ID);
        if (grid) grid.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg || 'لا توجد منتجات.') + '</p></div>';
    }

    function renderProducts() {
        const grid = $(PRODUCTS_GRID_ID);
        if (!grid) return;
        if (!state.products.length) { renderProductsEmpty(); return; }

        grid.innerHTML = state.products.map(function (p) {
            const id = escapeHtml(p.id || '');
            const name = escapeHtml(p.name || 'منتج');
            const price = formatPi(p.price);
            return '<button class="pos-product-btn" type="button" data-pos-add="' + id + '">' +
                '<span class="pos-product-name">' + name + '</span>' +
                '<span class="pos-product-price">' + price + ' π</span>' +
                '</button>';
        }).join('');
    }

    function renderCart() {
        const wrap = $(CART_ITEMS_ID);
        const total = $(TOTAL_ID);

        if (total) total.textContent = formatPi(cartTotal()) + ' Pi';

        if (!wrap) return;

        if (!state.cart.length) {
            wrap.innerHTML = '<div class="empty-state"><p>السلة فارغة.</p></div>';
            updateCheckoutButton();
            return;
        }

        wrap.innerHTML = state.cart.map(function (it) {
            const id = escapeHtml(it.id || '');
            const name = escapeHtml(it.name || 'منتج');
            const price = formatPi(it.price);
            const qty = Number(it.qty) || 0;

            return '<div class="cart-item" data-cart-id="' + id + '">' +
                '<div class="cart-item-info">' +
                '<div class="cart-item-name">' + name + '</div>' +
                '<div class="cart-item-price">' + price + ' π</div>' +
                '</div>' +
                '<div class="cart-item-controls">' +
                '<button class="qty-btn" type="button" data-cart-dec="' + id + '">−</button>' +
                '<span class="qty-value">' + qty + '</span>' +
                '<button class="qty-btn" type="button" data-cart-inc="' + id + '">+</button>' +
                '</div></div>';
        }).join('');

        updateCheckoutButton();
    }

    function updateCheckoutButton() {
        const btn = $(CHECKOUT_BTN_ID);
        if (!btn) return;
        const empty = state.cart.length === 0;
        if (empty || state.submitting) btn.setAttribute('disabled', 'disabled');
        else btn.removeAttribute('disabled');
        btn.textContent = state.submitting ? '⏳ جاري المعالجة...' : '💳 الدفع عبر Pi';
    }

    /* ---------- Load products ---------- */
    async function loadProducts(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        if (!window.GavApi || !window.GavApi.withAuth) { renderProductsEmpty('الخدمة غير جاهزة.'); return; }

        state.loading = true;
        renderProductsLoading();

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.listMyProducts();
        });

        state.loading = false;

        if (!res || !res.ok) {
            renderProductsEmpty((res && res.error) || 'تعذّر التحميل.');
            return;
        }

        const data = res.data || {};
        state.products = Array.isArray(data.products) ? data.products : [];
        state.loadedOnce = true;
        renderProducts();
    }

    /* ---------- Cart operations ---------- */
    function addToCart(productId) {
        if (!productId) return;
        const p = state.products.find(function (x) { return x.id === productId; });
        if (!p) return;
        if (typeof p.price !== 'number' || p.price < 0) return;

        const idx = state.cart.findIndex(function (x) { return x.id === productId; });
        if (idx !== -1) {
            state.cart[idx] = Object.assign({}, state.cart[idx], { qty: state.cart[idx].qty + 1 });
        } else {
            state.cart.push({ id: p.id, name: p.name || 'منتج', price: p.price, qty: 1 });
        }
        renderCart();
    }

    function increment(id) {
        const idx = state.cart.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return;
        state.cart[idx] = Object.assign({}, state.cart[idx], { qty: state.cart[idx].qty + 1 });
        renderCart();
    }

    function decrement(id) {
        const idx = state.cart.findIndex(function (x) { return x.id === id; });
        if (idx === -1) return;
        const newQty = state.cart[idx].qty - 1;
        if (newQty <= 0) state.cart.splice(idx, 1);
        else state.cart[idx] = Object.assign({}, state.cart[idx], { qty: newQty });
        renderCart();
    }

    function clearCart() { state.cart = []; renderCart(); }

    /* ---------- Checkout ---------- */
    async function onCheckout() {
        if (state.submitting || !state.cart.length) return;

        if (!window.GavPayment || typeof window.GavPayment.startCheckout !== 'function') {
            if (typeof window.showToast === 'function') window.showToast('error', 'وحدة الدفع غير جاهزة.');
            return;
        }

        state.submitting = true;
        updateCheckoutButton();

        const snapshot = state.cart.map(function (it) {
            return { id: it.id, name: it.name, price: it.price, qty: it.qty };
        });

        // Map to API contract: { items: [{ productId, quantity }] }
        const items = snapshot.map(function (it) {
            return { productId: it.id, quantity: it.qty };
        });

        let result = null;
        try {
            result = await window.GavPayment.startCheckout({
                source: 'pos',
                items: items,
                total: cartTotal(),
                currency: 'PI'
            });
        } catch (err) {
            safeLog('error', 'startCheckout threw:', err);
            result = { ok: false, error: 'فشل بدء الدفع.' };
        }

        state.submitting = false;
        updateCheckoutButton();

        if (!result || !result.ok) {
            if (result && result.cancelled) {
                if (typeof window.showToast === 'function') window.showToast('info', 'تم إلغاء الدفع.');
                return;
            }
            if (typeof window.showToast === 'function') window.showToast('error', (result && result.error) || 'فشل الدفع.');
            return;
        }

        clearCart();
        if (typeof window.showToast === 'function') {
            window.showToast('success', 'تم الدفع بنجاح. رقم العملية: ' + (result.paymentId || '—'));
        }
    }

    /* ---------- Event handlers ---------- */
    function onProductsGridClick(e) {
        const btn = e.target.closest ? e.target.closest('[data-pos-add]') : null;
        if (!btn) return;
        addToCart(btn.getAttribute('data-pos-add'));
    }

    function onCartClick(e) {
        const target = e.target.closest ? e.target.closest('[data-cart-inc], [data-cart-dec]') : null;
        if (!target) return;
        const incId = target.getAttribute('data-cart-inc');
        const decId = target.getAttribute('data-cart-dec');
        if (incId) increment(incId);
        if (decId) decrement(decId);
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadProducts({ force: false });
    }

    function onAuthLogout() {
        state.products = []; state.cart = []; state.loadedOnce = false;
        renderProductsEmpty(); renderCart();
    }

    function bindEvents() {
        const grid = $(PRODUCTS_GRID_ID);
        if (grid) grid.addEventListener('click', onProductsGridClick, false);
        const cartWrap = $(CART_ITEMS_ID);
        if (cartWrap) cartWrap.addEventListener('click', onCartClick, false);
        const checkoutBtn = $(CHECKOUT_BTN_ID);
        if (checkoutBtn) checkoutBtn.addEventListener('click', onCheckout, false);
        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:logout', onAuthLogout, false);
    }

    let initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
        const cur = window.GavRouter && window.GavRouter.current ? window.GavRouter.current() : null;
        if (cur === VIEW_NAME) loadProducts({ force: true });
        renderCart();
        safeLog('info', 'POS initialized.');
    }

    window.GavPos = Object.freeze({
        init: init,
        reload: function () { return loadProducts({ force: true }); },
        addToCart: addToCart,
        clearCart: clearCart,
        getCart: function () { return state.cart.map(function (it) { return Object.assign({}, it); }); },
        getTotal: function () { return cartTotal(); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();