// ============================================
// GAV | Standardized API Responses
// File: api/_lib/response.js
// ============================================
// All API responses follow the same structure.
// No floats. No inconsistent formats.
// ============================================

'use strict';

// ============================================
// Constants (integers only)
// ============================================

const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
    GATEWAY_TIMEOUT: 504
};

// ============================================
// Success Responses
// ============================================

/**
 * 200 OK — Generic success.
 * Response: { success: true, data: <data>, timestamp: <ISO> }
 */
function success(res, data) {
    return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
    });
}

/**
 * 201 Created — Resource created.
 * Response: { success: true, data: <data>, timestamp: <ISO> }
 */
function created(res, data) {
    return res.status(HTTP_STATUS.CREATED).json({
        success: true,
        data: data,
        timestamp: new Date().toISOString()
    });
}

/**
 * 200 OK — Paginated list.
 * Response: { success: true, data: [...], pagination: {...}, timestamp }
 */
function paginated(res, items, total, limit, offset) {
    const totalInt = Number.isInteger(total) ? total : 0;
    const limitInt = Number.isInteger(limit) ? limit : items.length;
    const offsetInt = Number.isInteger(offset) ? offset : 0;

    return res.status(HTTP_STATUS.OK).json({
        success: true,
        data: items,
        pagination: {
            total: totalInt,
            limit: limitInt,
            offset: offsetInt,
            hasMore: (offsetInt + items.length) < totalInt
        },
        timestamp: new Date().toISOString()
    });
}

/**
 * 204 No Content — For DELETE operations.
 */
function noContent(res) {
    return res.status(HTTP_STATUS.NO_CONTENT).send();
}

// ============================================
// Error Responses
// ============================================

/**
 * Generic error response.
 * Response: { success: false, error: <string>, code: <string>, timestamp }
 */
function error(res, message, statusCode, code, details) {
    const response = {
        success: false,
        error: message || 'An error occurred',
        code: code || 'ERROR',
        timestamp: new Date().toISOString()
    };

    if (details !== undefined && details !== null) {
        response.details = details;
    }

    return res.status(statusCode || HTTP_STATUS.INTERNAL_ERROR).json(response);
}

/**
 * 400 Bad Request.
 */
function badRequest(res, message, details) {
    return error(
        res,
        message || 'Bad request',
        HTTP_STATUS.BAD_REQUEST,
        'BAD_REQUEST',
        details
    );
}

/**
 * 401 Unauthorized.
 */
function unauthorized(res, message) {
    return error(
        res,
        message || 'Authentication required',
        HTTP_STATUS.UNAUTHORIZED,
        'UNAUTHORIZED'
    );
}

/**
 * 403 Forbidden.
 */
function forbidden(res, message) {
    return error(
        res,
        message || 'Forbidden',
        HTTP_STATUS.FORBIDDEN,
        'FORBIDDEN'
    );
}

/**
 * 404 Not Found.
 */
function notFound(res, message) {
    return error(
        res,
        message || 'Resource not found',
        HTTP_STATUS.NOT_FOUND,
        'NOT_FOUND'
    );
}

/**
 * 409 Conflict — For duplicate operations.
 */
function conflict(res, message) {
    return error(
        res,
        message || 'Conflict',
        HTTP_STATUS.CONFLICT,
        'CONFLICT'
    );
}

/**
 * 422 Unprocessable Entity — Validation errors.
 */
function validationError(res, message, details) {
    return error(
        res,
        message || 'Validation failed',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        'VALIDATION_ERROR',
        details
    );
}

/**
 * 429 Too Many Requests.
 */
function tooManyRequests(res, message) {
    return error(
        res,
        message || 'Too many requests',
        HTTP_STATUS.TOO_MANY_REQUESTS,
        'RATE_LIMITED'
    );
}

/**
 * 500 Internal Server Error.
 */
function internalError(res, message) {
    return error(
        res,
        message || 'Internal server error',
        HTTP_STATUS.INTERNAL_ERROR,
        'INTERNAL_ERROR'
    );
}

/**
 * 503 Service Unavailable.
 */
function serviceUnavailable(res, message) {
    return error(
        res,
        message || 'Service unavailable',
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        'SERVICE_UNAVAILABLE'
    );
}

/**
 * 504 Gateway Timeout.
 */
function gatewayTimeout(res, message) {
    return error(
        res,
        message || 'Gateway timeout',
        HTTP_STATUS.GATEWAY_TIMEOUT,
        'GATEWAY_TIMEOUT'
    );
}

// ============================================
// Middleware: 404 Handler
// ============================================

function notFoundMiddleware(req, res) {
    return res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Route not found',
        code: 'NOT_FOUND',
        path: req.path,
        method: req.method,
        timestamp: new Date().toISOString()
    });
}

// ============================================
// Middleware: Error Handler
// ============================================

function errorMiddleware(err, req, res, next) {
    // Determine status code
    let statusCode = HTTP_STATUS.INTERNAL_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details = undefined;

    if (err) {
        // Custom error with explicit status
        if (Number.isInteger(err.statusCode)) {
            statusCode = err.statusCode;
        }
        if (typeof err.code === 'string' && err.code.length > 0) {
            code = err.code;
        }
        if (typeof err.message === 'string' && err.message.length > 0) {
            message = err.message;
        }
        if (err.details !== undefined) {
            details = err.details;
        }
    }

    // Log error (never expose stack in production)
    if (process.env.NODE_ENV !== 'production' && err && err.stack) {
        console.error('Error stack:', err.stack);
    }

    return error(res, message, statusCode, code, details);
}

// ============================================
// Exports
// ============================================

module.exports = {
    // Constants
    HTTP_STATUS: HTTP_STATUS,

    // Success
    success: success,
    created: created,
    paginated: paginated,
    noContent: noContent,

    // Errors
    error: error,
    badRequest: badRequest,
    unauthorized: unauthorized,
    forbidden: forbidden,
    notFound: notFound,
    conflict: conflict,
    validationError: validationError,
    tooManyRequests: tooManyRequests,
    internalError: internalError,
    serviceUnavailable: serviceUnavailable,
    gatewayTimeout: gatewayTimeout,

    // Middleware
    notFoundMiddleware: notFoundMiddleware,
    errorMiddleware: errorMiddleware
};