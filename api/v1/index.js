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