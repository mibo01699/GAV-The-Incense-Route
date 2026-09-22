/* ============================================================
   GAV – The Incense Route
   Module: Central State Store
   Path:   public/js/core/state.js

   PURPOSE:
     - Single in-memory store for the entire app.
     - subscribe / unsubscribe / getState / setState / select.
     - Namespaced keys: session, cart, products, orders, ui, reference.
     - Emit 'gav:state:change' on every mutation.
     - Persist `cart` in sessionStorage (NOT localStorage).
     - React to gav:auth:success / gav:auth:logout.

   CONSTRAINTS:
     - No external libraries.
     - No network calls.
     - No DOM manipulation (UI modules subscribe instead).
     - Immutable top-level updates (new object refs for changed keys).
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const CART_KEY = 'gav.state.cart';
    const NAMESPACES = Object.freeze([
        'session',
        'cart',
        'products',
        'orders',
        'ui',
        'reference'
    ]);

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_STATE_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/state] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_STATE_LOADED__ = true;

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/state] ' + msg, data);
        else                     fn.call(console, '[GAV/state] ' + msg);
    }

    function deepClone(v) {
        if (v === null || typeof v !== 'object') return v;
        try {
            if (typeof structuredClone === 'function') return structuredClone(v);
        } catch (_) { /* fall through */ }
        try {
            return JSON.parse(JSON.stringify(v));
        } catch (_) {
            return v;
        }
    }

    function shallowEqual(a, b) {
        if (a === b) return true;
        if (!a || !b) return false;
        if (typeof a !== 'object' || typeof b !== 'object') return false;
        const ka = Object.keys(a);
        const kb = Object.keys(b);
        if (ka.length !== kb.length) return false;
        for (let i = 0; i < ka.length; i++) {
            if (a[ka[i]] !== b[kb[i]] && ka[i] !== undefined) {
                if (a[ka[i]] !== b[ka[i]]) return false;
            }
        }
        return true;
    }

    /* --------------------------------------------
       Initial state
       -------------------------------------------- */
    const initialState = Object.freeze({
        session:   null,          // { uid, username, accessToken, sandbox, createdAt }
        cart:      [],            // [{ id, name, price, qty, image? }]
        products:  [],            // marketplace list
        orders:    [],            // user orders
        ui: {
            currentView:     'marketplace',
            sidebarOpen:     false,
            loading:         false,
            connectionLost:  false
        },
        reference: {
            index:      [],       // reference price rows
            updatedAt:  null
        }
    });

    /* --------------------------------------------
       Internal store
       -------------------------------------------- */
    let state = deepClone(initialState);

    // Subscribers: Map<id, { keys: Set|null, fn: Function }>
    const subscribers = new Map();
    let nextSubId = 1;

    /* --------------------------------------------
       Persistence — Cart only
       -------------------------------------------- */
    function loadCartFromStorage() {
        try {
            const raw = sessionStorage.getItem(CART_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed.filter(function (item) {
                return item && typeof item.id === 'string' &&
                       typeof item.price === 'number' &&
                       typeof item.qty === 'number';
            });
        } catch (e) {
            safeLog('warn', 'Failed to load cart:', e);
            return [];
        }
    }

    function saveCartToStorage(cart) {
        try {
            sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
        } catch (e) {
            safeLog('warn', 'Failed to save cart:', e);
        }
    }

    function clearCartStorage() {
        try {
            sessionStorage.removeItem(CART_KEY);
        } catch (_) { /* noop */ }
    }

    /* --------------------------------------------
       Notifications
       -------------------------------------------- */
    function notify(keys, prevState) {
        // Copy to avoid mutation during iteration
        const subs = Array.from(subscribers.values());
        for (let i = 0; i < subs.length; i++) {
            const sub = subs[i];
            try {
                const interested =
                    sub.keys === null ||                       // global
                    keys.some(function (k) { return sub.keys.has(k); });

                if (interested) {
                    sub.fn(getState(), prevState, keys.slice());
                }
            } catch (err) {
                safeLog('error', 'Subscriber threw:', err);
            }
        }

        // Broadcast event
        try {
            window.dispatchEvent(new CustomEvent('gav:state:change', {
                detail: { keys: keys.slice() }
            }));
        } catch (e) {
            safeLog('warn', 'dispatchEvent gav:state:change failed:', e);
        }
    }

    /* --------------------------------------------
       Core getters/setters
       -------------------------------------------- */
    function getState() {
        return state;
    }

    function select(key) {
        if (NAMESPACES.indexOf(key) === -1) {
            safeLog('warn', 'Unknown namespace requested: ' + key);
            return undefined;
        }
        return state[key];
    }

    /**
     * setState({ key1: value1, key2: value2 }, options)
     * options.silent — do not notify subscribers
     */
    function setState(partial, options) {
        options = options || {};

        if (!partial || typeof partial !== 'object') return;

        const prevState = state;
        const changedKeys = [];
        const nextState = Object.assign({}, state);

        Object.keys(partial).forEach(function (key) {
            if (NAMESPACES.indexOf(key) === -1) {
                safeLog('warn', 'Ignoring unknown namespace: ' + key);
                return;
            }
            if (!shallowEqual(state[key], partial[key])) {
                nextState[key] = partial[key];
                changedKeys.push(key);
            }
        });

        if (changedKeys.length === 0) return;

        state = nextState;

        // Persist cart whenever it changes
        if (changedKeys.indexOf('cart') !== -1) {
            saveCartToStorage(state.cart);
        }

        if (options.silent !== true) {
            notify(changedKeys, prevState);
        }
    }

    /* --------------------------------------------
       Subscriptions
       -------------------------------------------- */
    /**
     * subscribe(keys, fn) -> unsubscribe fn
     *   keys: array of namespace strings, or null for global
     *   fn(newState, prevState, changedKeys)
     */
    function subscribe(keys, fn) {
        if (typeof keys === 'function') {
            // Called as subscribe(fn) → global subscriber
            fn = keys;
            keys = null;
        }
        if (typeof fn !== 'function') {
            safeLog('warn', 'subscribe called without a valid function.');
            return function () {};
        }

        let keySet = null;
        if (Array.isArray(keys) && keys.length > 0) {
            keySet = new Set(keys.filter(function (k) {
                return NAMESPACES.indexOf(k) !== -1;
            }));
            if (keySet.size === 0) keySet = null;
        }

        const id = nextSubId++;
        subscribers.set(id, { keys: keySet, fn: fn });

        return function unsubscribe() {
            subscribers.delete(id);
        };
    }

    function unsubscribeAll() {
        subscribers.clear();
    }

    /* --------------------------------------------
       Cart helpers
       -------------------------------------------- */
    function addToCart(product, qty) {
        qty = Math.max(1, parseInt(qty, 10) || 1);

        if (!product || typeof product.id !== 'string') {
            safeLog('warn', 'addToCart: invalid product.');
            return;
        }
        if (typeof product.price !== 'number' || product.price < 0) {
            safeLog('warn', 'addToCart: invalid price.');
            return;
        }

        const cart = state.cart.slice();
        const existing = cart.findIndex(function (it) { return it.id === product.id; });

        if (existing !== -1) {
            cart[existing] = Object.assign({}, cart[existing], {
                qty: cart[existing].qty + qty
            });
        } else {
            cart.push({
                id:    product.id,
                name:  String(product.name || 'منتج'),
                price: product.price,
                qty:   qty,
                image: product.image || null
            });
        }

        setState({ cart: cart });
    }

    function removeFromCart(productId) {
        if (typeof productId !== 'string') return;
        const cart = state.cart.filter(function (it) { return it.id !== productId; });
        if (cart.length === state.cart.length) return;
        setState({ cart: cart });
    }

    function updateCartQty(productId, qty) {
        qty = parseInt(qty, 10);
        if (isNaN(qty)) return;

        if (qty <= 0) {
            removeFromCart(productId);
            return;
        }

        const cart = state.cart.map(function (it) {
            if (it.id === productId) {
                return Object.assign({}, it, { qty: qty });
            }
            return it;
        });

        setState({ cart: cart });
    }

    function clearCart() {
        clearCartStorage();
        setState({ cart: [] });
    }

    function cartTotal() {
        return state.cart.reduce(function (sum, it) {
            return sum + (it.price * it.qty);
        }, 0);
    }

    function cartItemCount() {
        return state.cart.reduce(function (sum, it) { return sum + it.qty; }, 0);
    }

    /* --------------------------------------------
       Auth reactions
       -------------------------------------------- */
    function onAuthSuccess(e) {
        const session = e && e.detail ? e.detail : null;
        setState({ session: session });

        // Attempt to hydrate session from GavAuth if event detail is empty
        if (!session && window.GavAuth && typeof window.GavAuth.getSession === 'function') {
            const s = window.GavAuth.getSession();
            if (s) setState({ session: s });
        }
    }

    function onAuthLogout() {
        setState({ session: null });
        // Do NOT clear cart automatically — user may want it after re-login.
    }

    /* --------------------------------------------
       Init
       -------------------------------------------- */
    let initialized = false;

    function init() {
        if (initialized) return;
        initialized = true;

        // Restore cart from sessionStorage
        const restoredCart = loadCartFromStorage();
        if (restoredCart.length > 0) {
            state = Object.assign({}, state, { cart: restoredCart });
            safeLog('info', 'Cart restored: ' + restoredCart.length + ' item(s).');
        }

        // Hydrate session from GavAuth if a verified session already exists
        if (window.GavAuth && typeof window.GavAuth.getSession === 'function') {
            const existing = window.GavAuth.getSession();
            if (existing) {
                state = Object.assign({}, state, { session: existing });
                safeLog('info', 'Session hydrated from GavAuth for uid=' + existing.uid);
            }
        }

        // Listen to auth events
        window.addEventListener('gav:auth:success', onAuthSuccess, false);
        window.addEventListener('gav:auth:logout',  onAuthLogout,  false);

        // Sync UI namespace when router changes view
        window.addEventListener('gav:view:change', function (e) {
            const to = e && e.detail ? e.detail.to : null;
            if (to) {
                setState({ ui: Object.assign({}, state.ui, { currentView: to }) });
            }
        }, false);

        safeLog('info', 'State store initialized.');
    }

    /* --------------------------------------------
       Reset (used by logout flows if needed)
       -------------------------------------------- */
    function reset() {
        state = deepClone(initialState);
        clearCartStorage();
        notify(NAMESPACES.slice(), state);
        safeLog('info', 'State store reset.');
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavState = Object.freeze({
        init:            init,
        get:             getState,
        select:          select,
        set:             setState,
        subscribe:       subscribe,
        unsubscribeAll:  unsubscribeAll,
        reset:           reset,

        // Cart
        addToCart:       addToCart,
        removeFromCart:  removeFromCart,
        updateCartQty:   updateCartQty,
        clearCart:       clearCart,
        cartTotal:       cartTotal,
        cartItemCount:   cartItemCount,

        // Namespaces (read-only reference for tooling)
        namespaces:      NAMESPACES.slice()
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