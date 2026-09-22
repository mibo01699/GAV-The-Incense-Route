// ============================================
// GAV | Standardized API Responses
// ============================================

/**
 * استجابة ناجحة
 */
function success(res, data, statusCode) {
    return res.status(statusCode || 200).json({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
    });
}

/**
 * استجابة إنشاء ناجح
 */
function created(res, data) {
    return success(res, data, 201);
}

/**
 * استجابة خطأ
 */
function error(res, message, statusCode, code, details) {
    const response = {
        success: false,
        error: message || 'حدث خطأ',
        code: code || 'ERROR',
        timestamp: new Date().toISOString()
    };

    if (details) {
        response.details = details;
    }

    return res.status(statusCode || 500).json(response);
}

/**
 * استجابة قائمة (مع pagination)
 */
function paginated(res, items, total, limit, offset) {
    return res.status(200).json({
        success: true,
        data: items,
        pagination: {
            total: total,
            limit: limit || items.length,
            offset: offset || 0,
            hasMore: offset + items.length < total
        },
        timestamp: new Date().toISOString()
    });
}

/**
 * استجابة 400
 */
function badRequest(res, message, details) {
    return error(res, message, 400, 'BAD_REQUEST', details);
}

/**
 * استجابة 401
 */
function unauthorized(res, message) {
    return error(res, message || 'المصادقة مطلوبة', 401, 'UNAUTHORIZED');
}

/**
 * استجابة 403
 */
function forbidden(res, message) {
    return error(res, message || 'غير مصرح', 403, 'FORBIDDEN');
}

/**
 * استجابة 404
 */
function notFound(res, message) {
    return error(res, message || 'المورد غير موجود', 404, 'NOT_FOUND');
}

/**
 * استجابة 409
 */
function conflict(res, message) {
    return error(res, message || 'تعارض', 409, 'CONFLICT');
}

module.exports = {
    success: success,
    created: created,
    error: error,
    paginated: paginated,
    badRequest: badRequest,
    unauthorized: unauthorized,
    forbidden: forbidden,
    notFound: notFound,
    conflict: conflict
};