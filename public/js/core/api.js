/* ============================================================
   GAV – The Incense Route
   Module: Unified API Client
   Path:   public/js/core/api.js
   ============================================================ */

(function () {
    'use strict';

    const API_BASE           = '/api/v1';
    const DEFAULT_TIMEOUT_MS = 20000;
    const LONG_TIMEOUT_MS    = 45000;
    const IDEMPOTENCY_HEADER = 'X-Idempotency-Key';

    const LONG_TIMEOUT_ENDPOINTS = ['/payments', '/pos/invoice', '/orders', '/invoices'];

    if (window.__GAV_API_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/api] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_API_LOADED__ = true;

    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/api] ' + msg, data);
        else                     fn.call(console, '[GAV/api] ' + msg);
    }

    function isObject(v) {
        return v !== null && typeof v === 'object' && !Array.isArray(v);
    }

    function generateIdempotencyKey() {
        const ts   = Date.now().toString(36);
        const rnd  = Math.random().toString(36).slice(2, 10);
        const rnd2 = Math.random().toString(36).slice(2, 10);
        return 'gav-' + ts + '-' + rnd + '-' + rnd2;
    }

    function pickTimeout(path, override) {
        if (typeof override === 'number' && override > 0) return override;
        for (let i = 0; i < LONG_TIMEOUT_ENDPOINTS.length; i++) {
            if (path.indexOf(LONG_TIMEOUT_ENDPOINTS[i]) !== -1) {
                return LONG_TIMEOUT_MS;
            }
        }
        return DEFAULT_TIMEOUT_MS;
    }

    function getAccessToken() {
        try {
            if (window.GavAuth && typeof window.GavAuth.getSession === 'function') {
                const s = window.GavAuth.getSession();
                return (s && s.accessToken) ? s.accessToken : null;
            }
        } catch (e) {
            safeLog('warn', 'Failed to read session:', e);
        }
        return null;
    }

    function getSandboxFlag() {
        return window.__GAV_PI_SANDBOX__ === true;
    }

    function messageForStatus(status, serverMessage) {
        if (serverMessage && typeof serverMessage === 'string' && serverMessage.trim()) {
            return serverMessage;
        }
        switch (status) {
            case 400: return 'طلب غير صالح. تحقق من البيانات المُدخلة.';
            case 401: return 'انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.';
            case 403: return 'ليس لديك صلاحية لتنفيذ هذا الإجراء.';
            case 404: return 'العنصر المطلوب غير موجود.';
            case 405: return 'العملية غير مدعومة على هذا المسار.';
            case 409: return 'تعارض في البيانات. الرجاء إعادة المحاولة.';
            case 422: return 'البيانات غير مقبولة من الخادم.';
            case 429: return 'طلبات كثيرة جداً. الرجاء المحاولة بعد قليل.';
            case 500: return 'خطأ داخلي في خادم GAV.';
            case 502: return 'خادم GAV غير متاح مؤقتاً.';
            case 503: return 'الخدمة غير متاحة حالياً.';
            case 504: return 'انتهت مهلة الخادم.';
            default:
                if (status >= 500) return 'خطأ في الخادم. الرجاء المحاولة لاحقاً.';
                return 'حدث خطأ غير متوقع (رمز ' + status + ').';
        }
    }

    function broadcastAuthExpired() {
        try {
            window.dispatchEvent(new CustomEvent('gav:auth:expired'));
        } catch (e) {
            safeLog('warn', 'dispatchEvent gav:auth:expired failed:', e);
        }
        if (window.GavAuth && typeof window.GavAuth.logout === 'function') {
            try { window.GavAuth.logout(); } catch (_) { /* noop */ }
        }
    }

    async function request(method, path, body, options) {
        options = options || {};

        const url = /^https?:\/\//.test(path)
            ? path
            : (API_BASE + (path.charAt(0) === '/' ? path : '/' + path));

        const timeoutMs = pickTimeout(url, options.timeoutMs);
        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, timeoutMs);

        const headers = {
            'Accept': 'application/json',
            'X-GAV-Client': 'web',
            'X-GAV-Sandbox': getSandboxFlag() ? 'true' : 'false'
        };

        const hasBody = (body !== undefined && body !== null) &&
                        ['POST', 'PUT', 'PATCH', 'DELETE'].indexOf(method) !== -1;

        if (hasBody) {
            headers['Content-Type'] = 'application/json';
        }

        if (options.skipAuth !== true) {
            const token = getAccessToken();
            if (token) {
                headers['Authorization'] = 'Bearer ' + token;
            }
        }

        if (isObject(options.headers)) {
            Object.keys(options.headers).forEach(function (k) {
                headers[k] = options.headers[k];
            });
        }

        if (hasBody && options.skipIdempotency !== true) {
            headers[IDEMPOTENCY_HEADER] =
                options.idempotencyKey || generateIdempotencyKey();
        }

        const init = {
            method: method,
            headers: headers,
            signal: controller.signal,
            credentials: 'same-origin',
            cache: 'no-store'
        };

        if (hasBody) {
            init.body = JSON.stringify(body);
        }

        let res;
        try {
            res = await fetch(url, init);
        } catch (err) {
            clearTimeout(timer);
            if (err && err.name === 'AbortError') {
                return {
                    ok: false,
                    status: 0,
                    code: 'TIMEOUT',
                    error: 'انتهت مهلة الاتصال بالخادم. الرجاء المحاولة مجدداً.'
                };
            }
            safeLog('error', method + ' ' + url + ' network error:', err);
            return {
                ok: false,
                status: 0,
                code: 'NETWORK',
                error: 'تعذّر الاتصال بخادم GAV. تحقق من الشبكة.'
            };
        }

        clearTimeout(timer);

        let payload = null;
        let rawText = '';
        try {
            rawText = await res.text();
            if (rawText) {
                try { payload = JSON.parse(rawText); }
                catch (_) { payload = { message: rawText }; }
            }
        } catch (_) {
            payload = null;
        }

        if (!res.ok) {
            const serverMsg = payload && (payload.message || payload.error);
            const msg = messageForStatus(res.status, serverMsg);

            if (res.status === 401) {
                broadcastAuthExpired();
            }

            if (res.status >= 500) {
                safeLog('error', method + ' ' + url + ' → ' + res.status, payload);
            } else if (res.status >= 400) {
                safeLog('warn', method + ' ' + url + ' → ' + res.status, payload);
            }

            return {
                ok: false,
                status: res.status,
                code: (payload && payload.code) || 'HTTP_' + res.status,
                error: msg,
                data: payload
            };
        }

        return {
            ok: true,
            status: res.status,
            data: payload
        };
    }

    function get(path, options) { return request('GET', path, null, options); }
    function post(path, body, options) { return request('POST', path, body || {}, options); }
    function put(path, body, options) { return request('PUT', path, body || {}, options); }
    function patch(path, body, options) { return request('PATCH', path, body || {}, options); }
    function del(path, body, options) { return request('DELETE', path, body || null, options); }

    function hasVerifiedSession() {
        try {
            if (!window.GavAuth) return false;
            if (typeof window.GavAuth.isAuthenticated !== 'function') return false;
            return window.GavAuth.isAuthenticated() === true;
        } catch (_) {
            return false;
        }
    }

    async function withAuth(fn) {
        if (typeof fn !== 'function') {
            return { ok: false, status: 0, error: 'withAuth requires a function.' };
        }
        if (!hasVerifiedSession()) {
            if (typeof window.showToast === 'function') {
                window.showToast('warning', 'الرجاء تسجيل الدخول بحساب Pi أولاً.');
            }
            const overlay = document.getElementById('auth-overlay');
            if (overlay) overlay.classList.remove('hidden');
            return { ok: false, status: 401, error: 'يجب تسجيل الدخول أولاً.' };
        }
        try {
            return await fn();
        } catch (err) {
            safeLog('error', 'withAuth callback threw:', err);
            return { ok: false, status: 0, error: 'حدث خطأ غير متوقع.' };
        }
    }

    /* --------------------------------------------
       Endpoint wrappers — matched to api/index.js
       -------------------------------------------- */
    const endpoints = Object.freeze({

        /* Auth */
        verifyAuth: function (accessToken) {
            return post('/auth/verify',
                { accessToken: accessToken },
                { skipAuth: true });
        },

        /* Reference Index */
        getReferenceIndex: function () {
            return get('/pricing/reference');
        },

        /* Products */
        listProducts: function (q) {
            const suffix = q ? ('?search=' + encodeURIComponent(q)) : '';
            return get('/products' + suffix);
        },
        getProduct: function (id) {
            return get('/products/' + encodeURIComponent(id));
        },
        createProduct: function (data) {
            return post('/products', data || {});
        },
        updateProduct: function (id, data) {
            return put('/products/' + encodeURIComponent(id), data || {});
        },
        deleteProduct: function (id) {
            return del('/products/' + encodeURIComponent(id));
        },

        /* Merchant */
        listMyProducts: function () {
            return get('/merchants/me');
        },

        /* POS */
        posCheckout: function (items) {
            return post('/pos/invoice', { items: items || [] });
        },

        /* Orders */
        listOrders: function () { return get('/orders'); },
        getOrder: function (id) { return get('/orders/' + encodeURIComponent(id)); },

        /* Invoices */
        listInvoices: function () { return get('/invoices'); },

        /* Payments */
        createPayment: function (data) {
            return post('/payments/create', data || {});
        },
        approvePayment: function (paymentId) {
            return post('/payments/approve', { paymentId: paymentId });
        },
        completePayment: function (paymentId, txid) {
            return post('/payments/complete', { paymentId: paymentId, txid: txid });
        },
        listPayments: function () { return get('/payments'); },
        reconcilePayment: function (paymentId, txid) {
            return post('/payments/reconcile', { paymentId: paymentId, txid: txid });
        },

        /* Supply Chain */
        listSupplyChain: function () { return get('/supply-chain'); },

        /* Barter */
        listBarterEvents: function () { return get('/barter/festivals'); },
        joinBarterEvent: function (id) {
            return post('/barter/festivals/' + encodeURIComponent(id) + '/offers', {});
        },
        leaveBarterEvent: function (id) {
            return post('/barter/festivals/' + encodeURIComponent(id) + '/leave', {});
        },

        /* Audit */
        listAuditLog: function () { return get('/audit'); }
    });

    window.GavApi = Object.freeze({
        request:     request,
        get:         get,
        post:        post,
        put:         put,
        patch:       patch,
        delete:      del,
        withAuth:    withAuth,
        hasSession:  hasVerifiedSession,
        endpoints:   endpoints,
        baseUrl:     API_BASE
    });

    safeLog('info', 'API client ready. base=' + API_BASE);

})();