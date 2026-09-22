// ============================================
// GAV | Auth Middleware
// ============================================

const piPlatform = require('./pi-platform');
const db = require('./db');

/**
 * التحقق من توكن Pi (Middleware)
 * يقرأ accessToken من Header: Authorization: Bearer <token>
 * أو من body: { accessToken: "..." }
 */
async function requireAuth(req, res, next) {
    let accessToken = null;

    // محاولة قراءته من Header
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
    }

    // أو من body
    if (!accessToken && req.body && req.body.accessToken) {
        accessToken = req.body.accessToken;
    }

    if (!accessToken) {
        return res.status(401).json({
            error: 'المصادقة مطلوبة',
            code: 'AUTH_REQUIRED'
        });
    }

    const result = await piPlatform.verifyUserToken(accessToken);

    if (!result.ok) {
        return res.status(result.status || 401).json({
            error: result.error || 'توكن غير صالح',
            code: 'INVALID_TOKEN'
        });
    }

    // إنشاء/تحديث المستخدم في قاعدة البيانات
    const user = db.getOrCreateUser(result.user.uid, result.user.username);

    // إرفاق المستخدم بالطلب
    req.user = user;
    req.accessToken = accessToken;

    next();
}

/**
 * التحقق من أن المستخدم هو مالك المورد
 */
function requireOwnership(getOwnerId) {
    return function(req, res, next) {
        const ownerId = getOwnerId(req);
        if (!ownerId || ownerId !== req.user.uid) {
            return res.status(403).json({
                error: 'غير مصرح',
                code: 'FORBIDDEN'
            });
        }
        next();
    };
}

module.exports = {
    requireAuth: requireAuth,
    requireOwnership: requireOwnership
};