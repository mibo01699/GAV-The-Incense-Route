/* ============================================================
   GAV – The Incense Route
   Tests: api/v1/index.js — Payments endpoints
   Path:  tests/api/payments.test.js

   COVERAGE:
     1. Missing session (no Authorization)  → 401
     2. Invalid access token                → 401
     3. currency !== 'PI'                   → 400
     4. amount <= 0                         → 400
     5. Missing required fields             → 400
     6. Valid create → returns paymentId
     7. Approve calls Pi /v2/payments/:id/approve server-side
     8. Complete calls Pi /v2/payments/:id/complete with txid
     9. Client-supplied uid is IGNORED
    10. Client NEVER gets PI_API_KEY in any response

   RUN:
     npx jest tests/api/payments.test.js
   ============================================================ */

'use strict';

/* --------------------------------------------
   Test environment
   -------------------------------------------- */
process.env.PI_API_KEY = 'test-key-payments';
process.env.NODE_ENV   = 'test';

const handler = require('../../api/v1/index');

/* --------------------------------------------
   Mock helpers
   -------------------------------------------- */
function makeReqRes(opts) {
    opts = opts || {};

    const req = {
        method:  opts.method  || 'POST',
        url:     opts.url     || '/api/v1/payments',
        headers: opts.headers || {},
        body:    opts.body    || {},
        query:   opts.query   || {}
    };

    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
        getHeader: function (k) { return this.headers[k.toLowerCase()]; },
        end: function (data) { this.body = data; this._done = true; },
        status: function (code) { this.statusCode = code; return this; },
        json: function (data) {
            this.body = JSON.stringify(data);
            this._done = true;
            return this;
        }
    };

    return { req, res };
}

function parseBody(res) {
    if (res.body === undefined) return null;
    try { return JSON.parse(res.body); }
    catch (_) { return null; }
}

/* --------------------------------------------
   Pi API fetch mock
   -------------------------------------------- */
function mockPiApi(handlers) {
    // handlers = { me: fn, createPayment: fn, approve: fn, complete: fn }
    global.fetch = jest.fn(function (url, init) {
        const urlStr = String(url);

        // /v2/me
        if (urlStr.indexOf('/v2/me') !== -1) {
            return Promise.resolve(handlers.me ? handlers.me(init) : {
                ok: true, status: 200,
                json: async () => ({ uid: 'pi-uid-999', username: 'pay_tester' })
            });
        }

        // POST /v2/payments  (create)
        if (/\/v2\/payments$/.test(urlStr) && (!init || init.method === 'POST')) {
            return Promise.resolve(handlers.createPayment
                ? handlers.createPayment(init)
                : {
                    ok: true, status: 200,
                    json: async () => ({
                        identifier: 'pay_abc_123',
                        amount: 5,
                        memo: 'GAV/pos',
                        metadata: {},
                        status: 'created'
                    })
                });
        }

        // POST /v2/payments/:id/approve
        if (/\/v2\/payments\/[^/]+\/approve$/.test(urlStr)) {
            return Promise.resolve(handlers.approve
                ? handlers.approve(init)
                : { ok: true, status: 200, json: async () => ({ approved: true }) });
        }

        // POST /v2/payments/:id/complete
        if (/\/v2\/payments\/[^/]+\/complete$/.test(urlStr)) {
            return Promise.resolve(handlers.complete
                ? handlers.complete(init)
                : { ok: true, status: 200, json: async () => ({ completed: true }) });
        }

        return Promise.resolve({
            ok: false, status: 404,
            json: async () => ({ error: 'not_mocked', url: urlStr })
        });
    });
}

/* --------------------------------------------
   Constants for tests
   -------------------------------------------- */
const AUTH_HEADER = { authorization: 'Bearer valid-token-xyz' };

/* ============================================
   Tests
   ============================================ */

describe('POST /api/v1/payments — creation', function () {

    beforeEach(function () { mockPiApi({}); });

    /* ----------------------------------------
       1. Missing Authorization → 401
       ---------------------------------------- */
    test('rejects request without Authorization header', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: {},
            body: { amount: 5, memo: 'test', metadata: {} }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(401);
    });

    /* ----------------------------------------
       2. Invalid token → 401
       ---------------------------------------- */
    test('rejects request when Pi /v2/me rejects the token', async function () {
        mockPiApi({
            me: function () {
                return {
                    ok: false, status: 401,
                    json: async () => ({ error: 'invalid_token' })
                };
            }
        });

        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: { authorization: 'Bearer expired-token' },
            body: { amount: 5, memo: 'test', metadata: {} }
        });

        await handler(req, res);

        expect([401, 502]).toContain(res.statusCode);
    });

    /* ----------------------------------------
       3. currency !== 'PI' → 400
       ---------------------------------------- */
    test('rejects non-PI currency', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: {
                amount: 5,
                memo: 'test',
                currency: 'USD',   // forbidden
                metadata: {}
            }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
        const payload = parseBody(res);
        if (payload) {
            expect(payload.ok).toBe(false);
        }
    });

    /* ----------------------------------------
       4. amount <= 0 → 400
       ---------------------------------------- */
    test('rejects zero amount', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: { amount: 0, memo: 'test', metadata: {} }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
    });

    test('rejects negative amount', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: { amount: -1, memo: 'test', metadata: {} }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
    });

    /* ----------------------------------------
       5. Missing body → 400
       ---------------------------------------- */
    test('rejects empty body', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: {}
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
    });

    /* ----------------------------------------
       6. Valid create → returns paymentId
       ---------------------------------------- */
    test('creates payment and returns identifier', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: {
                amount: 5,
                memo: 'GAV/pos — 5 π',
                metadata: { source: 'pos', currency: 'PI' }
            }
        });

        await handler(req, res);

        // Should be success (200/201) — implementation may vary
        expect([200, 201]).toContain(res.statusCode);

        const payload = parseBody(res);
        expect(payload).toBeTruthy();

        // At least one of these fields should carry the Pi paymentId
        const id = payload.paymentId || payload.identifier ||
                   (payload.data && (payload.data.paymentId || payload.data.identifier));
        expect(id).toBeTruthy();
    });

    /* ----------------------------------------
       7. Response must NOT contain PI_API_KEY
       ---------------------------------------- */
    test('never leaks PI_API_KEY in the response body', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: {
                amount: 5,
                memo: 'GAV/pos — 5 π',
                metadata: { source: 'pos', currency: 'PI' }
            }
        });

        await handler(req, res);

        const raw = String(res.body || '');
        expect(raw).not.toMatch(/test-key-payments/);
        expect(raw.toLowerCase()).not.toMatch(/pi_api_key/);
    });

    /* ----------------------------------------
       8. Client-supplied uid is ignored
       ---------------------------------------- */
    test('ignores client-supplied uid in body', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: {
                amount: 5,
                memo: 'GAV/pos — 5 π',
                metadata: { source: 'pos', currency: 'PI' },
                uid: 'CLIENT_FORGED_UID',       // must be ignored
                username: 'CLIENT_FORGED_NAME'  // must be ignored
            }
        });

        await handler(req, res);

        // Regardless of status, the echoed response must not carry forged identity.
        const raw = String(res.body || '');
        expect(raw).not.toContain('CLIENT_FORGED_UID');
        expect(raw).not.toContain('CLIENT_FORGED_NAME');
    });

});

/* ============================================
   Approve + Complete
   ============================================ */

describe('POST /api/v1/payments/:id/approve', function () {

    beforeEach(function () { mockPiApi({}); });

    test('requires Authorization', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments/pay_abc_123/approve',
            headers: {},
            body: {},
            query: {}
        });

        await handler(req, res);

        expect(res.statusCode).toBe(401);
    });

    test('rejects when payment id is missing', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments//approve',
            headers: AUTH_HEADER,
            body: {},
            query: {}
        });

        await handler(req, res);

        // Endpoint should not accept empty id (400/404/405 all acceptable as "controlled")
        expect([400, 404, 405]).toContain(res.statusCode);
    });

    test('server calls Pi approve endpoint (not client)', async function () {
        let approveCalled = false;

        mockPiApi({
            approve: function (init) {
                approveCalled = true;
                expect(init.method).toBe('POST');
                expect(init.headers.Authorization).toMatch(/^Bearer /);
                return {
                    ok: true, status: 200,
                    json: async () => ({ approved: true })
                };
            }
        });

        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments/pay_abc_123/approve',
            headers: AUTH_HEADER,
            body: {},
            query: {}
        });

        await handler(req, res);

        expect(approveCalled).toBe(true);
        expect([200, 201, 204]).toContain(res.statusCode);
    });

});

describe('POST /api/v1/payments/:id/complete', function () {

    beforeEach(function () { mockPiApi({}); });

    test('requires Authorization', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments/pay_abc_123/complete',
            headers: {},
            body: { txid: 'tx_999' },
            query: {}
        });

        await handler(req, res);

        expect(res.statusCode).toBe(401);
    });

    test('rejects missing txid', async function () {
        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments/pay_abc_123/complete',
            headers: AUTH_HEADER,
            body: {},
            query: {}
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
    });

    test('server calls Pi complete endpoint with txid', async function () {
        let completeCalled = false;

        mockPiApi({
            complete: function (init) {
                completeCalled = true;
                expect(init.method).toBe('POST');
                const body = JSON.parse(init.body || '{}');
                expect(body.txid).toBe('tx_999');
                return {
                    ok: true, status: 200,
                    json: async () => ({ completed: true })
                };
            }
        });

        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments/pay_abc_123/complete',
            headers: AUTH_HEADER,
            body: { txid: 'tx_999' },
            query: {}
        });

        await handler(req, res);

        expect(completeCalled).toBe(true);
        expect([200, 201, 204]).toContain(res.statusCode);
    });

    test('never echoes txid as a trusted value from client without server call', async function () {
        // Ensure the server actually reaches Pi — not just blindly trusting txid.
        let reachedPi = false;
        mockPiApi({
            complete: function () {
                reachedPi = true;
                return {
                    ok: true, status: 200,
                    json: async () => ({ completed: true })
                };
            }
        });

        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments/pay_abc_123/complete',
            headers: AUTH_HEADER,
            body: { txid: 'tx_from_client' },
            query: {}
        });

        await handler(req, res);

        expect(reachedPi).toBe(true);
    });

});

/* ============================================
   Method + Content-Type gates
   ============================================ */

describe('api/v1 — HTTP method and route gates', function () {

    test('rejects unknown routes with 404', async function () {
        mockPiApi({});

        const { req, res } = makeReqRes({
            method: 'GET',
            url: '/api/v1/nonexistent-route',
            headers: AUTH_HEADER,
            body: {},
            query: {}
        });

        await handler(req, res);

        expect([404, 405]).toContain(res.statusCode);
    });

    test('never leaks PI_API_KEY in any error path', async function () {
        mockPiApi({
            me: function () {
                return {
                    ok: false, status: 500,
                    json: async () => ({ error: 'pi_down' })
                };
            }
        });

        const { req, res } = makeReqRes({
            method: 'POST',
            url: '/api/v1/payments',
            headers: AUTH_HEADER,
            body: { amount: 5, memo: 'test', metadata: {} }
        });

        await handler(req, res);

        const raw = String(res.body || '');
        expect(raw).not.toMatch(/test-key-payments/);
    });

});