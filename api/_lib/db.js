// ============================================
// GAV | In-Memory Database
// File: api/_lib/db.js
// ============================================
// BigInt-only storage. No floats.
// All IDs are strings (generated).
// All timestamps are ISO 8601 strings.
// ============================================

'use strict';

const crypto = require('crypto');

// ============================================
// Constants (integers only)
// ============================================

const YER_DECIMALS = 6;
const YER_MICRO_PER_YER = 1000000n; // 10^6

const GAV_ACCOUNT_PREFIX = 'GAV-01-';
const GAV_ACCOUNT_SEQUENCE_LENGTH = 10;

// ============================================
// Database (in-memory)
// ============================================

const db = {
    // Users
    users: new Map(),

    // Merchants (extended user profiles)
    merchants: new Map(),

    // Products
    products: new Map(),

    // Festivals
    festivals: new Map(),

    // Individual exchanges
    individualExchanges: new Map(),

    // Completed exchanges
    completedExchanges: new Map(),

    // Votes (all 7 layers)
    votes: new Map(), // key: userId:targetType:targetId

    // YER balances (BigInt micro-YER)
    yerBalances: new Map(), // key: userId → BigInt

    // Pi balances (BigInt micro-Pi)
    piBalances: new Map(), // key: userId → BigInt

    // Entitlement grants
    grants: new Map(), // key: userId → Array

    // Ambassador ranks
    ambassadors: new Map(), // key: userId → rank

    // Notifications
    notifications: new Map(), // key: userId → Array

    // Audit logs
    auditLogs: [],

    // Idempotency keys
    idempotencyKeys: new Map(),

    // GPS verifications
    gpsVerifications: [],

    // EXIF verifications
    exifVerifications: [],

    // Counter for GAV account numbers (integer)
    gavAccountCounter: 0
};

// ============================================
// ID Generation
// ============================================

/**
 * Generates a unique ID.
 * Format: prefix_timestamp_random
 * All components are strings (safe for BigInt conversion elsewhere).
 */
function generateId(prefix) {
    const safePrefix = typeof prefix === 'string' ? prefix : 'id';
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return safePrefix + '_' + timestamp + '_' + random;
}

/**
 * Generates a sequential GAV account number.
 * Format: GAV-01-XXXXXXXXXX
 * Uses integer counter (no floats).
 */
function generateGavAccountNumber() {
    db.gavAccountCounter += 1;
    const padded = db.gavAccountCounter.toString().padStart(GAV_ACCOUNT_SEQUENCE_LENGTH, '0');
    return GAV_ACCOUNT_PREFIX + padded;
}

// ============================================
// BigInt Helpers
// ============================================

/**
 * Converts a YER amount (integer) to micro-YER (BigInt).
 * Example: yerToMicro(100) → 100000000n
 */
function yerToMicro(yerInteger) {
    if (!Number.isInteger(yerInteger)) {
        throw new Error('YER amount must be an integer');
    }
    if (yerInteger < 0) {
        throw new Error('YER amount cannot be negative');
    }
    return BigInt(yerInteger) * YER_MICRO_PER_YER;
}

/**
 * Converts micro-YER (BigInt) to display YER (string).
 * Example: microToYerDisplay(1500000n) → '1.500000'
 */
function microToYerDisplay(microYer) {
    if (typeof microYer !== 'bigint') {
        throw new Error('microYer must be a BigInt');
    }

    const isNegative = microYer < 0n;
    const absValue = isNegative ? -microYer : microYer;

    const wholePart = absValue / YER_MICRO_PER_YER;
    const fractionalPart = absValue % YER_MICRO_PER_YER;

    const fractionalStr = fractionalPart.toString().padStart(YER_DECIMALS, '0');
    const sign = isNegative ? '-' : '';

    return sign + wholePart.toString() + '.' + fractionalStr;
}

/**
 * Adds two BigInt micro-YER values safely.
 */
function addMicroYer(a, b) {
    if (typeof a !== 'bigint' || typeof b !== 'bigint') {
        throw new Error('Both values must be BigInt');
    }
    return a + b;
}

/**
 * Subtracts two BigInt micro-YER values safely.
 * Rejects if result would be negative.
 */
function subtractMicroYer(a, b) {
    if (typeof a !== 'bigint' || typeof b !== 'bigint') {
        throw new Error('Both values must be BigInt');
    }
    if (b > a) {
        throw new Error('Insufficient balance');
    }
    return a - b;
}

// ============================================
// User Operations
// ============================================

/**
 * Gets or creates a user by Pi UID.
 */
function getOrCreateUser(uid, username) {
    if (!uid || typeof uid !== 'string') {
        throw new Error('uid must be a non-empty string');
    }
    if (!username || typeof username !== 'string') {
        throw new Error('username must be a non-empty string');
    }

    if (db.users.has(uid)) {
        return db.users.get(uid);
    }

    const user = {
        uid: uid,
        username: username,
        gavAccountNumber: generateGavAccountNumber(),
        photoUrl: null,
        bio: null,
        country: null,
        state: null,
        rank: 'regular', // regular | formation_ambassador | country_ambassador | international_ambassador | global_ambassador
        reputationPoints: 0, // integer
        createdAt: new Date().toISOString()
    };

    db.users.set(uid, user);
    db.yerBalances.set(uid, 0n);
    db.piBalances.set(uid, 0n);
    db.grants.set(uid, []);
    db.notifications.set(uid, []);

    return user;
}

/**
 * Gets a user by Pi UID.
 */
function getUser(uid) {
    if (!uid || typeof uid !== 'string') {
        return null;
    }
    return db.users.get(uid) || null;
}

/**
 * Gets a user by GAV account number.
 */
function getUserByGavAccountNumber(gavAccountNumber) {
    if (!gavAccountNumber || typeof gavAccountNumber !== 'string') {
        return null;
    }
    for (const user of db.users.values()) {
        if (user.gavAccountNumber === gavAccountNumber) {
            return user;
        }
    }
    return null;
}

// ============================================
// YER Balance Operations (BigInt)
// ============================================

/**
 * Gets YER balance in micro-YER (BigInt).
 */
function getYerBalance(uid) {
    if (!db.yerBalances.has(uid)) {
        db.yerBalances.set(uid, 0n);
    }
    return db.yerBalances.get(uid);
}

/**
 * Sets YER balance (micro-YER BigInt).
 */
function setYerBalance(uid, microYer) {
    if (typeof microYer !== 'bigint') {
        throw new Error('Balance must be BigInt');
    }
    if (microYer < 0n) {
        throw new Error('Balance cannot be negative');
    }
    db.yerBalances.set(uid, microYer);
    return microYer;
}

/**
 * Adds to YER balance.
 */
function addYerBalance(uid, microYer) {
    if (typeof microYer !== 'bigint') {
        throw new Error('Amount must be BigInt');
    }
    const current = getYerBalance(uid);
    const newBalance = current + microYer;
    db.yerBalances.set(uid, newBalance);
    return newBalance;
}

/**
 * Subtracts from YER balance.
 */
function subtractYerBalance(uid, microYer) {
    if (typeof microYer !== 'bigint') {
        throw new Error('Amount must be BigInt');
    }
    const current = getYerBalance(uid);
    if (microYer > current) {
        throw new Error('Insufficient YER balance');
    }
    const newBalance = current - microYer;
    db.yerBalances.set(uid, newBalance);
    return newBalance;
}

// ============================================
// Pi Balance Operations (BigInt)
// ============================================

function getPiBalance(uid) {
    if (!db.piBalances.has(uid)) {
        db.piBalances.set(uid, 0n);
    }
    return db.piBalances.get(uid);
}

function addPiBalance(uid, microPi) {
    if (typeof microPi !== 'bigint') {
        throw new Error('Amount must be BigInt');
    }
    const current = getPiBalance(uid);
    const newBalance = current + microPi;
    db.piBalances.set(uid, newBalance);
    return newBalance;
}

function subtractPiBalance(uid, microPi) {
    if (typeof microPi !== 'bigint') {
        throw new Error('Amount must be BigInt');
    }
    const current = getPiBalance(uid);
    if (microPi > current) {
        throw new Error('Insufficient Pi balance');
    }
    const newBalance = current - microPi;
    db.piBalances.set(uid, newBalance);
    return newBalance;
}

// ============================================
// Grants (Entitlements)
// ============================================

/**
 * Records a grant for a user.
 */
function recordGrant(uid, type, amountMicroYer, metadata) {
    if (typeof amountMicroYer !== 'bigint') {
        throw new Error('Grant amount must be BigInt');
    }

    const grant = {
        id: generateId('grant'),
        userId: uid,
        type: type, // 'registration' | 'exchange' | 'vote'
        amountMicroYer: amountMicroYer.toString(), // stored as string for JSON safety
        metadata: metadata || {},
        timestamp: new Date().toISOString()
    };

    const grants = db.grants.get(uid) || [];
    grants.push(grant);
    db.grants.set(uid, grants);

    return grant;
}

function getUserGrants(uid) {
    return db.grants.get(uid) || [];
}

// ============================================
// Idempotency
// ============================================

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkIdempotency(key) {
    if (!key) return null;
    const stored = db.idempotencyKeys.get(key);
    if (!stored) return null;
    if (Date.now() - stored.timestamp > IDEMPOTENCY_TTL_MS) {
        db.idempotencyKeys.delete(key);
        return null;
    }
    return stored.result;
}

function storeIdempotency(key, result) {
    if (!key) return;
    db.idempotencyKeys.set(key, {
        result: result,
        timestamp: Date.now()
    });
}

// ============================================
// Audit Log
// ============================================

function logAudit(level, action, details) {
    const entry = {
        id: generateId('log'),
        level: level,
        action: action,
        userId: details && details.userId ? details.userId : null,
        metadata: details && details.metadata ? details.metadata : {},
        timestamp: new Date().toISOString()
    };
    db.auditLogs.push(entry);
    if (db.auditLogs.length > 10000) {
        db.auditLogs.shift();
    }
    return entry;
}

function getAuditLogs(filter) {
    let logs = db.auditLogs.slice();
    if (filter) {
        if (filter.userId) logs = logs.filter(function(l) { return l.userId === filter.userId; });
        if (filter.level) logs = logs.filter(function(l) { return l.level === filter.level; });
        if (filter.action) logs = logs.filter(function(l) { return l.action === filter.action; });
    }
    return logs.slice(-500);
}

// ============================================
// Exports
// ============================================

module.exports = {
    // Database
    db: db,

    // ID generation
    generateId: generateId,
    generateGavAccountNumber: generateGavAccountNumber,

    // BigInt helpers
    yerToMicro: yerToMicro,
    microToYerDisplay: microToYerDisplay,
    addMicroYer: addMicroYer,
    subtractMicroYer: subtractMicroYer,

    // Constants
    YER_DECIMALS: YER_DECIMALS,
    YER_MICRO_PER_YER: YER_MICRO_PER_YER,

    // Users
    getOrCreateUser: getOrCreateUser,
    getUser: getUser,
    getUserByGavAccountNumber: getUserByGavAccountNumber,

    // YER Balance
    getYerBalance: getYerBalance,
    setYerBalance: setYerBalance,
    addYerBalance: addYerBalance,
    subtractYerBalance: subtractYerBalance,

    // Pi Balance
    getPiBalance: getPiBalance,
    addPiBalance: addPiBalance,
    subtractPiBalance: subtractPiBalance,

    // Grants
    recordGrant: recordGrant,
    getUserGrants: getUserGrants,

    // Idempotency
    checkIdempotency: checkIdempotency,
    storeIdempotency: storeIdempotency,

    // Audit
    logAudit: logAudit,
    getAuditLogs: getAuditLogs
};