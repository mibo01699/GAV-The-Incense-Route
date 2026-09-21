// ============================================
// GAV | Idempotency Protection
// ============================================

const db = require('./db');

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * التحقق من مفتاح Idempotency
 * إذا كان موجوداً، ارجع النتيجة المخزنة
 */
function checkIdempotency(key) {
    if (!key) return null;

    const stored = db.db.idempotencyKeys.get(key);
    if (!stored) return null;

    // التحقق من انتهاء الصلاحية
    if (Date.now() - stored.timestamp > IDEMPOTENCY_TTL) {
        db.db.idempotencyKeys.delete(key);
        return null;
    }

    return stored.result;
}

/**
 * تخزين نتيجة Idempotency
 */
function storeIdempotency(key, result) {
    if (!key) return;

    db.db.idempotencyKeys.set(key, {
        result: result,
        timestamp: Date.now()
    });
}

/**
 * Middleware للتحقق من Idempotency
 * يقرأ المفتاح من Header: Idempotency-Key
 */
function idempotencyMiddleware(req, res, next) {
    const key = req.headers['idempotency-key'];

    if (!key) {
        return next();
    }

    const cached = checkIdempotency(key);
    if (cached) {
        return res.status(200).json(cached);
    }

    // اعتراض send لتخزين النتيجة
    const originalJson = res.json.bind(res);
    res.json = function(data) {
        storeIdempotency(key, data);
        return originalJson(data);
    };

    next();
}

/**
 * تنظيف المفاتيح المنتهية
 */
function cleanupExpiredKeys() {
    const now = Date.now();
    for (const [key, value] of db.db.idempotencyKeys.entries()) {
        if (now - value.timestamp > IDEMPOTENCY_TTL) {
            db.db.idempotencyKeys.delete(key);
        }
    }
}

module.exports = {
    checkIdempotency: checkIdempotency,
    storeIdempotency: storeIdempotency,
    idempotencyMiddleware: idempotencyMiddleware,
    cleanupExpiredKeys: cleanupExpiredKeys
};