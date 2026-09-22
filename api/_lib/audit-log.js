// ============================================
// GAV | Audit Logging
// ============================================

const db = require('./db');

const LOG_LEVELS = {
    INFO: 'INFO',
    WARN: 'WARN',
    ERROR: 'ERROR',
    SECURITY: 'SECURITY'
};

/**
 * تسجيل حدث في سجل التدقيق
 */
function log(level, action, details) {
    const entry = {
        id: db.generateId('log'),
        level: level,
        action: action,
        actorId: details && details.actorId ? details.actorId : null,
        actorUsername: details && details.actorUsername ? details.actorUsername : null,
        targetId: details && details.targetId ? details.targetId : null,
        targetType: details && details.targetType ? details.targetType : null,
        ip: details && details.ip ? details.ip : null,
        userAgent: details && details.userAgent ? details.userAgent : null,
        metadata: details && details.metadata ? details.metadata : {},
        timestamp: new Date().toISOString()
    };

    db.db.auditLogs.push(entry);

    // الحد الأقصى: 10000 سجل
    if (db.db.auditLogs.length > 10000) {
        db.db.auditLogs.shift();
    }

    return entry;
}

/**
 * تسجيل حدث معلوماتي
 */
function info(action, details) {
    return log(LOG_LEVELS.INFO, action, details);
}

/**
 * تسجيل تحذير
 */
function warn(action, details) {
    return log(LOG_LEVELS.WARN, action, details);
}

/**
 * تسجيل خطأ
 */
function error(action, details) {
    return log(LOG_LEVELS.ERROR, action, details);
}

/**
 * تسجيل حدث أمني
 */
function security(action, details) {
    return log(LOG_LEVELS.SECURITY, action, details);
}

/**
 * الحصول على السجلات
 */
function getLogs(filter) {
    let logs = db.db.auditLogs.slice();

    if (filter) {
        if (filter.actorId) logs = logs.filter(function(l) { return l.actorId === filter.actorId; });
        if (filter.action) logs = logs.filter(function(l) { return l.action === filter.action; });
        if (filter.level) logs = logs.filter(function(l) { return l.level === filter.level; });
        if (filter.since) logs = logs.filter(function(l) { return new Date(l.timestamp) >= new Date(filter.since); });
    }

    logs.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
    return logs.slice(0, 500);
}

module.exports = {
    log: log,
    info: info,
    warn: warn,
    error: error,
    security: security,
    getLogs: getLogs,
    LOG_LEVELS: LOG_LEVELS
};