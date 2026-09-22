/* ============================================================
   GAV – The Incense Route
   File:   api/v1/index.js
   Role:   Vercel Serverless Function — Main API

   PART 1/3: Config · Middleware · Auth · Products · Pricing
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
const SANDBOX_MODE       = true;   // Testnet only — do NOT flip here.
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

// Request ID + basic headers
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
   PI API HELPERS (server-side only)
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
        console.error('[GAV/v1] requireAuth error:', err);
        return fail(res, 500, 'خطأ داخلي في التحقق.', 'AUTH_ERROR');
    }
}

/* ============================================
   IN-MEMORY STORES
   TODO: Replace with real DB before Mainnet.
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
   ROUTE: POST /auth/verify
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
   Internal reference index. NOT GCV. Pi-only.
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
   ROUTE: POST /products   (merchant only)
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
   ROUTE: PUT /products/:id   (owner only)
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
   ROUTE: DELETE /products/:id   (owner only)
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

/* ============================================
   ROUTE: GET /merchants/me
   ============================================ */
app.get('/merchants/me', requireAuth, function (req, res) {
    const mine = Array.from(DB.products.values())
        .filter(function (p) { return p.merchantUid === req.piUser.uid; });

    const activeCount = mine.filter(function (p) { return p.active !== false; }).length;

    const myOrders = Array.from(DB.orders.values())
        .filter(function (o) { return o.sellerUid === req.piUser.uid; });

    const pendingOrders = myOrders.filter(function (o) {
        return o.status === 'pending' || o.status === 'paid';
    }).length;

    const salesTotal = myOrders
        .filter(function (o) { return o.status === 'completed'; })
        .reduce(function (sum, o) { return sum + (Number(o.totalPi) || 0); }, 0);

    return ok(res, {
        ok: true,
        products: mine,
        activeProducts: activeCount,
        pendingOrders: pendingOrders,
        salesTotal: Number(salesTotal.toFixed(4))
    });
});

/* ============================================
   ROUTE: POST /pos/invoice
   Body: { items: [{ productId, quantity }] }
   ============================================ */
app.post('/pos/invoice', requireAuth, function (req, res) {
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];

    if (!items.length) return fail(res, 400, 'السلة فارغة.');

    const normalized = [];
    let totalPi = 0;

    for (let i = 0; i < items.length; i++) {
        const it = items[i] || {};
        const pid = String(it.productId || it.id || '').trim();
        const qty = parseInt(it.quantity != null ? it.quantity : it.qty, 10);

        if (!pid || !isFinite(qty) || qty <= 0) {
            return fail(res, 400, 'عنصر سلة غير صالح.');
        }

        const p = DB.products.get(pid);
        if (!p) return fail(res, 404, 'أحد المنتجات غير موجود.');
        if (p.active === false) return fail(res, 400, 'منتج غير نشط.');
        if (typeof p.stock === 'number' && p.stock < qty) {
            return fail(res, 400, 'المخزون غير كافٍ للمنتج: ' + p.name);
        }

        const lineTotal = Number(p.price) * qty;
        totalPi += lineTotal;

        normalized.push({
            productId: p.id,
            name: p.name,
            price: Number(p.price),
            quantity: qty,
            lineTotal: Number(lineTotal.toFixed(4)),
            merchantUid: p.merchantUid
        });
    }

    const orderId = generateId('ord');
    const invoiceId = generateId('inv');

    const order = {
        id: orderId,
        buyerUid: req.piUser.uid,
        buyerName: req.piUser.username,
        sellerUid: normalized[0].merchantUid,
        items: normalized,
        totalPi: Number(totalPi.toFixed(4)),
        currency: 'PI',
        status: 'pending',
        invoiceId: invoiceId,
        createdAt: nowIso()
    };
    DB.orders.set(orderId, order);

    const invoice = {
        id: invoiceId,
        orderId: orderId,
        buyerUid: req.piUser.uid,
        totalPi: order.totalPi,
        currency: 'PI',
        status: 'unpaid',
        createdAt: nowIso()
    };
    DB.invoices.set(invoiceId, invoice);

    auditLog(req.piUser.uid, 'pos.invoice.create', orderId, {
        totalPi: order.totalPi,
        items: normalized.length
    });

    return ok(res, {
        ok: true,
        order: order,
        invoice: invoice,
        totalPi: order.totalPi,
        currency: 'PI'
    }, 201);
});

/* ============================================
   ROUTE: GET /orders
   ============================================ */
app.get('/orders', requireAuth, function (req, res) {
    const mine = Array.from(DB.orders.values())
        .filter(function (o) {
            return o.buyerUid === req.piUser.uid ||
                   o.sellerUid === req.piUser.uid;
        })
        .sort(function (a, b) {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        });

    return ok(res, { ok: true, orders: mine });
});

/* ============================================
   ROUTE: GET /orders/:id
   ============================================ */
app.get('/orders/:id', requireAuth, function (req, res) {
    const o = DB.orders.get(req.params.id);
    if (!o) return fail(res, 404, 'الطلب غير موجود.');
    if (o.buyerUid !== req.piUser.uid && o.sellerUid !== req.piUser.uid) {
        return fail(res, 403, 'ليس لديك صلاحية عرض هذا الطلب.');
    }
    return ok(res, { ok: true, order: o });
});

/* ============================================
   ROUTE: GET /invoices
   ============================================ */
app.get('/invoices', requireAuth, function (req, res) {
    const mine = Array.from(DB.invoices.values())
        .filter(function (inv) { return inv.buyerUid === req.piUser.uid; })
        .sort(function (a, b) {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
    return ok(res, { ok: true, invoices: mine });
});

/* ============================================
   ROUTE: GET /payments
   ============================================ */
app.get('/payments', requireAuth, function (req, res) {
    const mine = Array.from(DB.payments.values())
        .filter(function (p) { return p.uid === req.piUser.uid; })
        .sort(function (a, b) {
            return (b.createdAt || '').localeCompare(a.createdAt || '');
        });
    return ok(res, { ok: true, payments: mine });
});

/* ============================================
   ROUTE: POST /payments/create
   ============================================ */
app.post('/payments/create', requireAuth, async function (req, res) {
    if (!PI_API_KEY) return fail(res, 500, 'خادم GAV غير مهيأ للمدفوعات.');

    const body = req.body || {};
    const amount = toFiniteNumber(body.amount);
    const memo = String(body.memo || 'GAV payment').slice(0, 200);
    const metadata = (body.metadata && typeof body.metadata === 'object')
        ? body.metadata : {};

    if (metadata.currency && metadata.currency !== 'PI') {
        return fail(res, 400, 'العملة غير مدعومة. GAV يقبل Pi فقط.', 'CURRENCY');
    }
    if (body.currency && body.currency !== 'PI') {
        return fail(res, 400, 'العملة غير مدعومة. GAV يقبل Pi فقط.', 'CURRENCY');
    }
    if (!isPositiveNumber(amount)) {
        return fail(res, 400, 'المبلغ يجب أن يكون رقماً موجباً.');
    }

    const piRes = await fetchJson(
        PI_API_BASE + '/payments',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Key ' + PI_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                payment: {
                    amount: amount,
                    memo: memo,
                    metadata: Object.assign({}, metadata, {
                        uid: req.piUser.uid,
                        username: req.piUser.username,
                        serverCreated: true,
                        currency: 'PI'
                    }),
                    user_uid: req.piUser.uid
                }
            })
        },
        PI_ACTION_TIMEOUT
    );

    if (!piRes.ok) {
        console.error('[GAV/v1] Pi /payments failed:', piRes.status, piRes.data);
        return fail(res, 502, 'فشل إنشاء الدفع على Pi.',
            'PI_CREATE_FAILED');
    }

    const piPayment = piRes.data || {};
    const paymentId = piPayment.identifier || piPayment.id || '';
    if (!paymentId) {
        return fail(res, 502, 'استجابة Pi بدون paymentId.');
    }

    const payment = {
        paymentId: paymentId,
        uid: req.piUser.uid,
        username: req.piUser.username,
        amount: amount,
        memo: memo,
        metadata: metadata,
        status: 'created',
        txid: null,
        createdAt: nowIso()
    };
    DB.payments.set(paymentId, payment);
    auditLog(req.piUser.uid, 'payment.create', paymentId, { amount: amount });

    return ok(res, {
        ok: true,
        paymentId: paymentId,
        amount: amount,
        memo: memo,
        metadata: metadata
    }, 201);
});

/* ============================================
   ROUTE: POST /payments/approve
   ============================================ */
app.post('/payments/approve', requireAuth, async function (req, res) {
    if (!PI_API_KEY) return fail(res, 500, 'خادم GAV غير مهيأ للمدفوعات.');

    const paymentId = String((req.body && req.body.paymentId) || '').trim();
    if (!paymentId) return fail(res, 400, 'paymentId مطلوب.');

    const local = DB.payments.get(paymentId);
    if (!local) return fail(res, 404, 'الدفعة غير معروفة على الخادم.');
    if (local.uid !== req.piUser.uid) {
        return fail(res, 403, 'ليس لديك صلاحية اعتماد هذه الدفعة.');
    }

    const piRes = await fetchJson(
        PI_API_BASE + '/payments/' + encodeURIComponent(paymentId) + '/approve',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Key ' + PI_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({})
        },
        PI_ACTION_TIMEOUT
    );

    if (!piRes.ok) {
        console.error('[GAV/v1] Pi approve failed:', piRes.status, piRes.data);
        return fail(res, 502, 'فشل اعتماد الدفع على Pi.', 'PI_APPROVE_FAILED');
    }

    local.status = 'approved';
    local.approvedAt = nowIso();
    DB.payments.set(paymentId, local);
    auditLog(req.piUser.uid, 'payment.approve', paymentId);

    return ok(res, { ok: true, approved: true, paymentId: paymentId });
});

/* ============================================
   ROUTE: POST /payments/complete
   ============================================ */
app.post('/payments/complete', requireAuth, async function (req, res) {
    if (!PI_API_KEY) return fail(res, 500, 'خادم GAV غير مهيأ للمدفوعات.');

    const paymentId = String((req.body && req.body.paymentId) || '').trim();
    const txid      = String((req.body && req.body.txid)      || '').trim();

    if (!paymentId) return fail(res, 400, 'paymentId مطلوب.');
    if (!txid)      return fail(res, 400, 'txid مطلوب.');

    const local = DB.payments.get(paymentId);
    if (!local) return fail(res, 404, 'الدفعة غير معروفة على الخادم.');
    if (local.uid !== req.piUser.uid) {
        return fail(res, 403, 'ليس لديك صلاحية إكمال هذه الدفعة.');
    }

    const piRes = await fetchJson(
        PI_API_BASE + '/payments/' + encodeURIComponent(paymentId) + '/complete',
        {
            method: 'POST',
            headers: {
                'Authorization': 'Key ' + PI_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ txid: txid })
        },
        PI_ACTION_TIMEOUT
    );

    if (!piRes.ok) {
        console.error('[GAV/v1] Pi complete failed:', piRes.status, piRes.data);
        return fail(res, 502, 'فشل إكمال الدفع على Pi.', 'PI_COMPLETE_FAILED');
    }

    local.status = 'completed';
    local.txid = txid;
    local.completedAt = nowIso();
    DB.payments.set(paymentId, local);
    auditLog(req.piUser.uid, 'payment.complete', paymentId, { txid: txid });

    return ok(res, { ok: true, completed: true, paymentId: paymentId, txid: txid });
});

/* ============================================
   ROUTE: POST /payments/reconcile
   ============================================ */
app.post('/payments/reconcile', requireAuth, async function (req, res) {
    if (!PI_API_KEY) return fail(res, 500, 'خادم GAV غير مهيأ للمدفوعات.');

    const paymentId = String((req.body && req.body.paymentId) || '').trim();
    const txid      = req.body && req.body.txid ? String(req.body.txid).trim() : '';

    if (!paymentId) return fail(res, 400, 'paymentId مطلوب.');

    const piRes = await fetchJson(
        PI_API_BASE + '/payments/' + encodeURIComponent(paymentId),
        {
            method: 'GET',
            headers: {
                'Authorization': 'Key ' + PI_API_KEY,
                'Accept': 'application/json'
            }
        },
        PI_ACTION_TIMEOUT
    );

    if (!piRes.ok) {
        return fail(res, 502, 'تعذّر جلب حالة الدفعة من Pi.',
            'PI_FETCH_FAILED');
    }

    const piPayment = piRes.data || {};
    const piStatus = piPayment.status || 'unknown';
    const piTxid   = (piPayment.transaction && piPayment.transaction.txid) || txid || null;

    const local = DB.payments.get(paymentId) || {
        paymentId: paymentId,
        uid: req.piUser.uid,
        username: req.piUser.username,
        status: 'unknown',
        createdAt: nowIso()
    };

    local.status = piStatus;
    if (piTxid) local.txid = piTxid;
    local.reconciledAt = nowIso();
    DB.payments.set(paymentId, local);

    auditLog(req.piUser.uid, 'payment.reconcile', paymentId, {
        piStatus: piStatus,
        txid: piTxid
    });

    return ok(res, {
        ok: true,
        paymentId: paymentId,
        status: piStatus,
        txid: piTxid
    });
});

/* ============================================
   ROUTE: GET /supply-chain
   ============================================ */
app.get('/supply-chain', function (req, res) {
    const records = [];

    for (const p of DB.products.values()) {
        records.push({
            id: 'sc_' + p.id + '_origin',
            productId: p.id,
            productName: p.name,
            merchantName: p.merchantName,
            stage: 'origin',
            location: '—',
            batchId: null,
            verified: true,
            timestamp: p.createdAt
        });
    }

    for (const o of DB.orders.values()) {
        if (o.status === 'completed') {
            records.push({
                id: 'sc_' + o.id + '_delivered',
                productId: o.items && o.items[0] ? o.items[0].productId : null,
                productName: o.items && o.items[0] ? o.items[0].name : 'طلب',
                merchantName: o.buyerName || '—',
                stage: 'delivered',
                location: '—',
                batchId: o.id,
                verified: true,
                timestamp: o.createdAt
            });
        }
    }

    return ok(res, { ok: true, records: records });
});

/* ============================================
   ROUTE: GET /barter/festivals
   ============================================ */
app.get('/barter/festivals', function (req, res) {
    const list = Array.from(DB.festivals.values()).map(function (f) {
        return {
            id: f.id,
            name: f.name,
            location: f.location,
            startAt: f.startAt,
            endAt: f.endAt,
            status: f.status,
            participantsCount: f.participants ? f.participants.size : 0,
            offeredItems: f.offeredItems || [],
            wantedItems: f.wantedItems || [],
            joined: false
        };
    });

    return ok(res, { ok: true, festivals: list });
});

/* ============================================
   ROUTE: POST /barter/festivals/:id/offers
   ============================================ */
app.post('/barter/festivals/:id/offers', requireAuth, function (req, res) {
    const f = DB.festivals.get(req.params.id);
    if (!f) return fail(res, 404, 'الفعالية غير موجودة.');

    if (f.status === 'closed' || f.status === 'ended') {
        return fail(res, 400, 'الفعالية مغلقة.');
    }

    if (!f.participants) f.participants = new Set();
    f.participants.add(req.piUser.uid);

    if (!Array.isArray(f.offeredItems)) f.offeredItems = [];
    const offer = req.body && req.body.offer ? req.body.offer : null;
    if (offer) {
        f.offeredItems.push({
            uid: req.piUser.uid,
            username: req.piUser.username,
            offer: String(offer).slice(0, 500),
            at: nowIso()
        });
    }

    DB.festivals.set(f.id, f);
    auditLog(req.piUser.uid, 'barter.join', f.id);
    return ok(res, { ok: true, joined: true, festivalId: f.id });
});

/* ============================================
   ROUTE: POST /barter/festivals/:id/leave
   ============================================ */
app.post('/barter/festivals/:id/leave', requireAuth, function (req, res) {
    const f = DB.festivals.get(req.params.id);
    if (!f) return fail(res, 404, 'الفعالية غير موجودة.');

    if (f.participants && f.participants.has) {
        f.participants.delete(req.piUser.uid);
    }

    DB.festivals.set(f.id, f);
    auditLog(req.piUser.uid, 'barter.leave', f.id);
    return ok(res, { ok: true, joined: false, festivalId: f.id });
});

/* ============================================
   ROUTE: GET /audit
   ============================================ */
app.get('/audit', requireAuth, function (req, res) {
    const mine = DB.audit.filter(function (a) {
        return a.uid === req.piUser.uid;
    });
    const list = mine.slice().reverse().slice(0, 200);
    return ok(res, { ok: true, entries: list });
});

/* ============================================
   404 for unknown /api/v1/* routes
   ============================================ */
app.use(function (req, res) {
    return fail(res, 404, 'المسار غير موجود.', 'NOT_FOUND');
});

/* ============================================
   Global error handler
   ============================================ */
app.use(function (err, req, res, next) {
    console.error('[GAV/v1] Unhandled error:', err);
    if (res.headersSent) return next(err);
    return fail(res, 500, 'خطأ داخلي في الخادم.', 'INTERNAL_ERROR');
});

/* ============================================
   EXPORT (Vercel serverless + local)
   ============================================ */
module.exports = app;