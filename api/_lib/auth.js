// ============================================
// GAV | Authentication Middleware
// File: api/_lib/auth.js
// ============================================
// Server-side Pi token verification.
// No client trust. No floats.
// ============================================

'use strict';

const piPlatform = require('./pi-platform');
const db = require('./db');

// ============================================
// Constants (integers only)
// ============================================

const TOKEN_MIN_LENGTH = 10;
const TOKEN_MAX_LENGTH = 500;
const TOKEN_HEADER_PREFIX = 'Bearer ';

// ============================================
// 1. Extract Token from Request
// ============================================
// Checks:
//   1. Authorization header (Bearer <token>)
//   2. Request body (accessToken field)
//   3. Query string (accessToken parameter)
// Returns: string or null
// ============================================

function extractAccessToken(req) {
    // 1. Authorization header
    const authHeader = req.headers && req.headers['authorization'];
    if (authHeader && typeof authHeader === 'string') {
        if (authHeader.startsWith(TOKEN_HEADER_PREFIX)) {
            const token = authHeader.substring(TOKEN_HEADER_PREFIX.length).trim();
            if (token.length >= TOKEN_MIN_LENGTH && token.length <= TOKEN_MAX_LENGTH) {
                return token;
            }
        }
    }

    // 2. Request body
    if (req.body && typeof req.body.accessToken === 'string') {
        const token = req.body.accessToken.trim();
        if (token.length >= TOKEN_MIN_LENGTH && token.length <= TOKEN_MAX_LENGTH) {
            return token;
        }
    }

    // 3. Query string
    if (req.query && typeof req.query.accessToken === 'string') {
        const token = req.query.accessToken.trim();
        if (token.length >= TOKEN_MIN_LENGTH && token.length <= TOKEN_MAX_LENGTH) {
            return token;
        }
    }

    return null;
}

// ============================================
// 2. Authentication Middleware (Required)
// ============================================
// Verifies token with Pi Platform.
// Attaches req.user and req.accessToken.
// Returns 401 on failure.
// ============================================

async function requireAuth(req, res, next) {
    // Extract token
    const accessToken = extractAccessToken(req);

    if (!accessToken) {
        return res.status(401).json({
            success: false,
            error: 'Authentication required',
            code: 'AUTH_REQUIRED'
        });
    }

    // Verify with Pi Platform
    const result = await piPlatform.verifyUserToken(accessToken);

    if (!result.ok) {
        // Log security event
        db.logAudit('SECURITY', 'AUTH_FAILED', {
            metadata: {
                reason: result.error,
                ip: req.ip || null,
                path: req.path
            }
        });

        return res.status(result.status || 401).json({
            success: false,
            error: result.error || 'Invalid token',
            code: 'INVALID_TOKEN'
        });
    }

    // Create or fetch user
    const user = db.getOrCreateUser(result.user.uid, result.user.username);

    // Attach to request
    req.user = user;
    req.accessToken = accessToken;

    // Log successful authentication
    db.logAudit('INFO', 'AUTH_SUCCESS', {
        userId: user.uid,
        metadata: {
            username: user.username,
            path: req.path
        }
    });

    next();
}

// ============================================
// 3. Optional Authentication
// ============================================
// If token is present → verify.
// If not present → continue without user.
// Used for public endpoints that can benefit from knowing the user.
// ============================================

async function optionalAuth(req, res, next) {
    const accessToken = extractAccessToken(req);

    if (!accessToken) {
        req.user = null;
        req.accessToken = null;
        return next();
    }

    const result = await piPlatform.verifyUserToken(accessToken);

    if (result.ok) {
        const user = db.getOrCreateUser(result.user.uid, result.user.username);
        req.user = user;
        req.accessToken = accessToken;
    } else {
        req.user = null;
        req.accessToken = null;
    }

    next();
}

// ============================================
// 4. Authorization: Resource Owner
// ============================================
// Verifies that the authenticated user owns the resource.
// getOwnerId: function(req) → returns owner UID or null
// ============================================

function requireOwnership(getOwnerId) {
    return function(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const ownerId = getOwnerId(req);

        if (!ownerId) {
            return res.status(404).json({
                success: false,
                error: 'Resource not found',
                code: 'NOT_FOUND'
            });
        }

        if (ownerId !== req.user.uid) {
            db.logAudit('SECURITY', 'FORBIDDEN_ACCESS', {
                userId: req.user.uid,
                metadata: {
                    attemptedOwner: ownerId,
                    path: req.path
                }
            });

            return res.status(403).json({
                success: false,
                error: 'Forbidden',
                code: 'FORBIDDEN'
            });
        }

        next();
    };
}

// ============================================
// 5. Authorization: Rank Required
// ============================================
// Verifies that the authenticated user has a specific rank or higher.
// Ranks (ascending):
//   regular → formation_ambassador → country_ambassador
//   → international_ambassador → global_ambassador
// ============================================

const RANK_LEVELS = {
    'regular': 0,
    'formation_ambassador': 1,
    'country_ambassador': 2,
    'international_ambassador': 3,
    'global_ambassador': 4
};

function requireRank(minRank) {
    return function(req, res, next) {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
        }

        const userLevel = RANK_LEVELS[req.user.rank] || 0;
        const requiredLevel = RANK_LEVELS[minRank] || 0;

        if (userLevel < requiredLevel) {
            db.logAudit('SECURITY', 'INSUFFICIENT_RANK', {
                userId: req.user.uid,
                metadata: {
                    currentRank: req.user.rank,
                    requiredRank: minRank,
                    path: req.path
                }
            });

            return res.status(403).json({
                success: false,
                error: 'Insufficient rank',
                code: 'INSUFFICIENT_RANK',
                required: minRank,
                current: req.user.rank
            });
        }

        next();
    };
}

// ============================================
// Exports
// ============================================

module.exports = {
    extractAccessToken: extractAccessToken,
    requireAuth: requireAuth,
    optionalAuth: optionalAuth,
    requireOwnership: requireOwnership,
    requireRank: requireRank,
    RANK_LEVELS: RANK_LEVELS
};