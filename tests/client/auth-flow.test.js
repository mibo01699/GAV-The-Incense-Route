/* ============================================================
   GAV – The Incense Route
   Tests: client auth flow (pi-config.js + pi-auth.js)
   Path:  tests/client/auth-flow.test.js

   COVERAGE (per project requirements):
     1. loginWithPi is defined on window (no ReferenceError)
     2. Clicking #login-pi-btn calls loginWithPi
     3. loginWithPi calls Pi.authenticate with correct scopes
     4. accessToken is POSTed to /api/auth/verify
     5. UI (user-status) updates ONLY after server success
     6. Cancel path shows controlled Arabic message
     7. Invalid token → 401 → UI not updated
     8. Duplicate click guard prevents double authenticate
     9. Missing window.Pi → shows clear Arabic error
    10. Pi.init is called exactly ONCE

   RUN:
     npx jest tests/client/auth-flow.test.js --env=jsdom
   ============================================================ */

/**
 * @jest-environment jsdom
 */

'use strict';

const fs   = require('fs');
const path = require('path');

/* --------------------------------------------
   Paths to the client files under test
   -------------------------------------------- */
const PI_CONFIG_PATH = path.resolve(__dirname, '../../public/js/sdk/pi-config.js');
const PI_AUTH_PATH   = path.resolve(__dirname, '../../public/js/sdk/pi-auth.js');

/* --------------------------------------------
   HTML fixture (minimal, mirrors index.html)
   -------------------------------------------- */
function installDom() {
    document.body.innerHTML = `
        <div id="auth-overlay" class="auth-overlay hidden">
            <button id="login-pi-btn">🚀 تسجيل الدخول بحساب Pi</button>
            <p id="auth-error" class="auth-error hidden"></p>
        </div>
        <div id="user-badge" class="user-badge">
            <span id="user-status">زائر</span>
        </div>
        <div id="toast-container"></div>
    `;
}

/* --------------------------------------------
   Fresh module loader (evicts require cache)
   -------------------------------------------- */
function loadClientScripts() {
    // Clear window flags so the IIFE guards re-run
    delete window.__GAV_PI_CONFIG_LOADED__;
    delete window.__GAV_PI_AUTH_LOADED__;
    delete window.__GAV_PI_READY__;
    delete window.__GAV_PI_SANDBOX__;
    delete window.__GAV_PI_ERROR__;
    delete window.Pi;
    delete window.GavPiConfig;
    delete window.GavAuth;
    delete window.loginWithPi;
    delete window.onIncompletePaymentFound;

    // Evict from require cache
    try { delete require.cache[require.resolve(PI_CONFIG_PATH)]; } catch (_) {}
    try { delete require.cache[require.resolve(PI_AUTH_PATH)]; }   catch (_) {}

    // Evaluate both scripts in the current jsdom window
    const configCode = fs.readFileSync(PI_CONFIG_PATH, 'utf8');
    const authCode   = fs.readFileSync(PI_AUTH_PATH,   'utf8');

    // eslint-disable-next-line no-new-func
    new Function(configCode).call(window);
    // eslint-disable-next-line no-new-func
    new Function(authCode).call(window);
}

/* --------------------------------------------
   Mock window.Pi
   -------------------------------------------- */
function mockPi(overrides) {
    overrides = overrides || {};
    const authenticate = jest.fn(
        overrides.authenticate ||
        (function () {
            return Promise.resolve({
                user:        { uid: 'uid-test', username: 'pi_user' },
                accessToken: 'access-token-abc'
            });
        })
    );

    window.Pi = {
        init:         jest.fn(overrides.init || function () {}),
        authenticate: authenticate,
        createPayment: jest.fn()
    };

    return { authenticate };
}

/* --------------------------------------------
   Mock fetch
   -------------------------------------------- */
function mockFetch(responder) {
    global.fetch = jest.fn(function (url, init) {
        return Promise.resolve(responder(url, init));
    });
    // jsdom also exposes window.fetch — keep them in sync
    window.fetch = global.fetch;
}

function jsonResponse(status, body) {
    return {
        ok: status >= 200 && status < 300,
        status: status,
        text: async () => JSON.stringify(body),
        json: async () => body
    };
}

/* ============================================
   Suite
   ============================================ */

describe('GAV client auth flow', function () {

    beforeEach(function () {
        jest.useFakeTimers({ legacyFakeTimers: true });
        installDom();
        sessionStorage.clear();
    });

    afterEach(function () {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    /* ----------------------------------------
       1. loginWithPi is defined on window
       ---------------------------------------- */
    test('defines window.loginWithPi (no ReferenceError)', function () {
        mockPi();
        loadClientScripts();

        expect(typeof window.loginWithPi).toBe('function');
        expect(window.__GAV_PI_CONFIG_LOADED__).toBe(true);
        expect(window.__GAV_PI_AUTH_LOADED__).toBe(true);
    });

    /* ----------------------------------------
       2. Pi.init called exactly once
       ---------------------------------------- */
    test('calls Pi.init exactly once with sandbox:true', function () {
        const { authenticate } = mockPi();
        loadClientScripts();

        expect(window.Pi.init).toHaveBeenCalledTimes(1);
        expect(window.Pi.init).toHaveBeenCalledWith({
            version: '2.0',
            sandbox: true
        });
        expect(window.__GAV_PI_READY__).toBe(true);
        void authenticate;
    });

    /* ----------------------------------------
       3. Clicking #login-pi-btn calls loginWithPi
       ---------------------------------------- */
    test('clicking login button invokes loginWithPi', function () {
        mockPi();
        loadClientScripts();

        const spy = jest.spyOn(window, 'loginWithPi').mockResolvedValue();

        // Manually wire onclick the way index.html does
        const btn = document.getElementById('login-pi-btn');
        btn.onclick = window.loginWithPi;

        btn.click();

        expect(spy).toHaveBeenCalledTimes(1);
    });

    /* ----------------------------------------
       4. loginWithPi calls Pi.authenticate with scopes
       ---------------------------------------- */
    test('calls Pi.authenticate with [username, payments]', async function () {
        const { authenticate } = mockPi();
        mockFetch(function () {
            return jsonResponse(200, { uid: 'uid-test', username: 'pi_user' });
        });

        loadClientScripts();

        await window.loginWithPi();

        expect(authenticate).toHaveBeenCalledTimes(1);
        const scopes = authenticate.mock.calls[0][0];
        expect(scopes).toEqual(['username', 'payments']);
        expect(typeof authenticate.mock.calls[0][1]).toBe('function'); // onIncompletePaymentFound
    });

    /* ----------------------------------------
       5. accessToken reaches /api/auth/verify
       ---------------------------------------- */
    test('POSTs accessToken to /api/auth/verify', async function () {
        mockPi();
        const calls = [];
        mockFetch(function (url, init) {
            calls.push({ url: url, init: init });
            return jsonResponse(200, { uid: 'uid-test', username: 'pi_user' });
        });

        loadClientScripts();

        await window.loginWithPi();

        const verifyCall = calls.find(function (c) {
            return String(c.url).indexOf('/api/auth/verify') !== -1;
        });
        expect(verifyCall).toBeTruthy();
        expect(verifyCall.init.method).toBe('POST');

        const body = JSON.parse(verifyCall.init.body);
        expect(body.accessToken).toBe('access-token-abc');
    });

    /* ----------------------------------------
       6. UI updates ONLY after server success
       ---------------------------------------- */
    test('updates #user-status only after successful server verification', async function () {
        mockPi();
        mockFetch(function () {
            return jsonResponse(200, { uid: 'uid-test', username: 'pi_user' });
        });

        loadClientScripts();

        await window.loginWithPi();

        const status = document.getElementById('user-status');
        const badge  = document.getElementById('user-badge');

        expect(status.textContent).toBe('@pi_user');
        expect(badge.classList.contains('authenticated')).toBe(true);
    });

    /* ----------------------------------------
       7. Server 401 → UI NOT updated + Arabic error
       ---------------------------------------- */
    test('does NOT update UI when server returns 401', async function () {
        mockPi();
        mockFetch(function () {
            return jsonResponse(401, { message: 'invalid' });
        });

        loadClientScripts();

        await window.loginWithPi();

        const status = document.getElementById('user-status');
        const err    = document.getElementById('auth-error');

        expect(status.textContent).toBe('زائر');
        expect(err.classList.contains('hidden')).toBe(false);
        expect(err.textContent.length).toBeGreaterThan(0);
        expect(err.textContent).toMatch(/جلسة|تسجيل|صلاحية|خادم/);
    });

    /* ----------------------------------------
       8. Cancel path shows controlled Arabic message
       ---------------------------------------- */
    test('shows Arabic message when user cancels Pi auth', async function () {
        mockPi({
            authenticate: function () {
                return Promise.reject(new Error('User cancelled'));
            }
        });
        mockFetch(function () { return jsonResponse(500, {}); });

        loadClientScripts();

        await window.loginWithPi();

        const err = document.getElementById('auth-error');
        expect(err.classList.contains('hidden')).toBe(false);
        expect(err.textContent).toMatch(/إلغاء/);
    });

    /* ----------------------------------------
       9. Duplicate click → single authenticate
       ---------------------------------------- */
    test('prevents duplicate authenticate calls on rapid clicks', async function () {
        const { authenticate } = mockPi({
            authenticate: function () {
                return new Promise(function (resolve) {
                    setTimeout(function () {
                        resolve({
                            user: { uid: 'u1', username: 'u' },
                            accessToken: 'tok'
                        });
                    }, 100);
                });
            }
        });
        mockFetch(function () {
            return jsonResponse(200, { uid: 'u1', username: 'u' });
        });

        loadClientScripts();

        const p1 = window.loginWithPi();
        const p2 = window.loginWithPi(); // should be ignored
        const p3 = window.loginWithPi(); // should be ignored

        jest.advanceTimersByTime(200);

        await Promise.all([p1, p2, p3]);

        expect(authenticate).toHaveBeenCalledTimes(1);
    });

    /* ----------------------------------------
       10. Missing window.Pi → clear Arabic error
       ---------------------------------------- */
    test('shows Arabic error when Pi SDK is missing', async function () {
        // Do NOT mock Pi
        delete window.Pi;

        // Load config (which will set __GAV_PI_ERROR__)
        const configCode = fs.readFileSync(PI_CONFIG_PATH, 'utf8');
        const authCode   = fs.readFileSync(PI_AUTH_PATH, 'utf8');

        delete window.__GAV_PI_CONFIG_LOADED__;
        delete window.__GAV_PI_AUTH_LOADED__;
        delete window.__GAV_PI_READY__;
        delete window.GavAuth;
        delete window.loginWithPi;

        // eslint-disable-next-line no-new-func
        new Function(configCode).call(window);
        // eslint-disable-next-line no-new-func
        new Function(authCode).call(window);

        await window.loginWithPi();

        const err = document.getElementById('auth-error');
        expect(err.classList.contains('hidden')).toBe(false);
        expect(err.textContent).toMatch(/Pi SDK|Pi Browser|غير جاهز/);
    });

    /* ----------------------------------------
       11. logout resets UI
       ---------------------------------------- */
    test('logout resets user-status to زائر', async function () {
        mockPi();
        mockFetch(function () {
            return jsonResponse(200, { uid: 'uid-test', username: 'pi_user' });
        });

        loadClientScripts();

        await window.loginWithPi();
        expect(document.getElementById('user-status').textContent).toBe('@pi_user');

        window.GavAuth.logout();
        expect(document.getElementById('user-status').textContent).toBe('زائر');
    });

    /* ----------------------------------------
       12. GavAuth exposes public API
       ---------------------------------------- */
    test('exposes GavAuth public API', function () {
        mockPi();
        loadClientScripts();

        expect(window.GavAuth).toBeDefined();
        expect(typeof window.GavAuth.login).toBe('function');
        expect(typeof window.GavAuth.logout).toBe('function');
        expect(typeof window.GavAuth.getSession).toBe('function');
        expect(typeof window.GavAuth.isAuthenticated).toBe('function');
    });

});