/* ============================================================
   GAV – The Incense Route
   Module: Pi SDK Configuration & Initialization
   Path:   public/js/sdk/pi-config.js

   PURPOSE:
     - Verify Pi SDK is loaded.
     - Initialize Pi exactly ONCE with Testnet (sandbox: true).
     - Expose readiness flags for downstream modules.
     - Never authenticate, never call APIs, never touch DOM.

   COMPLIANCE:
     - Pi Network Testnet only (sandbox: true).
     - No GCV, no YER, no fake APIs.
     - This is the ONLY place where Pi.init() is called.
   ============================================================ */

(function () {
    'use strict';

    /* --------------------------------------------
       Constants
       -------------------------------------------- */
    const PI_SDK_VERSION  = '2.0';
    const SANDBOX_MODE    = true;  // ⚠️ Testnet ONLY.
                                   // Do NOT set to false unless a full Mainnet
                                   // configuration + Developer Portal registration
                                   // are intentionally prepared.

    /* --------------------------------------------
       Duplicate-load guard
       -------------------------------------------- */
    if (window.__GAV_PI_CONFIG_LOADED__ === true) {
        if (window.console && console.warn) {
            console.warn('[GAV/pi-config] Module already loaded — skipping re-initialization.');
        }
        return;
    }
    window.__GAV_PI_CONFIG_LOADED__ = true;

    /* --------------------------------------------
       Default exposed flags (before init)
       -------------------------------------------- */
    window.__GAV_PI_READY__   = false;
    window.__GAV_PI_SANDBOX__ = SANDBOX_MODE;
    window.__GAV_PI_ERROR__   = null;

    /* --------------------------------------------
       Step 1 — Verify SDK presence
       -------------------------------------------- */
    if (typeof window.Pi === 'undefined' || window.Pi === null) {
        window.__GAV_PI_ERROR__ = 'Pi SDK غير محمّل. يرجى فتح التطبيق داخل Pi Browser.';
        if (window.console && console.error) {
            console.error(
                '[GAV/pi-config] FATAL: window.Pi is undefined.\n' +
                'Ensure <script src="https://sdk.minepi.com/pi-sdk.js"></script> ' +
                'is loaded BEFORE this module.'
            );
        }
        return;
    }

    /* --------------------------------------------
       Step 2 — Initialize Pi exactly once
       -------------------------------------------- */
    try {
        window.Pi.init({
            version: PI_SDK_VERSION,
            sandbox: SANDBOX_MODE
        });

        window.__GAV_PI_READY__ = true;

        if (window.console && console.info) {
            console.info(
                '[GAV/pi-config] Pi SDK initialized successfully. ' +
                'version=' + PI_SDK_VERSION + ', sandbox=' + SANDBOX_MODE
            );
        }
    } catch (err) {
        window.__GAV_PI_READY__ = false;
        window.__GAV_PI_ERROR__ = 'فشل تهيئة Pi SDK. الرجاء إعادة فتح التطبيق.';

        if (window.console && console.error) {
            console.error('[GAV/pi-config] Pi.init() threw an error:', err);
        }
    }

    /* --------------------------------------------
       Step 3 — Public helper API (read-only)
       -------------------------------------------- */
    window.GavPiConfig = Object.freeze({
        isReady: function () {
            return window.__GAV_PI_READY__ === true;
        },
        isSandbox: function () {
            return SANDBOX_MODE === true;
        },
        getVersion: function () {
            return PI_SDK_VERSION;
        },
        getError: function () {
            return window.__GAV_PI_ERROR__;
        }
    });

})();