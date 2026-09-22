/* ============================================================
   GAV – Module: Merchant Dashboard
   Path:   public/js/modules/merchant.js
   ============================================================ */

(function () {
    'use strict';

    const VIEW_NAME = 'merchant';
    const LIST_ID = 'merchant-products-list';
    const COUNT_ID = 'merchant-products-count';
    const ORDERS_ID = 'merchant-orders-count';
    const SALES_ID = 'merchant-sales-total';
    const ADD_BTN = 'add-product-btn';
    const VIEW_ORDERS_BTN = 'view-orders-btn';

    if (window.__GAV_MERCHANT_LOADED__ === true) return;
    window.__GAV_MERCHANT_LOADED__ = true;

    const state = { products: [], stats: { activeProducts: 0, pendingOrders: 0, salesTotal: 0 }, loading: false, loadedOnce: false, modalOpen: false };

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/merchant] ' + msg, data);
        else fn.call(console, '[GAV/merchant] ' + msg);
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

    function renderStats() {
        const p = $(COUNT_ID); if (p) p.textContent = String(state.stats.activeProducts || 0);
        const o = $(ORDERS_ID); if (o) o.textContent = String(state.stats.pendingOrders || 0);
        const s = $(SALES_ID); if (s) s.textContent = formatPi(state.stats.salesTotal || 0);
    }

    function renderLoading() {
        const list = $(LIST_ID);
        if (list) list.innerHTML = '<div class="empty-state"><p>جاري التحميل...</p></div>';
    }

    function renderEmpty() {
        const list = $(LIST_ID);
        if (list) list.innerHTML = '<div class="empty-state"><p>لم تقم بإضافة أي منتجات بعد.</p></div>';
    }

    function renderProducts() {
        const list = $(LIST_ID);
        if (!list) return;
        if (!state.products.length) { renderEmpty(); return; }

        list.innerHTML = state.products.map(function (p) {
            const id = escapeHtml(p.id || '');
            const name = escapeHtml(p.name || 'منتج');
            const price = formatPi(p.price);
            const stock = (typeof p.stock === 'number') ? p.stock : '—';
            const badge = p.active !== false ? '<span class="badge badge-success">نشط</span>' : '<span class="badge badge-warning">موقوف</span>';
            return '<div class="list-item" data-product-id="' + id + '">' +
                '<div class="list-item-icon">📦</div>' +
                '<div class="list-item-body">' +
                '<div class="list-item-title">' + name + ' ' + badge + '</div>' +
                '<div class="list-item-subtitle">المخزون: ' + escapeHtml(stock) + '</div>' +
                '</div>' +
                '<div class="list-item-meta">' +
                '<div class="list-item-amount">' + price + ' π</div>' +
                '<div style="display:flex;gap:0.25rem;margin-top:0.25rem;">' +
                '<button class="qty-btn" data-action="edit" data-product-id="' + id + '">✎</button>' +
                '<button class="qty-btn" data-action="delete" data-product-id="' + id + '">🗑</button>' +
                '</div></div></div>';
        }).join('');
    }

    async function loadDashboard(options) {
        options = options || {};
        if (state.loading || (!options.force && state.loadedOnce)) return;
        state.loading = true;
        renderLoading();

        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.listMyProducts();
        });

        state.loading = false;
        if (!res || !res.ok) {
            const list = $(LIST_ID);
            if (list) list.innerHTML = '<div class="empty-state"><p>' + escapeHtml((res && res.error) || 'تعذّر التحميل.') + '</p></div>';
            return;
        }

        const data = res.data || {};
        state.products = Array.isArray(data.products) ? data.products : [];
        state.stats = {
            activeProducts: state.products.filter(function (p) { return p.active !== false; }).length,
            pendingOrders: Number(data.pendingOrders) || 0,
            salesTotal: Number(data.salesTotal) || 0
        };
        state.loadedOnce = true;
        renderStats(); renderProducts();
        safeLog('info', 'Dashboard loaded.');
    }

    function showModal(mode, product) {
        if (state.modalOpen) return;
        const isEdit = mode === 'edit';
        const p = product || {};
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = '<div class="modal"><div class="modal-header"><div class="modal-title">' + (isEdit ? 'تعديل المنتج' : 'إضافة منتج') + '</div>' +
            '<button class="modal-close" data-action="close">✕</button></div>' +
            '<div class="modal-body">' +
            '<div class="form-group"><label class="form-label">اسم المنتج</label><input id="mp-name" class="input-field" type="text" maxlength="120" value="' + escapeHtml(p.name || '') + '" /></div>' +
            '<div class="form-group"><label class="form-label">السعر (Pi)</label><input id="mp-price" class="input-field" type="number" step="0.0001" min="0" value="' + (p.price !== undefined ? p.price : '') + '" /><span class="form-hint">السعر بوحدات π فقط. لا يتم تحويل العملات.</span></div>' +
            '<div class="form-group"><label class="form-label">المخزون</label><input id="mp-stock" class="input-field" type="number" step="1" min="0" value="' + (p.stock !== undefined ? p.stock : '') + '" /></div>' +
            '<div class="form-group"><label class="form-label">الوصف</label><input id="mp-desc" class="input-field" type="text" maxlength="400" value="' + escapeHtml(p.description || '') + '" /></div>' +
            '<div id="mp-error" class="auth-error hidden"></div></div>' +
            '<div class="modal-footer"><button class="btn btn-secondary" data-action="close">إلغاء</button><button class="btn btn-primary" data-action="save">' + (isEdit ? 'حفظ' : 'إضافة') + '</button></div></div>';

        document.body.appendChild(overlay);
        state.modalOpen = true;

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) { closeModal(); return; }
            const btn = e.target.closest ? e.target.closest('[data-action]') : null;
            if (!btn) return;
            const action = btn.getAttribute('data-action');
            if (action === 'close') closeModal();
            if (action === 'save') saveProduct(mode, p.id);
        }, false);

        window.addEventListener('keydown', function onEsc(e) {
            if (e.key === 'Escape') { closeModal(); window.removeEventListener('keydown', onEsc, false); }
        }, false);
    }

    function closeModal() {
        const el = document.querySelector('.modal-overlay');
        if (el && el.parentNode) el.parentNode.removeChild(el);
        state.modalOpen = false;
    }

    function showModalError(msg) {
        const el = document.getElementById('mp-error');
        if (el) { el.textContent = msg; el.classList.remove('hidden'); }
    }

    async function saveProduct(mode, productId) {
        const nameEl = document.getElementById('mp-name');
        const priceEl = document.getElementById('mp-price');
        const stockEl = document.getElementById('mp-stock');
        const descEl = document.getElementById('mp-desc');

        const name = nameEl ? nameEl.value.trim() : '';
        const price = priceEl ? Number(priceEl.value) : NaN;
        const stock = stockEl ? parseInt(stockEl.value, 10) : NaN;
        const desc = descEl ? descEl.value.trim() : '';

        if (!name || name.length < 2) { showModalError('اسم المنتج مطلوب.'); return; }
        if (!isFinite(price) || price < 0) { showModalError('السعر غير صالح.'); return; }
        if (!isFinite(stock) || stock < 0) { showModalError('المخزون غير صالح.'); return; }

        const payload = { name: name, price: price, stock: stock, description: desc };

        const res = await window.GavApi.withAuth(function () {
            if (mode === 'edit' && productId) return window.GavApi.endpoints.updateProduct(productId, payload);
            return window.GavApi.endpoints.createProduct(payload);
        });

        if (!res || !res.ok) { showModalError((res && res.error) || 'فشل الحفظ.'); return; }

        closeModal();
        if (typeof window.showToast === 'function') window.showToast('success', mode === 'edit' ? 'تم التحديث.' : 'تمت الإضافة.');
        state.loadedOnce = false;
        loadDashboard({ force: true });
    }

    async function deleteProduct(productId) {
        if (!productId || !window.confirm('حذف هذا المنتج؟')) return;
        const res = await window.GavApi.withAuth(function () {
            return window.GavApi.endpoints.deleteProduct(productId);
        });
        if (!res || !res.ok) {
            if (typeof window.showToast === 'function') window.showToast('error', (res && res.error) || 'فشل الحذف.');
            return;
        }
        if (typeof window.showToast === 'function') window.showToast('success', 'تم الحذف.');
        state.loadedOnce = false;
        loadDashboard({ force: true });
    }

    function onListClick(e) {
        const btn = e.target.closest ? e.target.closest('[data-action]') : null;
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-product-id');
        if (action === 'edit') showModal('edit', state.products.find(function (x) { return x.id === id; }));
        if (action === 'delete') deleteProduct(id);
    }

    function onViewChange(e) {
        if (e && e.detail && e.detail.to === VIEW_NAME) loadDashboard({ force: false });
    }

    function onAuthLogout() {
        state.products = []; state.stats = { activeProducts: 0, pendingOrders: 0, salesTotal: 0 };
        state.loadedOnce = false; renderStats(); renderEmpty();
    }

    function bindEvents() {
        const list = $(LIST_ID);
        if (list) list.addEventListener('click', onListClick, false);
        const addBtn = $(ADD_BTN);
        if (addBtn) addBtn.addEventListener('click', function () { showModal('create', null); }, false);
        const viewOrders = $(VIEW_ORDERS_BTN);
        if (viewOrders) viewOrders.addEventListener('click', function () {
            if (window.GavRouter) window.GavRouter.go('orders');
        }, false);
        window.addEventListener('gav:view:change', onViewChange, false);
        window.addEventListener('gav:auth:logout', onAuthLogout, false);
    }

    let initialized = false;
    function init() {
        if (initialized) return;
        initialized = true;
        bindEvents();
        const cur = window.GavRouter && window.GavRouter.current ? window.GavRouter.current() : null;
        if (cur === VIEW_NAME) loadDashboard({ force: true });
        safeLog('info', 'Merchant initialized.');
    }

    window.GavMerchant = Object.freeze({
        init: init,
        reload: function () { return loadDashboard({ force: true }); }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();