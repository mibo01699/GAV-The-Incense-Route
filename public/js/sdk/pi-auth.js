/* ============================================================
   GAV – The Incense Route
   Module: Pi Authentication & Session Management
   Path:   public/js/sdk/pi-auth.js

   PURPOSE:
     - Provide loginWithPi() used by #login-pi-btn.
     - Handle onIncompletePaymentFound() per Pi SDK spec.
     - Persist session via sessionStorage (not localStorage).
     - Send accessToken to backend /api/auth/verify.
     - Update UI ONLY after server-side verification succeeds.
     - Provide logout().

   SECURITY:
     - Never trust auth.user from the frontend.
     - Never read accessToken from undocumented SDK properties.
     - PI_API_KEY is NEVER touched here (server-side only).

   COMPLIANCE:
     - Pi Network Testnet only.
     - No GCV, no YER in Mainnet, no fake APIs.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const SESSION_KEY       = 'gav.pi.session';
    const VERIFY_ENDPOINT   = '/api/auth/verify';
    const SCOPES            = ['username', 'payments'];
    const LOGIN_TIMEOUT_MS  = 90000;
    const VERIFY_TIMEOUT_MS = 20000;

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_PI_AUTH_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/pi-auth] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_PI_AUTH_LOADED__ = true;

    /* --------------------------------------------
       Internal state
       -------------------------------------------- */
    const state = {
        isAuthenticating: false,
        session: null
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/pi-auth] ' + msg, data);
        else                     fn.call(console, '[GAV/pi-auth] ' + msg);
    }

    function isPiReady() {
        return typeof window.Pi !== 'undefined' &&
               window.Pi !== null &&
               typeof window.Pi.authenticate === 'function' &&
               window.__GAV_PI_READY__ === true;
    }

    function getSession() {
        if (state.session) return state.session;
        try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed && parsed.accessToken && parsed.uid) {
                state.session = parsed;
                return parsed;
            }
            return null;
        } catch (e) {
            safeLog('warn', 'Failed to read sessionStorage:', e);
            return null;
        }
    }

    function setSession(session) {
        state.session = session;
        try {
            if (session) {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
            } else {
                sessionStorage.removeItem(SESSION_KEY);
            }
        } catch (e) {
            safeLog('warn', 'Failed to write sessionStorage:', e);
        }
    }

    function clearSession() {
        state.session = null;
        try {
            sessionStorage.removeItem(SESSION_KEY);
        } catch (e) {
            safeLog('warn', 'Failed to clear sessionStorage:', e);
        }
    }

    /* --------------------------------------------
       UI Helpers (non-invasive; do not break if elements missing)
       -------------------------------------------- */
    function showAuthError(message) {
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = message;
            el.classList.remove('hidden');
        }
        if (typeof window.showToast === 'function') {
            window.showToast('error', message);
        } else {
            safeLog('error', message);
        }
    }

    function clearAuthError() {
        const el = document.getElementById('auth-error');
        if (el) {
            el.textContent = '';
            el.classList.add('hidden');
        }
    }

    function setLoginButtonLoading(isLoading) {
        const btn = document.getElementById('login-pi-btn');
        if (!btn) return;
        if (isLoading) {
            btn.classList.add('loading');
            btn.setAttribute('disabled', 'disabled');
        } else {
            btn.classList.remove('loading');
            btn.removeAttribute('disabled');
        }
    }

    function updateAuthenticatedUI(session) {
        // Update header badge
        const badge = document.getElementById('user-badge');
        const status = document.getElementById('user-status');
        if (badge && status) {
            if (session) {
                badge.classList.add('authenticated');
                status.textContent = '@' + (session.username || 'Pi User');
            } else {
                badge.classList.remove('authenticated');
                status.textContent = 'زائر';
            }
        }

        // Hide auth overlay if present
        const overlay = document.getElementById('auth-overlay');
        if (overlay && session) {
            overlay.classList.add('hidden');
        } else if (overlay && !session) {
            overlay.classList.remove('hidden');
        }

        // Broadcast for other modules
        try {
            window.dispatchEvent(new CustomEvent(
                session ? 'gav:auth:success' : 'gav:auth:logout',
                { detail: session || null }
            ));
        } catch (e) {
            safeLog('warn', 'dispatchEvent failed:', e);
        }
    }

    /* --------------------------------------------
       Backend verification
       -------------------------------------------- */
    async function verifyTokenWithBackend(accessToken) {
        const controller = new AbortController();
        const timer = setTimeout(function () { controller.abort(); }, VERIFY_TIMEOUT_MS);

        try {
            const res = await fetch(VERIFY_ENDPOINT, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ accessToken: accessToken }),
                signal: controller.signal,
                credentials: 'same-origin'
            });

            clearTimeout(timer);

            let payload = null;
            try { payload = await res.json(); } catch (_) { /* noop */ }

            if (res.status === 401) {
                return { ok: false, status: 401, error: 'انتهت صلاحية الجلسة. الرجاء تسجيل الدخول مجدداً.' };
            }
            if (res.status === 400) {
                return { ok: false, status: 400, error: 'طلب غير صالح للخادم.' };
            }
            if (!res.ok) {
                return {
                    ok: false,
                    status: res.status,
                    error: (payload && payload.message) || 'فشل التحقق من الحساب على الخادم.'
                };
            }

            if (!payload || !payload.uid) {
                return { ok: false, status: 500, error: 'استجابة خادم غير صالحة.' };
            }

            return { ok: true, uid: payload.uid, username: payload.username || 'Pi User' };
        } catch (err) {
            clearTimeout(timer);
            if (err && err.name === 'AbortError') {
                return { ok: false, status: 0, error: 'انتهت مهلة الاتصال بالخادم.' };
            }
            safeLog('error', 'verifyTokenWithBackend failed:', err);
            return { ok: false, status: 0, error: 'تعذّر الاتصال بخادم GAV.' };
        }
    }

    /* --------------------------------------------
       Incomplete payment handler (SDK callback)
       -------------------------------------------- */
    function onIncompletePaymentFound(payment) {
        safeLog('warn', 'Incomplete payment found:', payment);

        if (!payment || !payment.identifier) {
            safeLog('error', 'onIncompletePaymentFound: missing payment identifier.');
            return;
        }

        // Notify user (non-blocking)
        if (typeof window.showToast === 'function') {
            window.showToast(
                'warning',
                'يوجد دفعة سابقة غير مكتملة. جاري معالجتها...'
            );
        }

        // Delegate to payment module if available; otherwise report to backend.
        try {
            if (window.GavPayment && typeof window.GavPayment.reconcile === 'function') {
                window.GavPayment.reconcile(payment);
                return;
            }
        } catch (e) {
            safeLog('error', 'GavPayment.reconcile threw:', e);
        }

        // Fallback: send to backend reconciliation endpoint
        try {
            fetch('/api/payments/reconcile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    paymentId: payment.identifier,
                    transactionId: payment.transaction && payment.transaction.txid
                        ? payment.transaction.txid
                        : null
                })
            }).catch(function (e) {
                safeLog('error', 'Failed to reconcile incomplete payment:', e);
            });
        } catch (e) {
            safeLog('error', 'Reconcile dispatch failed:', e);
        }
    }

    /* --------------------------------------------
       MAIN: loginWithPi()
       Called by #login-pi-btn in index.html
       -------------------------------------------- */
    async function loginWithPi() {
        // 1) Prevent duplicate clicks
        if (state.isAuthenticating) {
            safeLog('info', 'Authentication already in progress — ignoring duplicate click.');
            return;
        }

        // 2) Verify Pi SDK readiness
        if (!isPiReady()) {
            const msg = 'Pi SDK غير جاهز. الرجاء فتح التطبيق داخل Pi Browser Testnet.';
            showAuthError(msg);
            return;
        }

        // 3) Reset previous errors and lock the button
        clearAuthError();
        state.isAuthenticating = true;
        setLoginButtonLoading(true);

        let authResult = null;

        try {
            // 4) Call Pi.authenticate with required scopes
            const timeoutPromise = new Promise(function (_, reject) {
                setTimeout(function () {
                    reject(new Error('AUTH_TIMEOUT'));
                }, LOGIN_TIMEOUT_MS);
            });

            authResult = await Promise.race([
                window.Pi.authenticate(SCOPES, onIncompletePaymentFound),
                timeoutPromise
            ]);
        } catch (err) {
            state.isAuthenticating = false;
            setLoginButtonLoading(false);

            const message = (err && err.message) ? err.message : String(err);
            if (message === 'AUTH_TIMEOUT') {
                showAuthError('انتهت مهلة التفويض. الرجاء المحاولة مرة أخرى.');
            } else if (/cancel/i.test(message)) {
                showAuthError('تم إلغاء التفويض. يمكنك المحاولة مرة أخرى.');
            } else {
                showAuthError('تعذّر إكمال التفويض مع Pi Network.');
            }
            safeLog('error', 'Pi.authenticate failed:', err);
            return;
        }

        // 5) Extract auth.user and auth.accessToken ONLY from documented fields
        const authUser      = authResult && authResult.user ? authResult.user : null;
        const authAccessToken =
            (authResult && authResult.accessToken) ? authResult.accessToken : null;

        if (!authUser || !authAccessToken) {
            state.isAuthenticating = false;
            setLoginButtonLoading(false);
            showAuthError('لم يتم إرجاع بيانات التفويض بشكل صحيح من Pi.');
            safeLog('error', 'Missing auth.user or auth.accessToken in Pi response.');
            return;
        }

        // 6) Server-side verification is MANDATORY
        const verify = await verifyTokenWithBackend(authAccessToken);

        if (!verify.ok) {
            state.isAuthenticating = false;
            setLoginButtonLoading(false);
            showAuthError(verify.error || 'فشل التحقق من الخادم.');
            safeLog('error', 'Backend verification failed:', verify);
            return;
        }

        // 7) Trust ONLY server-verified identity
        const trustedSession = {
            uid: verify.uid,
            username: verify.username,
            accessToken: authAccessToken,
            sandbox: window.__GAV_PI_SANDBOX__ === true,
            createdAt: Date.now()
        };

        setSession(trustedSession);
        updateAuthenticatedUI(trustedSession);

        state.isAuthenticating = false;
        setLoginButtonLoading(false);

        if (typeof window.showToast === 'function') {
            window.showToast('success', 'مرحباً @' + trustedSession.username + ' 🪔');
        }
        safeLog('info', 'Login succeeded for uid=' + trustedSession.uid);
    }

    /* --------------------------------------------
       logout()
       -------------------------------------------- */
    function logout() {
        clearSession();
        updateAuthenticatedUI(null);
        if (typeof window.showToast === 'function') {
            window.showToast('info', 'تم تسجيل الخروج.');
        }
        safeLog('info', 'User logged out.');
    }

    /* --------------------------------------------
       Auto-restore session on load (no re-auth)
       -------------------------------------------- */
    function restoreSessionIfAny() {
        const existing = getSession();
        if (existing) {
            updateAuthenticatedUI(existing);
            safeLog('info', 'Session restored from sessionStorage for uid=' + existing.uid);
        } else {
            updateAuthenticatedUI(null);
        }
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.loginWithPi           = loginWithPi;             // used by index.html
    window.onIncompletePaymentFound = onIncompletePaymentFound; // referenced by SDK call

    window.GavAuth = Object.freeze({
        login: loginWithPi,
        logout: logout,
        getSession: getSession,
        isAuthenticated: function () { return getSession() !== null; },
        isAuthenticating: function () { return state.isAuthenticating === true; },
        onIncompletePaymentFound: onIncompletePaymentFound
    });

    /* --------------------------------------------
       Bootstrap
       -------------------------------------------- */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreSessionIfAny);
    } else {
        restoreSessionIfAny();
    }

})();
