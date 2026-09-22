/* ============================================================
   GAV – The Incense Route
   File:   api/index.js
   Role:   Vercel Serverless Function — Unified API Handler

   هذا الملف الوحيد لـ API. يعالج جميع مسارات /api/*

   PART 1/3: Config · Path Normalization · Auth · Products · Pricing · Health
   ============================================================ */

'use strict';

const express = require('express');
const cors = require('cors');

/* ============================================
   CONFIG
   ============================================ */
const PI_API_BASE        = 'https://api.minepi.com/v2';
const PI_API_KEY         = process.env.PI_API_KEY || '';
const PI_VERIFY_TIMEOUT  = 15000;
const PI_ACTION_TIMEOUT  = 20000;
const SANDBOX_MODE       = true;
const MAX_BODY_BYTES     = '256kb';

/* ============================================
   APP + MIDDLEWARE
   ============================================ */
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: MAX_BODY_BYTES }));
app.use(express.urlencoded({ extended: false, limit: MAX_BODY_BYTES }));

/* ============================================
   PATH NORMALIZATION
   Vercel يمرر المسار الكامل (مثل /api/v1/products).
   هذا middleware يزيل البادئات لتعمل المسارات
   بنفس الشكل في كل البيئات.
   ============================================ */
app.use(function (req, res, next) {
    let url = req.url || '/';
    let query = '';
    const qIdx = url.indexOf('?');
    if (qIdx !== -1) {
        query = url.slice(qIdx);
        url = url.slice(0, qIdx);
    }

    if (url === '/api/v1' || url === '/api/v1/') {
        url = '/';
    } else if (url.indexOf('/api/v1/') === 0) {
        url = url.slice('/api/v1'.length);
    } else if (url === '/api' || url === '/api/') {
        url = '/';
    } else if (url.indexOf('/api/') === 0) {
        url = url.slice('/api'.length);
    }

    if (!url) url = '/';
    if (url.charAt(0) !== '/') url = '/' + url;

    req.url = url + query;
    next();
});

// Request ID + security headers
app.use(function (req, res, next) {
    const rid = 'req-' + Date.now().toString(36) + '-' +
                Math.random().toString(36).slice(2, 8);
    req.requestId = rid;
    res.setHeader('X-Request-Id', rid);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

/* ============================================
   RESPONSE HELPERS
   ============================================ */
function ok(res, data, status) {
    return res.status(status || 200).json(data === undefined ? { ok: true } : data);
}

function fail(res, status, message, code) {
    return res.status(status).json({
        ok: false,
        message: message || 'حدث خطأ.',
        code: code || ('HTTP_' + status)
    });
}

/* ============================================
   UTILITIES
   ============================================ */
function isPositiveNumber(n) {
    return typeof n === 'number' && isFinite(n) && n > 0;
}

function toFiniteNumber(v) {
    const n = Number(v);
    return isFinite(n) ? n : NaN;
}

function generateId(prefix) {
    return prefix + '_' +
        Date.now().toString(36) + '_' +
        Math.random().toString(36).slice(2, 10);
}

function nowIso() {
    return new Date().toISOString();
}

async function fetchJson(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(function () { controller.abort(); }, timeoutMs);
    try {
        const res = await fetch(url, Object.assign({}, options, {
            signal: controller.signal
        }));
        let data = null;
        try { data = await res.json(); } catch (_) { /* noop */ }
        return { ok: res.ok, status: res.status, data: data };
    } catch (err) {
        if (err && err.name === 'AbortError') {
            return { ok: false, status: 0, code: 'TIMEOUT' };
        }
        return { ok: false, status: 0, code: 'NETWORK', error: err };
    } finally {
        clearTimeout(timer);
    }
}

/* ============================================
   PI API HELPERS
   ============================================ */
async function verifyPiToken(accessToken) {
    if (!accessToken || typeof accessToken !== 'string') {
        return { ok: false, status: 400, message: 'accessToken مطلوب.' };
    }
    const r = await fetchJson(
        PI_API_BASE + '/me',
        {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Accept': 'application/json'
            }
        },
        PI_VERIFY_TIMEOUT
    );

    if (r.code === 'TIMEOUT') {
        return { ok: false, status: 504, message: 'انتهت مهلة Pi API.' };
    }
    if (r.code === 'NETWORK') {
        return { ok: false, status: 502, message: 'تعذّر الاتصال بـ Pi API.' };
    }
    if (r.status === 401) {
        return { ok: false, status: 401, message: 'رمز Pi غير صالح أو منتهي.' };
    }
    if (!r.ok) {
        return { ok: false, status: 502, message: 'فشل التحقق من الحساب على Pi.' };
    }

    const uid      = r.data && r.data.uid      ? String(r.data.uid)      : '';
    const username = r.data && r.data.username ? String(r.data.username) : '';

    if (!uid) {
        return { ok: false, status: 502, message: 'استجابة Pi غير مكتملة.' };
    }
    return { ok: true, status: 200, uid: uid, username: username };
}

async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization || req.headers.Authorization || '';
        const match = /^Bearer\s+(.+)$/i.exec(String(header));
        const token = match ? match[1].trim() : '';

        if (!token) {
            return fail(res, 401, 'يجب تسجيل الدخول أولاً.', 'NO_TOKEN');
        }
        if (token.length > 4096) {
            return fail(res, 401, 'رمز غير صالح.', 'BAD_TOKEN');
        }
        if (!PI_API_KEY) {
            return fail(res, 500, 'خادم GAV غير مهيأ.', 'NO_API_KEY');
        }

        const v = await verifyPiToken(token);
        if (!v.ok) {
            return fail(res, v.status || 401, v.message || 'فشل التحقق.',
                'AUTH_FAILED');
        }

        req.piUser = {
            uid: v.uid,
            username: v.username,
            accessToken: token
        };
        return next();
    } catch (err) {
        console.error('[GAV/api] requireAuth error:', err);
        return fail(res, 500, 'خطأ داخلي في التحقق.', 'AUTH_ERROR');
    }
}

/* ============================================
   IN-MEMORY STORES
   ============================================ */
const DB = {
    products:  new Map(),
    festivals: new Map(),
    orders:    new Map(),
    invoices:  new Map(),
    payments:  new Map(),
    audit:     []
};

function auditLog(uid, action, target, meta) {
    DB.audit.push({
        id: generateId('aud'),
        uid: uid || 'anonymous',
        action: action,
        target: target || null,
        at: nowIso(),
        meta: meta || null
    });
    if (DB.audit.length > 1000) DB.audit.shift();
}

/* ============================================
   ROUTE: GET /health
   يعمل على /api/health و /api/v1/health
   ============================================ */
app.get('/health', function (req, res) {
    return res.status(200).json({
        ok: true,
        status: 'UP',
        service: 'GAV-The-Incense-Route',
        environment: 'testnet',
        timestamp: nowIso()
    });
});

/* ============================================
   ROUTE: POST /auth/verify
   يعمل على /api/auth/verify و /api/v1/auth/verify
   ============================================ */
app.post('/auth/verify', async function (req, res) {
    const accessToken = req.body && typeof req.body.accessToken === 'string'
        ? req.body.accessToken.trim()
        : '';

    if (!accessToken) return fail(res, 400, 'accessToken مطلوب.');
    if (accessToken.length > 4096) return fail(res, 400, 'accessToken غير صالح.');
    if (!PI_API_KEY) return fail(res, 500, 'خادم GAV غير مهيأ للتحقق من Pi.');

    const v = await verifyPiToken(accessToken);
    if (!v.ok) return fail(res, v.status || 401, v.message);

    auditLog(v.uid, 'auth.verify', v.uid, { username: v.username });

    return ok(res, {
        ok: true,
        uid: v.uid,
        username: v.username,
        sandbox: SANDBOX_MODE
    });
});

/* ============================================
   ROUTE: GET /pricing/reference
   ============================================ */
app.get('/pricing/reference', function (req, res) {
    const rows = [];
    const byName = new Map();

    for (const p of DB.products.values()) {
        if (p.active === false) continue;
        const key = p.name || 'غير مسمى';
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(Number(p.price) || 0);
    }

    byName.forEach(function (prices, name) {
        const avg = prices.reduce(function (a, b) { return a + b; }, 0) / prices.length;
        rows.push({
            name: name,
            referencePi: Number(avg.toFixed(4)),
            changePercent: 0,
            updatedAt: nowIso()
        });
    });

    return ok(res, {
        ok: true,
        index: rows,
        updatedAt: nowIso(),
        disclaimer: 'Internal GAV reference only. NOT GCV. NOT a global price.'
    });
});

/* ============================================
   ROUTE: GET /products
   ============================================ */
app.get('/products', function (req, res) {
    const q = (req.query.search || req.query.q || '').toString().trim().toLowerCase();

    let items = Array.from(DB.products.values())
        .filter(function (p) { return p.active !== false; });

    if (q) {
        items = items.filter(function (p) {
            return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
                   (p.description || '').toLowerCase().indexOf(q) !== -1;
        });
    }

    items.sort(function (a, b) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
    });

    return ok(res, { ok: true, products: items });
});

/* ============================================
   ROUTE: GET /products/:id
   ============================================ */
app.get('/products/:id', function (req, res) {
    const p = DB.products.get(req.params.id);
    if (!p) return fail(res, 404, 'المنتج غير موجود.');
    return ok(res, { ok: true, product: p });
});

/* ============================================
   ROUTE: POST /products
   ============================================ */
app.post('/products', requireAuth, function (req, res) {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const price = toFiniteNumber(body.price);
    const stock = Number.isInteger(body.stock) ? body.stock
                : parseInt(body.stock, 10);
    const description = String(body.description || '').trim();

    if (!name || name.length < 2) {
        return fail(res, 400, 'اسم المنتج مطلوب (حرفان على الأقل).');
    }
    if (!isFinite(price) || price < 0) {
        return fail(res, 400, 'السعر يجب أن يكون رقماً غير سالب.');
    }
    if (!isFinite(stock) || stock < 0) {
        return fail(res, 400, 'المخزون يجب أن يكون رقماً صحيحاً غير سالب.');
    }

    const product = {
        id: generateId('prd'),
        name: name,
        price: price,
        stock: stock,
        description: description,
        merchantUid: req.piUser.uid,
        merchantName: req.piUser.username,
        active: true,
        createdAt: nowIso()
    };

    DB.products.set(product.id, product);
    auditLog(req.piUser.uid, 'product.create', product.id, { name: name, price: price });

    return ok(res, { ok: true, product: product }, 201);
});

/* ============================================
   ROUTE: PUT /products/:id
   ============================================ */
app.put('/products/:id', requireAuth, function (req, res) {
    const p = DB.products.get(req.params.id);
    if (!p) return fail(res, 404, 'المنتج غير موجود.');
    if (p.merchantUid !== req.piUser.uid) {
        return fail(res, 403, 'ليس لديك صلاحية تعديل هذا المنتج.');
    }

    const body = req.body || {};
    const updates = {};

    if (body.name !== undefined) {
        const n = String(body.name).trim();
        if (n.length < 2) return fail(res, 400, 'اسم المنتج قصير جداً.');
        updates.name = n;
    }
    if (body.price !== undefined) {
        const pr = toFiniteNumber(body.price);
        if (!isFinite(pr) || pr < 0) return fail(res, 400, 'السعر غير صالح.');
        updates.price = pr;
    }
    if (body.stock !== undefined) {
        const s = parseInt(body.stock, 10);
        if (!isFinite(s) || s < 0) return fail(res, 400, 'المخزون غير صالح.');
        updates.stock = s;
    }
    if (body.description !== undefined) {
        updates.description = String(body.description).trim();
    }
    if (body.active !== undefined) {
        updates.active = body.active === true;
    }

    const updated = Object.assign({}, p, updates, { updatedAt: nowIso() });
    DB.products.set(p.id, updated);
    auditLog(req.piUser.uid, 'product.update', p.id, updates);

    return ok(res, { ok: true, product: updated });
});

/* ============================================
   ROUTE: DELETE /products/:id
   ============================================ */
app.delete('/products/:id', requireAuth, function (req, res) {
    const p = DB.products.get(req.params.id);
    if (!p) return fail(res, 404, 'المنتج غير موجود.');
    if (p.merchantUid !== req.piUser.uid) {
        return fail(res, 403, 'ليس لديك صلاحية حذف هذا المنتج.');
    }
    DB.products.delete(p.id);
    auditLog(req.piUser.uid, 'product.delete', p.id);
    return ok(res, { ok: true, deleted: p.id });
});