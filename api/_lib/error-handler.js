// ============================================
// GAV | Error Handler
// ============================================

const auditLog = require('./audit-log');

/**
 * الأخطاء المخصصة
 */
class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode || 500;
        this.code = code || 'INTERNAL_ERROR';
        this.isOperational = true;
    }
}

class ValidationError extends AppError {
    constructor(message, details) {
        super(message, 400, 'VALIDATION_ERROR');
        this.details = details || [];
    }
}

class NotFoundError extends AppError {
    constructor(resource) {
        super(resource + ' غير موجود', 404, 'NOT_FOUND');
    }
}

class UnauthorizedError extends AppError {
    constructor(message) {
        super(message || 'المصادقة مطلوبة', 401, 'UNAUTHORIZED');
    }
}

class ForbiddenError extends AppError {
    constructor(message) {
        super(message || 'غير مصرح', 403, 'FORBIDDEN');
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message || 'تعارض في الطلب', 409, 'CONFLICT');
    }
}

/**
 * Middleware لمعالجة الأخطاء
 */
function errorMiddleware(err, req, res, next) {
    const statusCode = err.statusCode || 500;
    const code = err.code || 'INTERNAL_ERROR';

    // تسجيل الخطأ
    auditLog.error('API_ERROR', {
        actorId: req.user ? req.user.uid : null,
        metadata: {
            path: req.path,
            method: req.method,
            statusCode: statusCode,
            code: code,
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
        }
    });

    const response = {
        error: err.message || 'خطأ في الخادم',
        code: code
    };

    if (err.details) {
        response.details = err.details;
    }

    res.status(statusCode).json(response);
}

/**
 * Middleware لمعالجة 404
 */
function notFoundMiddleware(req, res) {
    res.status(404).json({
        error: 'المسار غير موجود',
        code: 'NOT_FOUND',
        path: req.path
    });
}

module.exports = {
    AppError: AppError,
    ValidationError: ValidationError,
    NotFoundError: NotFoundError,
    UnauthorizedError: UnauthorizedError,
    ForbiddenError: ForbiddenError,
    ConflictError: ConflictError,
    errorMiddleware: errorMiddleware,
    notFoundMiddleware: notFoundMiddleware
};