/* ============================================================
   GAV – The Incense Route
   Module: App Bootstrap (Entry Point)
   Path:   public/js/app.js

   PURPOSE:
     - Hide splash screen after full readiness.
     - Initialize modules in strict order:
         State → Router → Auth → UI → Modules.
     - Show auth overlay when Pi is ready but user is guest.
     - Global error handlers (window.onerror, unhandledrejection).
     - Announce readiness via 'gav:app:ready' event.

   CONSTRAINTS:
     - No network calls here (modules handle their own).
     - No direct Pi SDK calls here (pi-auth.js handles).
     - No GCV, no YER, no fiat.
     - Never breaks if a module is missing.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const SPLASH_ID       = 'splash-screen';
    const SPLASH_STATUS   = 'splash-status';
    const APP_ID          = 'app';
    const AUTH_OVERLAY_ID = 'auth-overlay';

    const SPLASH_MIN_MS   = 500;   // keep splash visible briefly (nice UX)
    const SPLASH_MAX_MS   = 4000;  // hard cap

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_APP_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/app] Module already loaded — skipping.');
        }
        return;
    }
    window.__GAV_APP_LOADED__ = true;

    /* --------------------------------------------
       State
       -------------------------------------------- */
    const state = {
        startedAt: Date.now(),
        ready:     false,
        bootError: null
    };

    /* --------------------------------------------
       Utilities
       -------------------------------------------- */
    function safeLog(level, msg, data) {
        if (!window.console) return;
        const fn = console[level] || console.log;
        if (data !== undefined) fn.call(console, '[GAV/app] ' + msg, data);
        else                     fn.call(console, '[GAV/app] ' + msg);
    }

    function $(id) { return document.getElementById(id); }

    function setSplashStatus(text) {
        const el = $(SPLASH_STATUS);
        if (el) el.textContent = String(text || '');
    }

    function hideSplash() {
        const splash = $(SPLASH_ID);
        if (!splash) return;
        splash.classList.add('fade-out');
        setTimeout(function () {
            if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 500);
    }

    function showApp() {
        const app = $(APP_ID);
        if (app) app.classList.remove('hidden');
    }

    /* --------------------------------------------
       Auth overlay visibility
       -------------------------------------------- */
    function isPiReady() {
        return window.__GAV_PI_READY__ === true;
    }

    function hasVerifiedSession() {
        try {
            if (window.GavAuth && typeof window.GavAuth.isAuthenticated === 'function') {
                return window.GavAuth.isAuthenticated() === true;
            }
            if (window.GavState && typeof window.GavState.select === 'function') {
                const s = window.GavState.select('session');
                return !!(s && s.uid && s.accessToken);
            }
        } catch (_) {}
        return false;
    }

    function syncAuthOverlay() {
        const overlay = $(AUTH_OVERLAY_ID);
        if (!overlay) return;

        const authed = hasVerifiedSession();
        if (authed) {
            overlay.classList.add('hidden');
            safeLog('info', 'Auth overlay hidden (session verified).');
        } else {
            overlay.classList.remove('hidden');
            safeLog('info', 'Auth overlay shown (no verified session).');
        }
    }

    /* --------------------------------------------
       Module initialization
       -------------------------------------------- */
    function safeInit(name, fn) {
        if (typeof fn !== 'function') {
            safeLog('warn', 'Module "' + name + '" not available — skipping.');
            return false;
        }
        try {
            fn();
            return true;
        } catch (err) {
            safeLog('error', 'Module "' + name + '" init threw:', err);
            return false;
        }
    }

    function initState() {
        if (!window.GavState || typeof window.GavState.init !== 'function') {
            safeLog('error', 'GavState missing — cannot continue.');
            return false;
        }
        window.GavState.init();
        return true;
    }

    function initRouter() {
        if (!window.GavRouter || typeof window.GavRouter.init !== 'function') {
            safeLog('error', 'GavRouter missing — cannot continue.');
            return false;
        }
        window.GavRouter.init();
        return true;
    }

    function initAuth() {
        // pi-auth.js self-initializes on DOMContentLoaded.
        // We only verify that its public API exists.
        if (!window.GavAuth) {
            safeLog('warn', 'GavAuth not available.');
            return false;
        }
        return true;
    }

    function initUi() {
        // components.js and notifications.js are stateless; nothing to init.
        return !!(window.GavUI && window.GavNotify);
    }

    function initModules() {
        const modules = [
            ['marketplace', window.GavMarketplace],
            ['merchant',    window.GavMerchant],
            ['pos',         window.GavPos],
            ['barter',      window.GavBarter],
            ['supplyChain', window.GavSupplyChain],
            ['pricing',     window.GavPricing],
            ['payment',     window.GavPayment]   // loaded later; safe if missing
        ];

        let ok = 0;
        modules.forEach(function (pair) {
            const name = pair[0];
            const mod  = pair[1];
            if (mod && typeof mod.init === 'function') {
                safeInit(name, mod.init);
                ok++;
            } else {
                safeLog('warn', 'Module not registered: ' + name);
            }
        });
        safeLog('info', ok + ' module(s) initialized.');
        return ok;
    }

    /* --------------------------------------------
       Global error handlers
       -------------------------------------------- */
    function installGlobalErrorHandlers() {
        window.addEventListener('error', function (e) {
            const msg = (e && e.message) ? e.message : 'Unknown error';
            safeLog('error', 'window.error: ' + msg, e && e.error);
        }, false);

        window.addEventListener('unhandledrejection', function (e) {
            const reason = e && e.reason ? e.reason : 'Unknown rejection';
            safeLog('error', 'unhandledrejection:', reason);
        }, false);
    }

    /* --------------------------------------------
       Boot sequence
       -------------------------------------------- */
    function boot() {
        const t0 = Date.now();
        safeLog('info', 'Boot sequence starting...');

        setSplashStatus('جاري تهيئة الحالة...');

        // 1) State store
        if (!initState()) {
            state.bootError = 'State init failed';
            return finish(false, 'فشل تهيئة الحالة.');
        }

        setSplashStatus('جاري تهيئة التنقل...');

        // 2) Router
        if (!initRouter()) {
            state.bootError = 'Router init failed';
            return finish(false, 'فشل تهيئة التنقل.');
        }

        setSplashStatus('جاري تحميل وحدات الواجهة...');

        // 3) UI layer
        initUi();

        // 4) Auth (self-init already happened; just verify)
        initAuth();

        // 5) Business modules
        setSplashStatus('جاري تحميل وحدات التطبيق...');
        initModules();

        // 6) Reveal app + sync auth overlay
        showApp();
        syncAuthOverlay();

        // Wire future auth changes to overlay
        window.addEventListener('gav:auth:success', syncAuthOverlay, false);
        window.addEventListener('gav:auth:logout',  syncAuthOverlay, false);

        const elapsed = Date.now() - t0;
        safeLog('info', 'Boot sequence complete in ' + elapsed + 'ms. ' +
                        'Pi ready=' + (isPiReady() ? 'yes' : 'no'));

        finish(true, isPiReady()
            ? 'جاهز.'
            : 'Pi SDK غير جاهز. افتح التطبيق داخل Pi Browser Testnet.');
    }

    function finish(success, statusText) {
        // Enforce minimum splash duration for UX consistency
        const elapsed = Date.now() - state.startedAt;
        const wait = Math.max(0, Math.min(SPLASH_MIN_MS - elapsed, SPLASH_MAX_MS));

        setSplashStatus(statusText || (success ? 'جاهز.' : 'حدث خطأ.'));

        setTimeout(function () {
            hideSplash();
            state.ready = success;

            // Announce readiness
            try {
                window.dispatchEvent(new CustomEvent('gav:app:ready', {
                    detail: {
                        success: success,
                        piReady: isPiReady(),
                        error: state.bootError
                    }
                }));
            } catch (_) {}

            if (!success && typeof window.showToast === 'function') {
                window.showToast('error', statusText || 'فشل تشغيل التطبيق.');
            }
        }, wait);
    }

    /* --------------------------------------------
       Public API
       -------------------------------------------- */
    window.GavApp = Object.freeze({
        isReady: function () { return state.ready === true; },
        reboot:  function () {
            // Soft-reboot: re-init state + router (safe for debugging)
            safeLog('info', 'Soft reboot requested.');
            try {
                if (window.GavState && typeof window.GavState.init === 'function') {
                    window.GavState.init();
                }
                if (window.GavRouter && typeof window.GavRouter.init === 'function') {
                    window.GavRouter.init();
                }
                syncAuthOverlay();
                return true;
            } catch (err) {
                safeLog('error', 'Soft reboot failed:', err);
                return false;
            }
        },
        syncAuthOverlay: syncAuthOverlay
    });

    /* --------------------------------------------
       Bootstrap
       -------------------------------------------- */
    installGlobalErrorHandlers();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
