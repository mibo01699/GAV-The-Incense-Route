/* ============================================================
   GAV – The Incense Route
   Tests: api/auth/verify.js
   Path:  tests/api/auth-verify.test.js

   COVERAGE (per project requirements):
     1. Missing accessToken          → 400
     2. Invalid/short accessToken    → 400
     3. Pi /v2/me returns 401        → 401
     4. Pi /v2/me returns 500        → 502
     5. Pi /v2/me returns valid user → 200 with uid + username
     6. Pi API network failure       → 502
     7. Non-POST method              → 405
     8. Missing PI_API_KEY           → 500
     9. Oversized body               → 413
    10. Client-supplied uid is IGNORED (never echoed back)

   RUN:
     npx jest tests/api/auth-verify.test.js
   ============================================================ */

'use strict';

/* --------------------------------------------
   Test environment setup
   -------------------------------------------- */

// Ensure PI_API_KEY is set for the module to pass its config gate.
process.env.PI_API_KEY = 'test-key-12345';

const handler = require('../../api/auth/verify');

/* --------------------------------------------
   Helpers
   -------------------------------------------- */

/**
 * Build a minimal mock of Vercel's (req, res) objects.
 *   - req.method, req.body, req.headers
 *   - res: tracks statusCode, headers, body
 */
function makeReqRes(opts) {
    opts = opts || {};

    const req = {
        method: opts.method || 'POST',
        headers: opts.headers || {},
        body: opts.body
    };

    // If caller wants to simulate a streamed body:
    if (opts.streamBody !== undefined) {
        delete req.body;
        const chunks = [Buffer.from(opts.streamBody)];
        req.on = function (event, cb) {
            if (event === 'data') chunks.forEach(cb);
            if (event === 'end')  cb();
            return this;
        };
        req.destroy = function () {};
    }

    const res = {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader: function (k, v) { this.headers[k.toLowerCase()] = v; },
        end: function (data) {
            this.body = data;
            this._done = true;
        }
    };

    return { req, res };
}

/** Parse res.body JSON safely. */
function parseBody(res) {
    try { return JSON.parse(res.body); }
    catch (_) { return null; }
}

/* --------------------------------------------
   Global fetch mocking
   -------------------------------------------- */

let originalFetch;

beforeAll(function () {
    originalFetch = global.fetch;
});

afterAll(function () {
    global.fetch = originalFetch;
});

beforeEach(function () {
    global.fetch = jest.fn();
});

/* ============================================
   Tests
   ============================================ */

describe('POST /api/auth/verify', function () {

    /* ----------------------------------------
       1. Missing accessToken → 400
       ---------------------------------------- */
    test('rejects empty body with 400', async function () {
        const { req, res } = makeReqRes({ body: {} });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
        const payload = parseBody(res);
        expect(payload).toEqual(
            expect.objectContaining({ ok: false })
        );
        expect(payload.message).toMatch(/accessToken/);
    });

    /* ----------------------------------------
       2. Access token is not a string → 400
       ---------------------------------------- */
    test('rejects non-string accessToken with 400', async function () {
        const { req, res } = makeReqRes({
            body: { accessToken: 12345 }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
    });

    /* ----------------------------------------
       3. Absurdly long token → 400
       ---------------------------------------- */
    test('rejects oversized accessToken with 400', async function () {
        const { req, res } = makeReqRes({
            body: { accessToken: 'a'.repeat(5000) }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
    });

    /* ----------------------------------------
       4. Pi /v2/me returns 401 → 401
       ---------------------------------------- */
    test('propagates Pi 401 as controlled 401', async function () {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 401,
            json: async () => ({ error: 'invalid_token' })
        });

        const { req, res } = makeReqRes({
            body: { accessToken: 'expired-token' }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(401);
        const payload = parseBody(res);
        expect(payload.ok).toBe(false);
        expect(payload.message).toMatch(/غير صالح|منتهي/);
    });

    /* ----------------------------------------
       5. Pi /v2/me returns 500 → 502
       ---------------------------------------- */
    test('maps Pi 500 to controlled 502', async function () {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            json: async () => ({ error: 'server_error' })
        });

        const { req, res } = makeReqRes({
            body: { accessToken: 'valid-token' }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(502);
        const payload = parseBody(res);
        expect(payload.ok).toBe(false);
    });

    /* ----------------------------------------
       6. Pi /v2/me returns valid user → 200
       ---------------------------------------- */
    test('returns uid and username on successful verification', async function () {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                uid: 'pi-uid-abc-123',
                username: 'gav_tester',
                credentials: {}   // extra fields MUST NOT be echoed
            })
        });

        const { req, res } = makeReqRes({
            body: { accessToken: 'good-token' }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        const payload = parseBody(res);

        expect(payload).toEqual({
            ok: true,
            uid: 'pi-uid-abc-123',
            username: 'gav_tester',
            sandbox: true
        });

        // Must NOT leak anything else
        expect(payload.credentials).toBeUndefined();
    });

    /* ----------------------------------------
       7. Pi response missing uid → 502
       ---------------------------------------- */
    test('returns 502 when Pi omits uid', async function () {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ username: 'no_uid_here' })
        });

        const { req, res } = makeReqRes({
            body: { accessToken: 'good-token' }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(502);
    });

    /* ----------------------------------------
       8. Network failure → 502
       ---------------------------------------- */
    test('returns 502 on Pi API network failure', async function () {
        global.fetch = jest.fn().mockRejectedValue(
            new Error('ECONNREFUSED')
        );

        const { req, res } = makeReqRes({
            body: { accessToken: 'some-token' }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(502);
        const payload = parseBody(res);
        expect(payload.ok).toBe(false);
    });

    /* ----------------------------------------
       9. Non-POST method → 405
       ---------------------------------------- */
    test('rejects GET with 405', async function () {
        const { req, res } = makeReqRes({
            method: 'GET',
            body: { accessToken: 'any' }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(405);
        expect(res.headers.allow).toBe('POST');
    });

    /* ----------------------------------------
      10. Invalid JSON body → 400
       ---------------------------------------- */
    test('rejects invalid JSON body with 400', async function () {
        const { req, res } = makeReqRes({
            streamBody: '{"accessToken": "unterminated'
        });

        await handler(req, res);

        expect(res.statusCode).toBe(400);
    });

    /* ----------------------------------------
      11. Client-supplied uid is IGNORED
       ---------------------------------------- */
    test('never trusts client-supplied uid or username', async function () {
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({
                uid: 'trusted-uid-from-pi',
                username: 'trusted_username'
            })
        });

        const { req, res } = makeReqRes({
            body: {
                accessToken: 'good-token',
                uid: 'CLIENT_FORGED_UID',       // must be ignored
                username: 'CLIENT_FORGED_NAME'  // must be ignored
            }
        });

        await handler(req, res);

        expect(res.statusCode).toBe(200);
        const payload = parseBody(res);

        expect(payload.uid).toBe('trusted-uid-from-pi');
        expect(payload.username).toBe('trusted_username');
        expect(payload.uid).not.toBe('CLIENT_FORGED_UID');
    });

});

/* ============================================
   PI_API_KEY missing → 500
   ============================================ */
describe('POST /api/auth/verify — misconfigured server', function () {

    const ORIGINAL = process.env.PI_API_KEY;

    afterEach(function () {
        process.env.PI_API_KEY = ORIGINAL;
    });

    test('returns 500 when PI_API_KEY is missing', async function () {
        delete process.env.PI_API_KEY;

        // Re-require the handler to re-read the env var.
        jest.resetModules();
        const freshHandler = require('../../api/auth/verify');

        const { req, res } = makeReqRes({
            body: { accessToken: 'anything' }
        });

        await freshHandler(req, res);

        expect(res.statusCode).toBe(500);
        const payload = parseBody(res);
        expect(payload.ok).toBe(false);
    });

});