/* ============================================================
   GAV – The Incense Route
   File:   api/auth/verify.js
   Role:   Vercel Serverless Function — POST /api/auth/verify

   PURPOSE:
     - Accept { accessToken } from the client.
     - Verify it against Pi Network: GET https://api.minepi.com/v2/me
       using PI_API_KEY (server-side only).
     - Return ONLY the trusted identity: { ok, uid, username }.

   SECURITY:
     - PI_API_KEY is read from process.env on the server.
     - Never echoed back, never logged, never sent to the client.
     - Client-supplied uid/username is IGNORED entirely.

   PI COMPLIANCE:
     - Pi-only. No GCV. No YER. No fiat conversion.
     - Testnet (sandbox) flag returned for client awareness.

   RUNTIME:
     - Node 18+ (native fetch, AbortController).
     - CommonJS export (works with Vercel Node runtime).
   ============================================================ */

'use strict';

/* --------------------------------------------
   Constants
   -------------------------------------------- */
const PI_API_BASE       = 'https://api.minepi.com/v2';
const VERIFY_TIMEOUT_MS = 15000;
const MAX_BODY_BYTES    = 8 * 1024;    // 8 KB is plenty for a token
const SANDBOX_MODE      = true;        // Testnet only — do not flip here.

/* --------------------------------------------
   Helpers
   -------------------------------------------- */
function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(body);
}

/**
 * Read and JSON-parse the request body.
 * Handles:
 *   - Vercel pre-parsed req.body (object)
 *   - Raw stream body (string or Buffer)
 * Rejects oversized bodies and invalid JSON.
 */
function readJsonBody(req) {
    return new Promise(function (resolve, reject) {
        // Case 1: Vercel already parsed it
        if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
            return resolve(req.body);
        }

        // Case 2: body is a string (sometimes Vercel gives us this)
        if (typeof req.body === 'string') {
            try { return resolve(JSON.parse(req.body)); }
            catch (_) { return reject(new Error('INVALID_JSON')); }
        }

        // Case 3: body is a Buffer
        if (Buffer.isBuffer(req.body)) {
            try { return resolve(JSON.parse(req.body.toString('utf8'))); }
            catch (_) { return reject(new Error('INVALID_JSON')); }
        }

        // Case 4: read the stream manually
        let size = 0;
        const chunks = [];
        req.on('data', function (chunk) {
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                reject(new Error('BODY_TOO_LARGE'));
                try { req.destroy(); } catch (_) {}
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', function () {
            const raw = Buffer.concat(chunks).toString('utf8');
            if (!raw) return resolve({});
            try { resolve(JSON.parse(raw)); }
            catch (_) { reject(new Error('INVALID_JSON')); }
        });
        req.on('error', function (err) { reject(err); });
    });
}

/**
 * Call Pi Network GET /v2/me with the given access token.
 * Returns { ok, status, data } — never throws.
 */
async function fetchPiMe(accessToken) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, VERIFY_TIMEOUT_MS);

    try {
        const res = await fetch(PI_API_BASE + '/me', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Accept': 'application/json'
            },
            signal: controller.signal
        });

        clearTimeout(timer);

        let data = null;
        try { data = await res.json(); } catch (_) { /* noop */ }

        return { ok: res.ok, status: res.status, data: data };
    } catch (err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') {
            return { ok: false, status: 0, code: 'TIMEOUT', error: err };
        }
        return { ok: false, status: 0, code: 'NETWORK', error: err };
    }
}

/* --------------------------------------------
   Handler
   -------------------------------------------- */
module.exports = async function handler(req, res) {
    // --- Method gate ---
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, {
            ok: false,
            message: 'Method Not Allowed'
        });
    }

    // --- Server config gate ---
    const apiKey = process.env.PI_API_KEY;
    if (!apiKey || typeof apiKey !== 'string') {
        // Do NOT leak internal details; log server-side only.
        if (console && console.error) {
            console.error('[GAV/auth/verify] PI_API_KEY is not configured.');
        }
        return sendJson(res, 500, {
            ok: false,
            message: 'خادم GAV غير مهيأ للتحقق من Pi.'
        });
    }

    // --- Read body ---
    let body;
    try {
        body = await readJsonBody(req);
    } catch (err) {
        const code = (err && err.message) || '';
        if (code === 'BODY_TOO_LARGE') {
            return sendJson(res, 413, { ok: false, message: 'الطلب كبير جداً.' });
        }
        return sendJson(res, 400, { ok: false, message: 'طلب غير صالح.' });
    }

    // --- Extract token ---
    const accessToken = body && typeof body.accessToken === 'string'
        ? body.accessToken.trim()
        : '';

    if (!accessToken) {
        return sendJson(res, 400, { ok: false, message: 'accessToken مطلوب.' });
    }

    // Basic sanity: tokens are short; refuse absurdly long ones early.
    if (accessToken.length > 4096) {
        return sendJson(res, 400, { ok: false, message: 'accessToken غير صالح.' });
    }

    // --- Verify with Pi Network ---
    const piRes = await fetchPiMe(accessToken);

    if (piRes.code === 'TIMEOUT') {
        return sendJson(res, 504, {
            ok: false,
            message: 'انتهت مهلة Pi API. الرجاء المحاولة لاحقاً.'
        });
    }

    if (piRes.code === 'NETWORK') {
        if (console && console.error) {
            console.error('[GAV/auth/verify] Pi API network error:', piRes.error);
        }
        return sendJson(res, 502, {
            ok: false,
            message: 'تعذّر الاتصال بـ Pi API.'
        });
    }

    // Pi explicitly rejected the token
    if (piRes.status === 401) {
        return sendJson(res, 401, {
            ok: false,
            message: 'رمز Pi غير صالح أو منتهي الصلاحية.'
        });
    }

    // Any other non-2xx from Pi
    if (!piRes.ok) {
        if (console && console.warn) {
            console.warn('[GAV/auth/verify] Pi /v2/me non-OK:',
                piRes.status, piRes.data);
        }
        return sendJson(res, 502, {
            ok: false,
            message: 'فشل التحقق من الحساب على Pi.'
        });
    }

    // --- Extract trusted identity ---
    const uid      = piRes.data && piRes.data.uid
        ? String(piRes.data.uid)
        : '';
    const username = piRes.data && piRes.data.username
        ? String(piRes.data.username)
        : '';

    if (!uid) {
        return sendJson(res, 502, {
            ok: false,
            message: 'استجابة Pi غير مكتملة (uid مفقود).'
        });
    }

    // --- Success ---
    return sendJson(res, 200, {
        ok: true,
        uid: uid,
        username: username,
        sandbox: SANDBOX_MODE
    });
};