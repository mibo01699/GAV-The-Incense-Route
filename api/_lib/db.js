// ============================================
// GAV | Database Client (In-Memory for Testnet)
// ============================================

/**
 * قاعدة بيانات مؤقتة للـ Testnet
 * ملاحظة: للانتقال إلى Production، استبدلها بـ PostgreSQL
 */

const db = {
    users: new Map(),
    merchants: new Map(),
    products: new Map(),
    orders: new Map(),
    invoices: new Map(),
    payments: new Map(),
    paymentEvents: [],
    barterFestivals: new Map(),
    barterOffers: new Map(),
    supplyChainEvents: [],
    auditLogs: [],
    idempotencyKeys: new Map(),
    referencePrices: [],
    utilityMetrics: []
};

/**
 * إنشاء ID فريد
 */
function generateId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 10);
    return (prefix || 'id') + '_' + timestamp + '_' + random;
}

/**
 * إنشاء رقم حساب GAV
 */
function generateGavAccountNumber() {
    const sequence = Date.now().toString().slice(-10);
    return 'GAV-01-' + sequence;
}

/**
 * الحصول على المستخدم أو إنشاؤه
 */
function getOrCreateUser(uid, username) {
    if (!db.users.has(uid)) {
        db.users.set(uid, {
            uid: uid,
            username: username,
            gavAccountNumber: generateGavAccountNumber(),
            createdAt: new Date().toISOString()
        });
    }
    return db.users.get(uid);
}

/**
 * الحصول على مستخدم
 */
function getUser(uid) {
    return db.users.get(uid) || null;
}

module.exports = {
    db: db,
    generateId: generateId,
    generateGavAccountNumber: generateGavAccountNumber,
    getOrCreateUser: getOrCreateUser,
    getUser: getUser
};