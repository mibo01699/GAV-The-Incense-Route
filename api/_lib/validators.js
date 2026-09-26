// ============================================
// GAV | Input Validators
// File: api/_lib/validators.js
// ============================================
// All validation uses integer arithmetic.
// No float. No parseFloat. No NaN.
// ============================================

'use strict';

// ============================================
// Constants (integers only)
// ============================================

const LIMITS = {
    NAME_MIN: 2,
    NAME_MAX: 200,
    TITLE_MIN: 2,
    TITLE_MAX: 200,
    DESCRIPTION_MAX: 2000,
    LOCATION_MAX: 500,
    URL_MAX: 1000,
    USERNAME_MIN: 2,
    USERNAME_MAX: 50,
    QUANTITY_MIN: 1,
    QUANTITY_MAX: 1000000,
    STOCK_MIN: 0,
    STOCK_MAX: 1000000,
    PRICE_USD_MIN: 1,        // cents (integer)
    PRICE_USD_MAX: 100000000000, // 1 billion USD in cents
    PRICE_PI_MIN: 1,         // micro-Pi (integer)
    PRICE_PI_MAX: 1000000000000000, // 1 billion Pi in micro
    PRICE_YER_MIN: 1,        // micro-YER (integer)
    PRICE_YER_MAX: 1000000000000000, // 1 billion YER in micro
    TOKEN_MIN: 10,
    TOKEN_MAX: 500,
    ID_MIN: 5,
    ID_MAX: 200
};

// ============================================
// Primitive Type Checks
// ============================================

/**
 * Checks if value is a non-empty string.
 */
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Checks if value is a string within length range.
 */
function isString(value, minLength, maxLength) {
    if (typeof value !== 'string') return false;
    const len = value.length;
    if (Number.isInteger(minLength) && len < minLength) return false;
    if (Number.isInteger(maxLength) && len > maxLength) return false;
    return true;
}

/**
 * Checks if value is an integer.
 * Rejects floats, NaN, Infinity.
 */
function isInteger(value) {
    return Number.isInteger(value);
}

/**
 * Checks if value is an integer within range.
 */
function isIntegerInRange(value, min, max) {
    if (!Number.isInteger(value)) return false;
    if (Number.isInteger(min) && value < min) return false;
    if (Number.isInteger(max) && value > max) return false;
    return true;
}

/**
 * Checks if value is a positive integer (> 0).
 */
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}

/**
 * Checks if value is a non-negative integer (>= 0).
 */
function isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
}

/**
 * Checks if value is a valid BigInt.
 */
function isBigInt(value) {
    return typeof value === 'bigint';
}

/**
 * Checks if value is a positive BigInt (> 0n).
 */
function isPositiveBigInt(value) {
    return typeof value === 'bigint' && value > 0n;
}

/**
 * Checks if value is a non-negative BigInt (>= 0n).
 */
function isNonNegativeBigInt(value) {
    return typeof value === 'bigint' && value >= 0n;
}

// ============================================
// Format Checks
// ============================================

/**
 * Checks if value is a valid UUID v4.
 */
function isUuid(value) {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Checks if value is a valid GAV ID (prefix_timestamp_random).
 */
function isGavId(value) {
    if (typeof value !== 'string') return false;
    return /^[a-z]+_[a-z0-9]+_[a-f0-9]+$/i.test(value);
}

/**
 * Checks if value is a valid GAV account number.
 */
function isGavAccountNumber(value) {
    if (typeof value !== 'string') return false;
    return /^GAV-01-\d{10}$/.test(value);
}

/**
 * Checks if value is a valid Pi UID.
 */
function isPiUid(value) {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Checks if value is a valid email (basic).
 */
function isEmail(value) {
    if (typeof value !== 'string') return false;
    if (value.length > 200) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

// ============================================
// Category Validation
// ============================================

const VALID_CATEGORIES = [
    'incense',
    'luban',
    'dates',
    'textiles',
    'handicrafts',
    'food',
    'vegetables',
    'meat',
    'fish',
    'beverages',
    'coffee',
    'honey',
    'spices',
    'gold',
    'silver',
    'clothing',
    'accessories',
    'cosmetics',
    'electronics',
    'smartphones',
    'hardware',
    'home',
    'agriculture',
    'medicines',
    'supplements',
    'sanitary',
    'constructionTools',
    'constructionMaterials',
    'electricalTools',
    'plumbingTools',
    'tiles',
    'ceramics',
    'vehicles',
    'others'
];

function isValidCategory(value) {
    return VALID_CATEGORIES.indexOf(value) !== -1;
}

// ============================================
// Business Validators
// ============================================

/**
 * Validates product input.
 * Returns: { valid: boolean, errors: string[] }
 */
function validateProduct(product) {
    const errors = [];

    if (!product || typeof product !== 'object') {
        return { valid: false, errors: ['Product data is required'] };
    }

    // Name
    if (!isString(product.name, LIMITS.NAME_MIN, LIMITS.NAME_MAX)) {
        errors.push('Product name must be between ' + LIMITS.NAME_MIN + ' and ' + LIMITS.NAME_MAX + ' characters');
    }

    // Type (optional)
    if (product.type !== undefined && product.type !== null) {
        if (!isString(product.type, 0, 100)) {
            errors.push('Product type must be at most 100 characters');
        }
    }

    // Category
    if (product.category !== undefined && !isValidCategory(product.category)) {
        errors.push('Product category is invalid');
    }

    // Quantity (integer)
    if (product.quantity !== undefined) {
        if (!isIntegerInRange(product.quantity, LIMITS.QUANTITY_MIN, LIMITS.QUANTITY_MAX)) {
            errors.push('Quantity must be an integer between ' + LIMITS.QUANTITY_MIN + ' and ' + LIMITS.QUANTITY_MAX);
        }
    }

    // Stock (integer)
    if (product.stock !== undefined) {
        if (!isIntegerInRange(product.stock, LIMITS.STOCK_MIN, LIMITS.STOCK_MAX)) {
            errors.push('Stock must be an integer between ' + LIMITS.STOCK_MIN + ' and ' + LIMITS.STOCK_MAX);
        }
    }

    // Price USD (cents, integer)
    if (product.priceUSD !== undefined) {
        if (!isIntegerInRange(product.priceUSD, LIMITS.PRICE_USD_MIN, LIMITS.PRICE_USD_MAX)) {
            errors.push('Price USD must be a positive integer (cents)');
        }
    }

    // Price Pi (micro-Pi, integer)
    if (product.pricePi !== undefined) {
        if (!isIntegerInRange(product.pricePi, LIMITS.PRICE_PI_MIN, LIMITS.PRICE_PI_MAX)) {
            errors.push('Price Pi must be a positive integer (micro-Pi)');
        }
    }

    // Price YER (micro-YER, integer)
    if (product.priceYER !== undefined) {
        if (!isIntegerInRange(product.priceYER, LIMITS.PRICE_YER_MIN, LIMITS.PRICE_YER_MAX)) {
            errors.push('Price YER must be a positive integer (micro-YER)');
        }
    }

    // Description (optional)
    if (product.description !== undefined && product.description !== null) {
        if (!isString(product.description, 0, LIMITS.DESCRIPTION_MAX)) {
            errors.push('Description must be at most ' + LIMITS.DESCRIPTION_MAX + ' characters');
        }
    }

    // Direct sale address (optional)
    if (product.directSaleAddress !== undefined && product.directSaleAddress !== null) {
        if (!isString(product.directSaleAddress, 0, LIMITS.LOCATION_MAX)) {
            errors.push('Direct sale address must be at most ' + LIMITS.LOCATION_MAX + ' characters');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validates festival input.
 */
function validateFestival(festival) {
    const errors = [];

    if (!festival || typeof festival !== 'object') {
        return { valid: false, errors: ['Festival data is required'] };
    }

    if (!isString(festival.title, LIMITS.TITLE_MIN, LIMITS.TITLE_MAX)) {
        errors.push('Festival title must be between ' + LIMITS.TITLE_MIN + ' and ' + LIMITS.TITLE_MAX + ' characters');
    }

    if (festival.description !== undefined && festival.description !== null) {
        if (!isString(festival.description, 0, LIMITS.DESCRIPTION_MAX)) {
            errors.push('Description must be at most ' + LIMITS.DESCRIPTION_MAX + ' characters');
        }
    }

    if (festival.location !== undefined && festival.location !== null) {
        if (!isString(festival.location, 0, LIMITS.LOCATION_MAX)) {
            errors.push('Location must be at most ' + LIMITS.LOCATION_MAX + ' characters');
        }
    }

    if (festival.directSaleAddress !== undefined && festival.directSaleAddress !== null) {
        if (!isString(festival.directSaleAddress, 0, LIMITS.LOCATION_MAX)) {
            errors.push('Direct sale address must be at most ' + LIMITS.LOCATION_MAX + ' characters');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validates individual exchange input.
 */
function validateIndividualExchange(exchange) {
    const errors = [];

    if (!exchange || typeof exchange !== 'object') {
        return { valid: false, errors: ['Exchange data is required'] };
    }

    if (!isString(exchange.productName, LIMITS.NAME_MIN, LIMITS.NAME_MAX)) {
        errors.push('Product name must be between ' + LIMITS.NAME_MIN + ' and ' + LIMITS.NAME_MAX + ' characters');
    }

    if (!isIntegerInRange(exchange.pricePi, LIMITS.PRICE_PI_MIN, LIMITS.PRICE_PI_MAX)) {
        errors.push('Price Pi must be a positive integer (micro-Pi)');
    }

    if (exchange.quantity !== undefined) {
        if (!isIntegerInRange(exchange.quantity, LIMITS.QUANTITY_MIN, LIMITS.QUANTITY_MAX)) {
            errors.push('Quantity must be an integer');
        }
    }

    // GPS coordinates (micro-degrees, integer)
    if (exchange.latitude !== undefined) {
        if (!isIntegerInRange(exchange.latitude, -90000000, 90000000)) {
            errors.push('Latitude must be integer micro-degrees');
        }
    }

    if (exchange.longitude !== undefined) {
        if (!isIntegerInRange(exchange.longitude, -180000000, 180000000)) {
            errors.push('Longitude must be integer micro-degrees');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Validates vote input.
 */
function validateVote(vote) {
    const errors = [];

    if (!vote || typeof vote !== 'object') {
        return { valid: false, errors: ['Vote data is required'] };
    }

    const validSymbols = ['👍', '👎', '🤑', '🥳', '🤠', '😱', '🤬'];
    if (validSymbols.indexOf(vote.symbol) === -1) {
        errors.push('Invalid vote symbol');
    }

    if (!isString(vote.targetId, LIMITS.ID_MIN, LIMITS.ID_MAX)) {
        errors.push('Target ID is invalid');
    }

    if (!isString(vote.targetType, 2, 50)) {
        errors.push('Target type is invalid');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

// ============================================
// Exports
// ============================================

module.exports = {
    // Constants
    LIMITS: LIMITS,
    VALID_CATEGORIES: VALID_CATEGORIES,

    // Primitives
    isNonEmptyString: isNonEmptyString,
    isString: isString,
    isInteger: isInteger,
    isIntegerInRange: isIntegerInRange,
    isPositiveInteger: isPositiveInteger,
    isNonNegativeInteger: isNonNegativeInteger,
    isBigInt: isBigInt,
    isPositiveBigInt: isPositiveBigInt,
    isNonNegativeBigInt: isNonNegativeBigInt,

    // Formats
    isUuid: isUuid,
    isGavId: isGavId,
    isGavAccountNumber: isGavAccountNumber,
    isPiUid: isPiUid,
    isEmail: isEmail,

    // Categories
    isValidCategory: isValidCategory,

    // Business
    validateProduct: validateProduct,
    validateFestival: validateFestival,
    validateIndividualExchange: validateIndividualExchange,
    validateVote: validateVote
};