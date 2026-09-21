/* ============================================================
   GAV – The Incense Route
   File:   index.js (root)
   Role:   Local development server + Vercel fallback router.

   PURPOSE:
     - Serve /public as static assets for `npm start`.
     - Route /api/* to the shared handler in api/v1/index.js.
     - Provide POST /api/auth/verify as a compatible endpoint
       for BIGISH-YER integrations (server-side only).
     - Never expose PI_API_KEY to the client.

   RUNTIME:
     - Pure Node.js (no Express, no external deps).
     - CommonJS (works with `"type": "commonjs"` or absent).
     - Safe on Node >= 18.

   PI COMPLIANCE:
     - Pi-only. No GCV. No YER. No fiat conversion.
     - Server-side token verification via Pi API /v2/me.
     - Client is NEVER trusted for identity or amount.
   ============================================================ */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');
const url  = require('url');

/* --------------------------------------------
   Config
   -------------------------------------------- */
const PORT         = parseInt(process.env.PORT, 10) || 3000;
const NODE_ENV     = process.env.NODE_ENV || 'development';
const PUBLIC_DIR   = path.join(__dirname, 'public');
const PI_API_BASE  = 'https://api.minepi.com/v2';
const PI_API_KEY   = process.env.PI_API_KEY || '';
const VERIFY_TIMEOUT_MS = 15000;

/* --------------------------------------------
   MIME types
   -------------------------------------------- */
const MIME = Object.freeze({
    '.html': 'text/html; charset=utf-8',
    '.htm':  'text/html; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.mjs':  'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.webp': 'image/webp',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2':'font/woff2',
    '.ttf':  'font/ttf',
    '.txt':  'text/plain; charset=utf-8',
    '.map':  'application/json; charset=utf-8'
});

/* --------------------------------------------
   Small helpers
   -------------------------------------------- */
function log(level, msg, data) {
    const tag = '[GAV/server]';
    if (data !== undefined) console[level](tag, msg, data);
    else                    console[level](tag, msg);
}

function sendJson(res, status, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
    });
    res.end(body);
}

function sendText(res, status, text) {
    const body = String(text || '');
    res.writeHead(status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store'
    });
    res.end(body);
}

function readBody(req, maxBytes) {
    maxBytes = maxBytes || 256 * 1024; // 256 KB default
    return new Promise(function (resolve, reject) {
        let size = 0;
        const chunks = [];
        req.on('data', function (chunk) {
            size += chunk.length;
            if (size > maxBytes) {
                reject(new Error('BODY_TOO_LARGE'));
                try { req.destroy(); } catch (_) {}
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', function () {
            try {
                const raw = Buffer.concat(chunks).toString('utf8');
                if (!raw) return resolve(null);
                resolve(JSON.parse(raw));
            } catch (e) {
                reject(new Error('INVALID_JSON'));
            }
        });
        req.on('error', reject);
    });
}

function safePathFromUrl(urlPath) {
    // Prevent path traversal
    const decoded = decodeURIComponent(urlPath.split('?')[0]);
    const normalized = path.normalize(decoded).replace(/^(\.\.[\/\\])+/, '');
    const full = path.join(PUBLIC_DIR, normalized);
    if (!full.startsWith(PUBLIC_DIR)) return null;
    return full;
}

/* --------------------------------------------
   /api/auth/verify — server-side Pi identity verification
   -------------------------------------------- */
async function handleAuthVerify(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return sendJson(res, 405, { ok: false, message: 'Method Not Allowed' });
    }

    if (!PI_API_KEY) {
        log('error', 'PI_API_KEY is not configured on the server.');
        return sendJson(res, 500, {
            ok: false,
            message: 'خادم GAV غير مهيأ للتحقق من Pi.'
        });
    }

    let body;
    try {
        body = await readBody(req, 8 * 1024);
    } catch (e) {
        const code = (e && e.message) || '';
        if (code === 'BODY_TOO_LARGE') {
            return sendJson(res, 413, { ok: false, message: 'الطلب كبير جداً.' });
        }
        return sendJson(res, 400, { ok: false, message: 'طلب غير صالح.' });
    }

    const accessToken = body && body.accessToken ? String(body.accessToken) : '';
    if (!accessToken) {
        return sendJson(res, 400, { ok: false, message: 'accessToken مطلوب.' });
    }

    // Call Pi API /v2/me
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, VERIFY_TIMEOUT_MS);

    let piRes;
    try {
        piRes = await fetch(PI_API_BASE + '/me', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Accept': 'application/json'
            },
            signal: controller.signal
        });
    } catch (err) {
        clearTimeout(timer);
        if (err && err.name === 'AbortError') {
            return sendJson(res, 504, { ok: false, message: 'انتهت مهلة Pi API.' });
        }
        log('error', 'Pi /v2/me request failed:', err);
        return sendJson(res, 502, { ok: false, message: 'تعذّر الاتصال بـ Pi API.' });
    }
    clearTimeout(timer);

    let piData = null;
    try { piData = await piRes.json(); } catch (_) { /* noop */ }

    if (piRes.status === 401) {
        return sendJson(res, 401, { ok: false, message: 'رمز Pi غير صالح أو منتهي.' });
    }
    if (!piRes.ok) {
        log('warn', 'Pi /v2/me returned ' + piRes.status, piData);
        return sendJson(res, 502, { ok: false, message: 'فشل التحقق من Pi.' });
    }

    const uid = piData && piData.uid ? String(piData.uid) : '';
    const username = piData && piData.username ? String(piData.username) : '';

    if (!uid) {
        return sendJson(res, 502, { ok: false, message: 'استجابة Pi غير مكتملة.' });
    }

    // Return only the trusted identity fields
    return sendJson(res, 200, {
        ok: true,
        uid: uid,
        username: username,
        sandbox: true
    });
}

/* --------------------------------------------
   /api/* → delegate to api/v1/index.js
   -------------------------------------------- */
async function delegateToApiV1(req, res, parsedUrl) {
    const handlerPath = path.join(__dirname, 'api', 'v1', 'index.js');

    if (!fs.existsSync(handlerPath)) {
        log('warn', 'api/v1/index.js not found; returning 503 for ' + parsedUrl.pathname);
        return sendJson(res, 503, { ok: false, message: 'واجهة API غير جاهزة.' });
    }

    let handler;
    try {
        const mod = require(handlerPath);
        handler = (typeof mod === 'function')
            ? mod
            : (mod && typeof mod.default === 'function' ? mod.default : null);
    } catch (err) {
        log('error', 'Failed to load api/v1/index.js:', err);
        return sendJson(res, 500, { ok: false, message: 'خطأ داخلي في الخادم.' });
    }

    if (!handler) {
        log('error', 'api/v1/index.js does not export a default function.');
        return sendJson(res, 500, { ok: false, message: 'معالج API غير صالح.' });
    }

    // Vercel-style handler signature: (req, res)
    // Provide a minimal `req.query` for compatibility.
    req.query = Object.fromEntries(parsedUrl.searchParams.entries());

    try {
        await handler(req, res);
    } catch (err) {
        log('error', 'Handler threw:', err);
        if (!res.headersSent) {
            sendJson(res, 500, { ok: false, message: 'خطأ داخلي في المعالج.' });
        }
    }
}

/* --------------------------------------------
   Static file serving
   -------------------------------------------- */
function serveStatic(req, res, parsedUrl) {
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/' || pathname === '') pathname = '/index.html';

    const filePath = safePathFromUrl(pathname);
    if (!filePath) {
        return sendText(res, 400, 'Bad Request');
    }

    fs.stat(filePath, function (err, stat) {
        if (err || !stat.isFile()) {
            // SPA fallback → index.html for non-API routes
            const fallback = path.join(PUBLIC_DIR, 'index.html');
            fs.readFile(fallback, function (e2, data) {
                if (e2) return sendText(res, 404, 'Not Found');
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Content-Length': data.length,
                    'Cache-Control': 'no-cache'
                });
                res.end(data);
            });
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const type = MIME[ext] || 'application/octet-stream';

        const isHtml = (ext === '.html' || ext === '.htm');
        const isAsset = !isHtml;

        res.writeHead(200, {
            'Content-Type': type,
            'Content-Length': stat.size,
            'Cache-Control': isAsset ? 'public, max-age=3600' : 'no-cache',
            'X-Content-Type-Options': 'nosniff'
        });

        const stream = fs.createReadStream(filePath);
        stream.on('error', function (streamErr) {
            log('error', 'Static stream error:', streamErr);
            if (!res.headersSent) sendText(res, 500, 'Internal Error');
            else try { res.end(); } catch (_) {}
        });
        stream.pipe(res);
    });
}

/* --------------------------------------------
   Main request router
   -------------------------------------------- */
function onRequest(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname || '/';

    // Security headers (baseline)
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Auth verify — dedicated route
    if (pathname === '/api/auth/verify') {
        return handleAuthVerify(req, res);
    }

    // All other /api/* → delegate
    if (pathname.indexOf('/api/') === 0) {
        return delegateToApiV1(req, res, parsedUrl);
    }

    // Static
    return serveStatic(req, res, parsedUrl);
}

/* --------------------------------------------
   Server lifecycle
   -------------------------------------------- */
function createServer() {
    const server = http.createServer(onRequest);

    server.on('clientError', function (err, socket) {
        log('warn', 'clientError:', err && err.message);
        try { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); } catch (_) {}
    });

    return server;
}

function start() {
    const server = createServer();

    server.listen(PORT, function () {
        log('info', 'GAV dev server running on http://localhost:' + PORT);
        log('info', 'Environment: ' + NODE_ENV);
        log('info', 'Static dir: ' + PUBLIC_DIR);
        log('info', 'PI_API_KEY configured: ' + (PI_API_KEY ? 'yes' : 'NO (verify will 500)'));
        log('info', 'Pi testnet only — sandbox mode is enforced client-side.');
    });

    const shutdown = function (signal) {
        log('info', 'Received ' + signal + '. Shutting down...');
        server.close(function () {
            log('info', 'Server closed.');
            process.exit(0);
        });
        setTimeout(function () { process.exit(1); }, 5000).unref();
    };

    process.on('SIGINT',  function () { shutdown('SIGINT'); });
    process.on('SIGTERM', function () { shutdown('SIGTERM'); });

    return server;
}

/* --------------------------------------------
   Export for tests + auto-start when run directly
   -------------------------------------------- */
module.exports = { createServer, start, handleAuthVerify };

if (require.main === module) {
    start();
}