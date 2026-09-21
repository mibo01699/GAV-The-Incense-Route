// ============================================
// GAV | Main Server v1.0.0
// ============================================

const express = require('express');
const cors = require('cors');

const piPlatform = require('../_lib/pi-platform');
const db = require('../_lib/db');
const authMiddleware = require('../_lib/auth-middleware');
const idempotency = require('../_lib/idempotency');
const auditLog = require('../_lib/audit-log');
const validators = require('../_lib/validators');
const errors = require('../_lib/error-handler');
const response = require('../_lib/response');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// Middleware
// ============================================
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    credentials: true
}));
app.use(express.json({ limit: '1mb' }));

// طلب ID لكل request
app.use(function(req, res, next) {
    req.requestId = db.generateId('req');
    res.setHeader('X-Request-ID', req.requestId);
    next();
});

// ============================================
// API: Health
// ============================================
app.get('/api/v1/health', function(req, res) {
    response.success(res, {
        service: 'gav-the-incense-route',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        pi: {
            apiKeyConfigured: !!process.env.PI_API_KEY
        },
        stats: {
            users: db.db.users.size,
            products: db.db.products.size,
            orders: db.db.orders.size,
            festivals: db.db.barterFestivals.size
        }
    });
});

// ============================================
// API: Auth
// ============================================
app.post('/api/v1/auth/verify', async function(req, res, next) {
    try {
        const accessToken = req.body.accessToken;
        if (!accessToken) {
            return response.badRequest(res, 'accessToken مطلوب');
        }

        const result = await piPlatform.verifyUserToken(accessToken);
        if (!result.ok) {
            return response.unauthorized(res, result.error);
        }

        const user = db.getOrCreateUser(result.user.uid, result.user.username);

        auditLog.info('AUTH_VERIFIED', {
            actorId: user.uid,
            actorUsername: user.username,
            ip: req.ip
        });

        return response.success(res, {
            user: {
                uid: user.uid,
                username: user.username,
                gavAccountNumber: user.gavAccountNumber
            }
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/v1/auth/me', authMiddleware.requireAuth, function(req, res) {
    return response.success(res, {
        user: {
            uid: req.user.uid,
            username: req.user.username,
            gavAccountNumber: req.user.gavAccountNumber,
            createdAt: req.user.createdAt
        }
    });
});

// ============================================
// API: Payments
// ============================================
app.post('/api/v1/payments/create', authMiddleware.requireAuth, async function(req, res, next) {
    try {
        const amount = parseFloat(req.body.amount);
        const memo = req.body.memo || 'GAV Payment';
        const metadata = req.body.metadata || {};

        if (!amount || amount <= 0) {
            return response.badRequest(res, 'المبلغ غير صالح');
        }

        const paymentId = db.generateId('pay');
        const payment = {
            id: paymentId,
            userId: req.user.uid,
            username: req.user.username,
            amount: amount,
            memo: memo,
            metadata: metadata,
            status: 'CREATED',
            createdAt: new Date().toISOString()
        };

        db.db.payments.set(paymentId, payment);
        db.db.paymentEvents.push({
            paymentId: paymentId,
            event: 'CREATED',
            timestamp: new Date().toISOString()
        });

        auditLog.info('PAYMENT_CREATED', {
            actorId: req.user.uid,
            targetId: paymentId,
            metadata: { amount: amount }
        });

        return response.created(res, { payment: payment });
    } catch (err) {
        next(err);
    }
});

app.post('/api/v1/payments/approve', authMiddleware.requireAuth, idempotency.idempotencyMiddleware, async function(req, res, next) {
    try {
        const paymentId = req.body.paymentId;
        if (!paymentId) {
            return response.badRequest(res, 'paymentId مطلوب');
        }

        const result = await piPlatform.approvePayment(paymentId);
        if (!result.ok) {
            return response.error(res, result.error, result.status || 500, 'APPROVE_FAILED');
        }

        const payment = db.db.payments.get(paymentId);
        if (payment) {
            payment.status = 'APPROVED';
            payment.approvedAt = new Date().toISOString();
        }

        db.db.paymentEvents.push({
            paymentId: paymentId,
            event: 'APPROVED',
            timestamp: new Date().toISOString()
        });

        auditLog.info('PAYMENT_APPROVED', {
            actorId: req.user.uid,
            targetId: paymentId
        });

        return response.success(res, { paymentId: paymentId, status: 'APPROVED' });
    } catch (err) {
        next(err);
    }
});

app.post('/api/v1/payments/complete', authMiddleware.requireAuth, idempotency.idempotencyMiddleware, async function(req, res, next) {
    try {
        const paymentId = req.body.paymentId;
        const txid = req.body.txid;

        if (!paymentId || !txid) {
            return response.badRequest(res, 'paymentId و txid مطلوبان');
        }

        const result = await piPlatform.completePayment(paymentId, txid);
        if (!result.ok) {
            return response.error(res, result.error, result.status || 500, 'COMPLETE_FAILED');
        }

        const payment = db.db.payments.get(paymentId);
        if (payment) {
            payment.status = 'COMPLETED';
            payment.txid = txid;
            payment.completedAt = new Date().toISOString();
        }

        db.db.paymentEvents.push({
            paymentId: paymentId,
            event: 'COMPLETED',
            txid: txid,
            timestamp: new Date().toISOString()
        });

        auditLog.info('PAYMENT_COMPLETED', {
            actorId: req.user.uid,
            targetId: paymentId,
            metadata: { txid: txid }
        });

        return response.success(res, {
            paymentId: paymentId,
            txid: txid,
            status: 'COMPLETED'
        });
    } catch (err) {
        next(err);
    }
});

app.get('/api/v1/payments/status/:paymentId', authMiddleware.requireAuth, function(req, res) {
    const payment = db.db.payments.get(req.params.paymentId);
    if (!payment) {
        return response.notFound(res, 'الدفع غير موجود');
    }
    if (payment.userId !== req.user.uid) {
        return response.forbidden(res, 'غير مصرح');
    }
    return response.success(res, { payment: payment });
});

app.post('/api/v1/payments/incomplete', authMiddleware.requireAuth, function(req, res) {
    const payment = req.body.payment;
    if (!payment) {
        return response.badRequest(res, 'payment مطلوب');
    }

    db.db.paymentEvents.push({
        paymentId: payment.identifier || 'unknown',
        event: 'INCOMPLETE_FOUND',
        details: payment,
        userId: req.user.uid,
        timestamp: new Date().toISOString()
    });

    auditLog.warn('INCOMPLETE_PAYMENT', {
        actorId: req.user.uid,
        metadata: { payment: payment }
    });

    return response.success(res, { received: true });
});
// ============================================
// API: Products
// ============================================
app.get('/api/v1/products', function(req, res) {
    let products = Array.from(db.db.products.values());

    if (req.query.category) {
        products = products.filter(function(p) { return p.category === req.query.category; });
    }
    if (req.query.merchantId) {
        products = products.filter(function(p) { return p.merchantId === req.query.merchantId; });
    }
    if (req.query.search) {
        const s = req.query.search.toLowerCase();
        products = products.filter(function(p) {
            return p.name.toLowerCase().indexOf(s) !== -1;
        });
    }

    products.sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return response.success(res, { products: products, count: products.length });
});

app.get('/api/v1/products/:id', function(req, res) {
    const product = db.db.products.get(req.params.id);
    if (!product) {
        return response.notFound(res, 'المنتج غير موجود');
    }
    return response.success(res, { product: product });
});

app.post('/api/v1/products', authMiddleware.requireAuth, async function(req, res, next) {
    try {
        const productData = req.body.product || req.body;

        const validation = validators.validateProduct(productData);
        if (!validation.valid) {
            return response.badRequest(res, 'بيانات غير صالحة', validation.errors);
        }

        const productId = db.generateId('prod');
        const product = {
            id: productId,
            merchantId: req.user.uid,
            merchantName: req.user.username,
            name: productData.name,
            type: productData.type || '',
            description: productData.description || '',
            category: productData.category || 'others',
            quantity: parseInt(productData.quantity) || 1,
            stock: parseInt(productData.stock) || 1,
            directSaleAddress: productData.directSaleAddress || '',
            priceUSD: parseFloat(productData.priceUSD) || 0,
            pricePi: parseFloat(productData.pricePi) || 0,
            priceYER: parseFloat(productData.priceYER) || 0,
            referenceSource: productData.referenceSource || 'gav-reference-index',
            status: 'ACTIVE',
            createdAt: new Date().toISOString()
        };

        db.db.products.set(productId, product);

        auditLog.info('PRODUCT_CREATED', {
            actorId: req.user.uid,
            targetId: productId,
            targetType: 'product',
            metadata: { name: product.name }
        });

        return response.created(res, { product: product });
    } catch (err) {
        next(err);
    }
});

app.delete('/api/v1/products/:id', authMiddleware.requireAuth, function(req, res, next) {
    try {
        const product = db.db.products.get(req.params.id);
        if (!product) {
            return response.notFound(res, 'المنتج غير موجود');
        }
        if (product.merchantId !== req.user.uid) {
            return response.forbidden(res, 'غير مصرح');
        }

        db.db.products.delete(req.params.id);

        auditLog.info('PRODUCT_DELETED', {
            actorId: req.user.uid,
            targetId: req.params.id,
            targetType: 'product'
        });

        return response.success(res, { deleted: true });
    } catch (err) {
        next(err);
    }
});

// ============================================
// API: Merchants
// ============================================
app.get('/api/v1/merchants', function(req, res) {
    const merchants = Array.from(db.db.users.values()).map(function(u) {
        return {
            uid: u.uid,
            username: u.username,
            gavAccountNumber: u.gavAccountNumber
        };
    });
    return response.success(res, { merchants: merchants, count: merchants.length });
});

app.get('/api/v1/merchants/me', authMiddleware.requireAuth, function(req, res) {
    const myProducts = Array.from(db.db.products.values()).filter(function(p) {
        return p.merchantId === req.user.uid;
    });

    return response.success(res, {
        merchant: {
            uid: req.user.uid,
            username: req.user.username,
            gavAccountNumber: req.user.gavAccountNumber
        },
        products: myProducts
    });
});

// ============================================
// API: Orders
// ============================================
app.get('/api/v1/orders', authMiddleware.requireAuth, function(req, res) {
    const orders = Array.from(db.db.orders.values()).filter(function(o) {
        return o.userId === req.user.uid || o.merchantId === req.user.uid;
    });
    orders.sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return response.success(res, { orders: orders, count: orders.length });
});

app.post('/api/v1/orders', authMiddleware.requireAuth, async function(req, res, next) {
    try {
        const productId = req.body.productId;
        const quantity = parseInt(req.body.quantity) || 1;

        if (!productId) {
            return response.badRequest(res, 'productId مطلوب');
        }

        const product = db.db.products.get(productId);
        if (!product) {
            return response.notFound(res, 'المنتج غير موجود');
        }

        const orderId = db.generateId('ord');
        const order = {
            id: orderId,
            userId: req.user.uid,
            username: req.user.username,
            productId: productId,
            productName: product.name,
            merchantId: product.merchantId,
            merchantName: product.merchantName,
            quantity: quantity,
            piAmount: product.pricePi * quantity,
            yerAmount: product.priceYER * quantity,
            status: 'PENDING_PAYMENT',
            createdAt: new Date().toISOString()
        };

        db.db.orders.set(orderId, order);

        auditLog.info('ORDER_CREATED', {
            actorId: req.user.uid,
            targetId: orderId,
            targetType: 'order',
            metadata: { productId: productId, quantity: quantity }
        });

        return response.created(res, { order: order });
    } catch (err) {
        next(err);
    }
});

// ============================================
// API: Invoices
// ============================================
app.get('/api/v1/invoices', authMiddleware.requireAuth, function(req, res) {
    const invoices = Array.from(db.db.invoices.values()).filter(function(i) {
        return i.userId === req.user.uid || i.merchantId === req.user.uid;
    });
    return response.success(res, { invoices: invoices, count: invoices.length });
});

app.post('/api/v1/invoices', authMiddleware.requireAuth, function(req, res, next) {
    try {
        const items = req.body.items || [];
        const total = parseFloat(req.body.total) || 0;

        if (items.length === 0) {
            return response.badRequest(res, 'يجب إضافة عنصر واحد على الأقل');
        }

        const invoiceId = db.generateId('inv');
        const invoice = {
            id: invoiceId,
            number: 'GAV-' + Date.now(),
            userId: req.user.uid,
            merchantId: req.user.uid,
            merchantName: req.user.username,
            gavAccountNumber: req.user.gavAccountNumber,
            items: items,
            total: total,
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        db.db.invoices.set(invoiceId, invoice);
        return response.created(res, { invoice: invoice });
    } catch (err) {
        next(err);
    }
});

app.get('/api/v1/invoices/:id', authMiddleware.requireAuth, function(req, res) {
    const invoice = db.db.invoices.get(req.params.id);
    if (!invoice) {
        return response.notFound(res, 'الفاتورة غير موجودة');
    }
    return response.success(res, { invoice: invoice });
});
// ============================================
// API: POS
// ============================================
app.post('/api/v1/pos/invoice', authMiddleware.requireAuth, function(req, res, next) {
    try {
        const items = req.body.items || [];
        if (items.length === 0) {
            return response.badRequest(res, 'يجب إضافة عنصر واحد على الأقل');
        }

        let total = 0;
        items.forEach(function(item) {
            total += (parseFloat(item.pricePi) || 0) * (parseInt(item.quantity) || 1);
        });

        const invoiceId = db.generateId('pos');
        const invoice = {
            id: invoiceId,
            number: 'POS-' + Date.now(),
            merchantId: req.user.uid,
            merchantName: req.user.username,
            gavAccountNumber: req.user.gavAccountNumber,
            items: items,
            total: total,
            status: 'PENDING_PAYMENT',
            createdAt: new Date().toISOString()
        };

        db.db.invoices.set(invoiceId, invoice);
        return response.created(res, { invoice: invoice });
    } catch (err) {
        next(err);
    }
});

app.post('/api/v1/pos/verify', authMiddleware.requireAuth, function(req, res) {
    const invoiceId = req.body.invoiceId;
    const paymentId = req.body.paymentId;

    if (!invoiceId) {
        return response.badRequest(res, 'invoiceId مطلوب');
    }

    const invoice = db.db.invoices.get(invoiceId);
    if (!invoice) {
        return response.notFound(res, 'الفاتورة غير موجودة');
    }

    if (invoice.merchantId !== req.user.uid) {
        return response.forbidden(res, 'غير مصرح');
    }

    const payment = paymentId ? db.db.payments.get(paymentId) : null;

    if (payment && payment.status === 'COMPLETED') {
        invoice.status = 'PAID';
        invoice.paidAt = new Date().toISOString();
        return response.success(res, { verified: true, invoice: invoice });
    }

    return response.success(res, { verified: false, invoice: invoice });
});

// ============================================
// API: Barter Festivals
// ============================================
app.get('/api/v1/barter/festivals', function(req, res) {
    let festivals = Array.from(db.db.barterFestivals.values()).filter(function(f) {
        return f.status === 'APPROVED' || f.status === 'ACTIVE';
    });
    festivals.sort(function(a, b) {
        return new Date(b.createdAt) - new Date(a.createdAt);
    });
    return response.success(res, { festivals: festivals, count: festivals.length });
});

app.get('/api/v1/barter/festivals/my', authMiddleware.requireAuth, function(req, res) {
    const myFestivals = Array.from(db.db.barterFestivals.values()).filter(function(f) {
        return f.creatorId === req.user.uid;
    });
    return response.success(res, { festivals: myFestivals });
});

app.post('/api/v1/barter/festivals', authMiddleware.requireAuth, function(req, res, next) {
    try {
        const festivalData = req.body.festival || req.body;

        const validation = validators.validateFestival(festivalData);
        if (!validation.valid) {
            return response.badRequest(res, 'بيانات غير صالحة', validation.errors);
        }

        const festivalId = db.generateId('fest');
        const festival = {
            id: festivalId,
            creatorId: req.user.uid,
            creatorName: req.user.username,
            title: festivalData.title,
            description: festivalData.description || '',
            location: festivalData.location || '',
            directSaleAddress: festivalData.directSaleAddress || '',
            country: festivalData.country || '',
            region: festivalData.region || '',
            startDate: festivalData.startDate || new Date().toISOString(),
            endDate: festivalData.endDate || new Date(Date.now() + 7 * 86400000).toISOString(),
            editors: [req.user.uid],
            products: [],
            exchanges: [],
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        db.db.barterFestivals.set(festivalId, festival);

        auditLog.info('FESTIVAL_CREATED', {
            actorId: req.user.uid,
            targetId: festivalId,
            targetType: 'festival'
        });

        return response.created(res, { festival: festival });
    } catch (err) {
        next(err);
    }
});

app.get('/api/v1/barter/festivals/:id', function(req, res) {
    const festival = db.db.barterFestivals.get(req.params.id);
    if (!festival) {
        return response.notFound(res, 'المهرجان غير موجود');
    }
    return response.success(res, { festival: festival });
});

app.post('/api/v1/barter/festivals/:id/offers', authMiddleware.requireAuth, function(req, res, next) {
    try {
        const festival = db.db.barterFestivals.get(req.params.id);
        if (!festival) {
            return response.notFound(res, 'المهرجان غير موجود');
        }

        const offerData = req.body.offer || req.body;

        const validation = validators.validateOffer(offerData);
        if (!validation.valid) {
            return response.badRequest(res, 'بيانات غير صالحة', validation.errors);
        }

        // الموافقة التلقائية عند إضافة أول عرض
        if (festival.status === 'PENDING') {
            festival.status = 'APPROVED';
            festival.approvedAt = new Date().toISOString();
            festival.approvedBy = 'auto-first-offer';
        }

        const offerId = db.generateId('offer');
        const offer = {
            id: offerId,
            festivalId: festival.id,
            sellerId: req.user.uid,
            sellerName: req.user.username,
            name: offerData.name,
            type: offerData.type || '',
            description: offerData.description || '',
            pricePi: parseFloat(offerData.pricePi),
            quantity: parseInt(offerData.quantity) || 1,
            directSaleAddress: offerData.directSaleAddress || '',
            status: 'AVAILABLE',
            createdAt: new Date().toISOString()
        };

        if (!festival.products) festival.products = [];
        festival.products.push(offer);

        db.db.barterOffers.set(offerId, offer);

        return response.created(res, { offer: offer });
    } catch (err) {
        next(err);
    }
});

// ============================================
// API: Supply Chain
// ============================================
app.get('/api/v1/supply-chain', authMiddleware.requireAuth, function(req, res) {
    let events = db.db.supplyChainEvents.slice();
    if (req.query.productId) {
        events = events.filter(function(e) { return e.productId === req.query.productId; });
    }
    events.sort(function(a, b) {
        return new Date(a.timestamp) - new Date(b.timestamp);
    });
    return response.success(res, { events: events, count: events.length });
});

app.post('/api/v1/supply-chain', authMiddleware.requireAuth, function(req, res, next) {
    try {
        const eventData = req.body;

        if (!eventData.productId || !eventData.eventType) {
            return response.badRequest(res, 'productId و eventType مطلوبان');
        }

        const previousEvents = db.db.supplyChainEvents.filter(function(e) {
            return e.productId === eventData.productId;
        });
        const previousHash = previousEvents.length > 0
            ? previousEvents[previousEvents.length - 1].eventHash
            : null;

        const eventId = db.generateId('sce');
        const eventHash = db.generateId('hash');

        const event = {
            eventId: eventId,
            actorId: req.user.uid,
            actorUsername: req.user.username,
            productId: eventData.productId,
            eventType: eventData.eventType,
            quantity: parseFloat(eventData.quantity) || 0,
            locationReference: eventData.locationReference || '',
            documentReference: eventData.documentReference || '',
            verificationStatus: eventData.verificationStatus || 'PENDING',
            previousEventHash: previousHash,
            eventHash: eventHash,
            timestamp: new Date().toISOString()
        };

        db.db.supplyChainEvents.push(event);

        return response.created(res, { event: event });
    } catch (err) {
        next(err);
    }
});

// ============================================
// API: Pricing (GAV Reference Index)
// ============================================
app.get('/api/v1/pricing/reference', function(req, res) {
    const allProducts = Array.from(db.db.products.values());
    const allOrders = Array.from(db.db.orders.values());

    const observedValue = allOrders.length > 0
        ? allOrders.reduce(function(sum, o) { return sum + (o.piAmount || 0); }, 0) / allOrders.length
        : 0;

    return response.success(res, {
        referenceIndex: {
            observedValue: parseFloat(observedValue.toFixed(8)),
            referenceValue: parseFloat(observedValue.toFixed(8)),
            confidenceLevel: allOrders.length >= 10 ? 85 : allOrders.length * 8,
            dataTimestamp: new Date().toISOString(),
            dataSources: [
                'verified_marketplace_transactions',
                'verified_merchant_transactions',
                'supply_demand_ratio',
                'transaction_volume'
            ]
        },
        disclaimer: 'GAV Reference Index is an internal economic indicator, not an official Pi price',
        stats: {
            totalProducts: allProducts.length,
            totalOrders: allOrders.length
        }
    });
});

app.get('/api/v1/pricing/history', function(req, res) {
    return response.success(res, {
        history: db.db.referencePrices.slice(-100),
        count: db.db.referencePrices.length
    });
});

// ============================================
// API: Analytics
// ============================================
app.get('/api/v1/analytics', authMiddleware.requireAuth, function(req, res) {
    return response.success(res, {
        users: db.db.users.size,
        products: db.db.products.size,
        orders: db.db.orders.size,
        festivals: db.db.barterFestivals.size,
        payments: db.db.payments.size,
        supplyChainEvents: db.db.supplyChainEvents.length,
        auditLogs: db.db.auditLogs.length
    });
});

// ============================================
// Error Handlers
// ============================================
app.use(errors.notFoundMiddleware);
app.use(errors.errorMiddleware);

// ============================================
// Start Server (Local Dev)
// ============================================
if (require.main === module) {
    app.listen(PORT, function() {
        console.log('✅ GAV v1.0.0 running on port ' + PORT);
    });
}

module.exports = app;
