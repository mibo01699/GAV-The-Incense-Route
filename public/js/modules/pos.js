/* ============================================================
   GAV – The Incense Route
   Module: Point of Sale (POS)
   Path:   public/js/modules/pos.js

   PURPOSE:
     - Render merchant products as quick-select buttons.
     - Local POS cart with +/- and remove controls.
     - Compute total in Pi only.
     - Hand off to GavPayment.startCheckout() for Pi payment.
     - Never calls Pi.createPayment() directly.

   CONSTRAINTS:
     - No direct fetch() — through GavApi.
     - Pi-only amounts. No GCV, no YER, no fiat.
     - Server-side approval/completion only (via payment.js).
     - Never trust client-side identity.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VIEW_NAME            = 'pos';
    const PRODUCTS_GRID_ID     = 'pos-products-grid';
    const CART_ITEMS_ID        = 'pos-cart-items';
    const TOTAL_ID             = 'pos-total';
    const CHECKOUT_BTN_ID      = 'pos-checkout-btn';

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_POS_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/pos] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_POS_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        products:    [],
        cart:        [],          // [{ id, name, price, qty }]
        loading:     false,
        loadedOnce:  false,
        submitting:  false
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/pos] ' + msg, data);
        else                     fn.call(console, '[GAV/pos] ' + msg);
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
        if (!isFinite(n) || n < 0) return '0.00';
        return n.toFixed(2);
    }

    function cartTotal() {
        return state.cart.reduce(function (sum, it) {
            return sum + (Number(it.price) * Number(it.qty));
        }, 0);
    }

    function cartCount() {
        return state.cart.reduce(function (sum, it) {
            return sum + Number(it.qty);
        }, 0);
    }

    /* --------------------------------------------
       Renderers — products
       -------------------------------------------- */
    function renderProductsLoading() {
        const grid = $(PRODUCTS_GRID_ID);
        if (!grid) return;
        grid.innerHTML = '<div class="empty-state"><p>جاري تحميل المنتجات...</p></div>';
    }

    function renderProductsEmpty() {
        const grid = $(PRODUCTS_GRID_ID);
        if (!grid) return;
        grid.innerHTML = '<div class="empty-state"><p>لا توجد منتجات.</p></div>';
    }

    function renderProductsError(msg) {
        const grid = $(PRODUCTS_GRID_ID);
        if (!grid) return;
        grid.innerHTML = '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>';
    }

    function renderProducts() {
        const grid = $(PRODUCTS_GRID_ID);
        if (!grid) return;

        if (!state.products.length) {
            renderProductsEmpty();
            return;
        }

        grid.innerHTML = state.products.map(function (p) {
            const id    = escapeHtml(p.id || '');
            const name  = escapeHtml(p.name || 'منتج');
            const price = formatPi(p.price);
            return '' +
                '<button class="pos-product-btn" type="button" data-pos-add="' + id + '">' +
                    '<span class="pos-product-name">' + name + '</span>' +
                    '<span class="pos-product-price">' + price + ' π</span>' +
                '</button>';
        }).join('');
    }

    /* --------------------------------------------
       Renderers — cart
       -------------------------------------------- */
    function renderCart() {
        const wrap = $(CART_ITEMS_ID);
        const total = $(TOTAL_ID);

        if (total) {
            total.textContent = formatPi(cartTotal()) + ' Pi';
        }

        if (!wrap) return;

        if (!state.cart.length) {
            wrap.innerHTML = '<div class="empty-state"><p>السلة فارغة.</p></div>';
            updateCheckoutButton();
            return;
        }

        wrap.innerHTML = state.cart.map(function (it) {
            const id    = escapeHtml(it.id || '');
            const name  = escapeHtml(it.name || 'منتج');
            const price = formatPi(it.price);
            const qty   = Number(it.qty) || 0;

            return '' +
                '<div class="cart-item" data-cart-id="' + id + '">' +
                    '<div class="cart-item-info">' +
                        '<div class="cart-item-name">' + name + '</div>' +
                        '<div class="cart-item-price">' + price + ' π</div>' +
                    '</div>' +
                    '<div class="cart-item-controls">' +
                        '<button class="qty-btn" type="button" data-cart-dec="' + id + '" aria-label="تقليل">−</button>' +
                        '<span class="qty-value">' + qty + '</span>' +
                        '<button class="qty-btn" type="button" data-cart-inc="' + id + '" aria-label="زيادة">+</button>' +
                    '</div>' +
                '</div>';
        }).join('');

        updateCheckoutButton();
    }

    function updateCheckoutButton() {
        const btn = $(CHECKOUT_BTN_ID);
        if (!btn) return;
        const empty = state.cart.length === 0;
        if (empty || state.submitting) {
            btn.setAttribute('disabled', 'disabled');
        } else {
            btn.removeAttribute('disabled');
        }
        if (state.submitting) {
            btn.textContent = '⏳ جاري المعالجة...';
        } else {
            btn.textContent = '💳 الدفع عبر Pi';
        }
    }

    /* --------------------------------------------
       Load products
       -------------------------------------------- */
    async function loadProducts(options) {
        options = options || {};
        if (state.loading) return;
        if (!options.force && state.loadedOnce) return;

        if (!window.GavApi || !window.GavApi.withAuth) {
            renderProductsError('خدمة المنتجات غير جاهزة.');
            return;
        }

        state.loading = true;
        renderProductsLoading();

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.listMyProducts();
        });

        state.loading = false;

        if (!res || !res.ok) {
            renderProductsError((res && res.error) || 'تعذّر تحميل المنتجات.');
            safeLog('warn', 'loadProducts failed:', res);
            return;
        }

        const data = res.data || {};
        state.products = Array.isArray(data.products) ? data.products : [];
        state.loadedOnce = true;

        renderProducts();
        safeLog('info', 'POS products loaded: ' + state.products.length);
    }

    /* --------------------------------------------
       Cart operations
       -------------------------------------------- */
    function addToCart(productId) {
        if (!productId) return;
        const p = state.products.find(function (x) { return x.id === productId; });
        if (!p) {
            safeLog('warn', 'Product not found: ' + productId);
            return;
        }
        if (typeof p.price !== 'number' || p.price < 0) {
            safeLog('warn', 'Invalid price for product: ' + productId);
            return;
        }

        const idx = state.cart.findIndex(function (x) { return x.id === productId; });
        if (idx !== -1) {
            state.cart[idx] = Object.assign({}, state.cart[idx], {
                qty: state.cart[idx].qty + 1
            });
        } else {
            state.cart.push({
                id:    p.id,
                name:  p.name || 'منتج',
                price: p.price,
                qty:   1
            });
        }

        renderCart();
    }

    function increment(productId) {
        const idx = state.cart.findIndex(function (x) { return x.id === productId; });
        if (idx === -1) return;
        state.cart[idx] = Object.assign({}, state.cart[idx], {
            qty: state.cart[idx].qty + 1
        });
        renderCart();
    }

    function decrement(productId) {
        const idx = state.cart.findIndex(function (x) { return x.id === productId; });
        if (idx === -1) return;
        const newQty = state.cart[idx].qty - 1;
        if (newQty <= 0) {
            state.cart.splice(idx, 1);
        } else {
            state.cart[idx] = Object.assign({}, state.cart[idx], { qty: newQty });
        }
        renderCart();
    }

    function clearCart() {
        state.cart = [];
        renderCart();
    }

    /* --------------------------------------------
       Checkout — delegates to GavPayment
       -------------------------------------------- */
    async function onCheckout() {
        if (state.submitting) return;
        if (!state.cart.length) return;

        if (!window.GavPayment || typeof window.GavPayment.startCheckout !== 'function') {
            if (typeof window.showToast === 'function') {
                window.showToast('error', 'وحدة الدفع غير جاهزة. حدّث الصفحة.');
            }
            safeLog('error', 'GavPayment module not available.');
            return;
        }

        state.submitting = true;
        updateCheckoutButton();

        // Snapshot cart (immutable during payment)
        const snapshot = state.cart.map(function (it) {
            return { id: it.id, name: it.name, price: it.price, qty: it.qty };
        });
        const totalPi = cartTotal();

        let result = null;
        try {
            result = await window.GavPayment.startCheckout({
                source: 'pos',
                cart:   snapshot,
                total:  totalPi,
                currency: 'PI'
            });
        } catch (err) {
            safeLog('error', 'startCheckout threw:', err);
            result = { ok: false, error: 'فشل بدء عملية الدفع.' };
        }

        state.submitting = false;
        updateCheckoutButton();

        if (!result || !result.ok) {
            if (result && result.cancelled) {
                if (typeof window.showToast === 'function') {
                    window.showToast('info', 'تم إلغاء عملية الدفع.');
                }
                return;
            }
            if (typeof window.showToast === 'function') {
                window.showToast('error', (result && result.error) || 'فشل الدفع.');
            }
            return;
        }

        // Success — clear POS cart
        clearCart();

        if (typeof window.showToast === 'function') {
            window.showToast(
                'success',
                'تم الدفع بنجاح. رقم العملية: ' + (result.paymentId || '—')
            );
        }
    }

    /* --------------------------------------------
       Event handlers
       -------------------------------------------- */
    function onProductsGridClick(e) {
        const btn = e.target.closest ? e.target.closest('[data-pos-add]') : null;
        if (!btn) return;
        const id = btn.getAttribute('data-pos-add');
        addToCart(id);
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
        const to = e && e.detail ? e.detail.to : null;
        if (to === VIEW_NAME) {
            loadProducts({ force: false });
        }
    }

    function onAuthLogout() {
        state.products = [];
        state.cart = [];
        state.loadedOnce = false;
        renderProductsEmpty();
        renderCart();
    }

    /* --------------------------------------------
       Wiring
       -------------------------------------------- */
    function bindEvents() {
        const grid = $(PRODUCTS_GRID_ID);
        if (grid) grid.addEventListener('click', onProductsGridClick, false);

        const cartWrap = $(CART_ITEMS_ID);
        if (cartWrap) cartWrap.addEventListener('click', onCartClick, false);

        const checkoutBtn = $(CHECKOUT_BTN_ID);
        if (checkoutBtn) checkoutBtn.addEventListener('click', onCheckout, false);

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
            loadProducts({ force: true });
        }

        // Render empty cart initially
        renderCart();

        safeLog('info', 'POS module initialized.');
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavPos = Object.freeze({
        init:      init,
        reload:    function () { return loadProducts({ force: true }); },
        addToCart: addToCart,
        clearCart: clearCart,
        getCart:   function () {
            return state.cart.map(function (it) { return Object.assign({}, it); });
        },
        getTotal:  function () { return cartTotal(); }
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