/* ============================================================
   GAV – The Incense Route
   Module: Merchant Dashboard
   Path:   public/js/modules/merchant.js

   PURPOSE:
     - Show merchant KPIs (active products, pending orders, sales in Pi).
     - List merchant's own products.
     - Create / Update / Delete products via modal.
     - All mutations gated by GavApi.withAuth().

   CONSTRAINTS:
     - No direct fetch() — always through GavApi.
     - Prices are Pi-only. No GCV, no YER, no fiat conversion.
     - Never trust client-side uid; server re-validates every call.
     - UI updates only after server confirms success.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const VIEW_NAME           = 'merchant';
    const PRODUCTS_LIST_ID    = 'merchant-products-list';
    const PRODUCTS_COUNT_ID   = 'merchant-products-count';
    const ORDERS_COUNT_ID     = 'merchant-orders-count';
    const SALES_TOTAL_ID      = 'merchant-sales-total';
    const ADD_BTN_ID          = 'add-product-btn';
    const VIEW_ORDERS_BTN_ID  = 'view-orders-btn';

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_MERCHANT_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/merchant] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_MERCHANT_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        products: [],
        stats:    { activeProducts: 0, pendingOrders: 0, salesTotal: 0 },
        loading:  false,
        loadedOnce: false,
        modalOpen: false
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/merchant] ' + msg, data);
        else                     fn.call(console, '[GAV/merchant] ' + msg);
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

    /* --------------------------------------------
       Renderers
       -------------------------------------------- */
    function renderStats() {
        const p = $(PRODUCTS_COUNT_ID);
        const o = $(ORDERS_COUNT_ID);
        const s = $(SALES_TOTAL_ID);

        if (p) p.textContent = String(state.stats.activeProducts || 0);
        if (o) o.textContent = String(state.stats.pendingOrders || 0);
        if (s) s.textContent = formatPi(state.stats.salesTotal || 0);
    }

    function renderLoading() {
        const list = $(PRODUCTS_LIST_ID);
        if (!list) return;
        list.innerHTML =
            '<div class="empty-state"><p>جاري تحميل منتجاتك...</p></div>';
    }

    function renderEmpty() {
        const list = $(PRODUCTS_LIST_ID);
        if (!list) return;
        list.innerHTML =
            '<div class="empty-state"><p>لم تقم بإضافة أي منتجات بعد.</p></div>';
    }

    function renderError(msg) {
        const list = $(PRODUCTS_LIST_ID);
        if (!list) return;
        list.innerHTML =
            '<div class="empty-state"><p>' + escapeHtml(msg) + '</p></div>';
    }

    function renderProducts() {
        const list = $(PRODUCTS_LIST_ID);
        if (!list) return;

        if (!state.products.length) {
            renderEmpty();
            return;
        }

        list.innerHTML = state.products.map(function (p) {
            const id      = escapeHtml(p.id || '');
            const name    = escapeHtml(p.name || 'منتج');
            const price   = formatPi(p.price);
            const stock   = (typeof p.stock === 'number') ? p.stock : '—';
            const active  = p.active !== false;

            const badge = active
                ? '<span class="badge badge-success">نشط</span>'
                : '<span class="badge badge-warning">موقوف</span>';

            return '' +
                '<div class="list-item" data-product-id="' + id + '">' +
                    '<div class="list-item-icon">📦</div>' +
                    '<div class="list-item-body">' +
                        '<div class="list-item-title">' + name + '</div>' +
                        '<div class="list-item-subtitle">المخزون: ' + escapeHtml(stock) + ' · ' + badge + '</div>' +
                    '</div>' +
                    '<div class="list-item-meta">' +
                        '<div class="list-item-amount">' + price + ' π</div>' +
                        '<div style="display:flex;gap:0.25rem;margin-top:0.25rem;">' +
                            '<button class="qty-btn" data-action="edit" data-product-id="' + id + '" title="تعديل">✎</button>' +
                            '<button class="qty-btn" data-action="delete" data-product-id="' + id + '" title="حذف">🗑</button>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }).join('');
    }

    /* --------------------------------------------
       Data fetch
       -------------------------------------------- */
    async function loadDashboard(options) {
        options = options || {};
        if (state.loading) return;

        if (!options.force && state.loadedOnce) return;

        state.loading = true;
        renderLoading();

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.listMyProducts();
        });

        if (!res || !res.ok) {
            state.loading = false;
            const msg = (res && res.error) || 'تعذّر تحميل لوحة التاجر.';
            renderError(msg);
            safeLog('warn', 'loadDashboard failed:', res);
            return;
        }

        const data = res.data || {};
        state.products = Array.isArray(data.products) ? data.products : [];

        state.stats = {
            activeProducts: state.products.filter(function (p) { return p.active !== false; }).length,
            pendingOrders:  Number(data.pendingOrders)  || 0,
            salesTotal:     Number(data.salesTotal)     || 0
        };

        state.loading = false;
        state.loadedOnce = true;

        renderStats();
        renderProducts();
        safeLog('info', 'Dashboard loaded. products=' + state.products.length);
    }

    /* --------------------------------------------
       Product modal
       -------------------------------------------- */
    function buildModal(mode, product) {
        const isEdit = (mode === 'edit');
        const title  = isEdit ? 'تعديل المنتج' : 'إضافة منتج';
        const p      = product || {};

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = '' +
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<div class="modal-title">' + title + '</div>' +
                    '<button class="modal-close" data-action="close" aria-label="إغلاق">✕</button>' +
                '</div>' +
                '<div class="modal-body">' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="mp-name">اسم المنتج</label>' +
                        '<input id="mp-name" class="input-field" type="text" maxlength="120" value="' + escapeHtml(p.name || '') + '" />' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="mp-price">السعر (Pi)</label>' +
                        '<input id="mp-price" class="input-field" type="number" step="0.0001" min="0" value="' + (p.price !== undefined ? p.price : '') + '" />' +
                        '<span class="form-hint">السعر بوحدات π فقط. لا يتم تحويل العملات.</span>' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="mp-stock">المخزون</label>' +
                        '<input id="mp-stock" class="input-field" type="number" step="1" min="0" value="' + (p.stock !== undefined ? p.stock : '') + '" />' +
                    '</div>' +
                    '<div class="form-group">' +
                        '<label class="form-label" for="mp-desc">الوصف</label>' +
                        '<input id="mp-desc" class="input-field" type="text" maxlength="400" value="' + escapeHtml(p.description || '') + '" />' +
                    '</div>' +
                    '<div id="mp-error" class="auth-error hidden"></div>' +
                '</div>' +
                '<div class="modal-footer">' +
                    '<button class="btn btn-secondary" data-action="close">إلغاء</button>' +
                    '<button class="btn btn-primary" data-action="save">' + (isEdit ? 'حفظ' : 'إضافة') + '</button>' +
                '</div>' +
            '</div>';

        return overlay;
    }

    function closeModal() {
        const existing = document.querySelector('.modal-overlay');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        state.modalOpen = false;
    }

    function showModalError(msg) {
        const el = document.getElementById('mp-error');
        if (!el) return;
        el.textContent = msg;
        el.classList.remove('hidden');
    }

    function openProductModal(mode, productId) {
        if (state.modalOpen) return;

        let product = null;
        if (mode === 'edit' && productId) {
            product = state.products.find(function (x) { return x.id === productId; });
            if (!product) {
                if (typeof window.showToast === 'function') {
                    window.showToast('error', 'المنتج غير موجود.');
                }
                return;
            }
        }

        const overlay = buildModal(mode, product);
        document.body.appendChild(overlay);
        state.modalOpen = true;

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeModal();
        }, false);

        overlay.addEventListener('click', function (e) {
            const target = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!target) return;
            const action = target.getAttribute('data-action');

            if (action === 'close') {
                closeModal();
                return;
            }
            if (action === 'save') {
                saveProduct(mode, productId);
            }
        }, false);

        window.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') {
                closeModal();
                window.removeEventListener('keydown', onEsc, false);
            }
        }, false);
    }

    /* --------------------------------------------
       Product CRUD
       -------------------------------------------- */
    async function saveProduct(mode, productId) {
        const nameEl  = document.getElementById('mp-name');
        const priceEl = document.getElementById('mp-price');
        const stockEl = document.getElementById('mp-stock');
        const descEl  = document.getElementById('mp-desc');

        const name  = nameEl ? nameEl.value.trim() : '';
        const price = priceEl ? Number(priceEl.value) : NaN;
        const stock = stockEl ? parseInt(stockEl.value, 10) : NaN;
        const desc  = descEl ? descEl.value.trim() : '';

        if (!name || name.length < 2) {
            showModalError('اسم المنتج مطلوب (حرفان على الأقل).');
            return;
        }
        if (!isFinite(price) || price < 0) {
            showModalError('السعر يجب أن يكون رقماً غير سالب.');
            return;
        }
        if (!isFinite(stock) || stock < 0) {
            showModalError('المخزون يجب أن يكون رقماً صحيحاً غير سالب.');
            return;
        }

        const payload = { name: name, price: price, stock: stock, description: desc };

        const res = await window.GavApi.withAuth(function () {
            if (mode === 'edit' && productId) {
                return window.GavApi.endpoints.updateProduct(productId, payload);
            }
            return window.GavApi.endpoints.createProduct(payload);
        });

        if (!res || !res.ok) {
            showModalError((res && res.error) || 'فشل حفظ المنتج.');
            return;
        }

        closeModal();

        if (typeof window.showToast === 'function') {
            window.showToast('success', mode === 'edit' ? 'تم تحديث المنتج.' : 'تمت إضافة المنتج.');
        }

        // Force reload to get server-canonical data
        state.loadedOnce = false;
        loadDashboard({ force: true });
    }

    async function deleteProduct(productId) {
        if (!productId) return;

        const ok = window.confirm('هل أنت متأكد من حذف هذا المنتج؟');
        if (!ok) return;

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.deleteProduct(productId);
        });

        if (!res || !res.ok) {
            if (typeof window.showToast === 'function') {
                window.showToast('error', (res && res.error) || 'فشل حذف المنتج.');
            }
            return;
        }

        if (typeof window.showToast === 'function') {
            window.showToast('success', 'تم حذف المنتج.');
        }

        state.loadedOnce = false;
        loadDashboard({ force: true });
    }

    /* --------------------------------------------
       Event handlers
       -------------------------------------------- */
    function onListClick(e) {
        const btn = e.target.closest ? e.target.closest('[data-action]') : null;
        if (!btn) return;

        const action = btn.getAttribute('data-action');
        const id     = btn.getAttribute('data-product-id');

        if (action === 'edit')   openProductModal('edit', id);
        if (action === 'delete') deleteProduct(id);
    }

    function onAddClick() {
        openProductModal('create', null);
    }

    function onViewOrdersClick() {
        if (window.GavRouter && typeof window.GavRouter.go === 'function') {
            window.GavRouter.go('orders');
        }
    }

    function onViewChange(e) {
        const to = e && e.detail ? e.detail.to : null;
        if (to === VIEW_NAME) {
            loadDashboard({ force: false });
        }
    }

    function onAuthLogout() {
        // Clear merchant-specific state on logout.
        state.products = [];
        state.stats = { activeProducts: 0, pendingOrders: 0, salesTotal: 0 };
        state.loadedOnce = false;
        renderStats();
        renderEmpty();
    }

    /* --------------------------------------------
       Wiring
       -------------------------------------------- */
    function bindEvents() {
        const list = $(PRODUCTS_LIST_ID);
        if (list) list.addEventListener('click', onListClick, false);

        const addBtn = $(ADD_BTN_ID);
        if (addBtn) addBtn.addEventListener('click', onAddClick, false);

        const viewOrders = $(VIEW_ORDERS_BTN_ID);
        if (viewOrders) viewOrders.addEventListener('click', onViewOrdersClick, false);

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
            loadDashboard({ force: true });
        }

        safeLog('info', 'Merchant module initialized.');
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavMerchant = Object.freeze({
        init:    init,
        reload:  function () { return loadDashboard({ force: true }); },
        openNew: function () { openProductModal('create', null); }
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