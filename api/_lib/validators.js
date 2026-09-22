// ============================================
// GAV | Input Validators
// ============================================

/**
 * التحقق من نص
 */
function isString(value, minLength, maxLength) {
    if (typeof value !== 'string') return false;
    if (minLength !== undefined && value.length < minLength) return false;
    if (maxLength !== undefined && value.length > maxLength) return false;
    return true;
}

/**
 * التحقق من رقم
 */
function isNumber(value, min, max) {
    const num = parseFloat(value);
    if (isNaN(num)) return false;
    if (min !== undefined && num < min) return false;
    if (max !== undefined && num > max) return false;
    return true;
}

/**
 * التحقق من UUID
 */
function isUuid(value) {
    if (typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * التحقق من فئة منتج
 */
const VALID_CATEGORIES = [
    'incense', 'luban', 'dates', 'textiles', 'handicrafts',
    'food', 'vegetables', 'meat', 'fish', 'beverages',
    'coffee', 'honey', 'spices', 'gold', 'silver',
    'clothing', 'accessories', 'cosmetics', 'electronics',
    'smartphones', 'hardware', 'home', 'agriculture',
    'medicines', 'supplements', 'sanitary', 'constructionTools',
    'constructionMaterials', 'electricalTools', 'plumbingTools',
    'tiles', 'ceramics', 'vehicles', 'others'
];

function isValidCategory(value) {
    return VALID_CATEGORIES.indexOf(value) !== -1;
}

/**
 * التحقق من صحة المنتج
 */
function validateProduct(product) {
    const errors = [];

    if (!isString(product.name, 2, 200)) {
        errors.push('اسم المنتج مطلوب (2-200 حرف)');
    }

    if (product.type && !isString(product.type, 1, 100)) {
        errors.push('النوع غير صالح');
    }

    if (product.quantity !== undefined && !isNumber(product.quantity, 1, 1000000)) {
        errors.push('الكمية يجب أن تكون بين 1 و 1,000,000');
    }

    if (product.stock !== undefined && !isNumber(product.stock, 0, 1000000)) {
        errors.push('المخزون يجب أن يكون بين 0 و 1,000,000');
    }

    if (product.priceUSD !== undefined && !isNumber(product.priceUSD, 0.01, 1000000000)) {
        errors.push('قيمة المنتج بالدولار يجب أن تكون موجبة');
    }

    if (product.category && !isValidCategory(product.category)) {
        errors.push('الفئة غير صالحة');
    }

    if (product.description && !isString(product.description, 0, 2000)) {
        errors.push('الوصف يجب أن يكون أقل من 2000 حرف');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * التحقق من صحة المهرجان
 */
function validateFestival(festival) {
    const errors = [];

    if (!isString(festival.title, 2, 200)) {
        errors.push('عنوان المهرجان مطلوب (2-200 حرف)');
    }

    if (festival.description && !isString(festival.description, 0, 2000)) {
        errors.push('الوصف يجب أن يكون أقل من 2000 حرف');
    }

    if (festival.location && !isString(festival.location, 0, 500)) {
        errors.push('الموقع غير صالح');
    }

    if (festival.directSaleAddress && !isString(festival.directSaleAddress, 0, 500)) {
        errors.push('عنوان البيع المباشر غير صالح');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * التحقق من عرض المقايضة
 */
function validateOffer(offer) {
    const errors = [];

    if (!isString(offer.name, 2, 200)) {
        errors.push('اسم العرض مطلوب (2-200 حرف)');
    }

    if (!isNumber(offer.pricePi, 0.0000000001, 1000000)) {
        errors.push('السعر بـ Pi يجب أن يكون موجباً');
    }

    if (offer.quantity !== undefined && !isNumber(offer.quantity, 1, 1000000)) {
        errors.push('الكمية غير صالحة');
    }

    return {
        valid: errors.length === 0,
        errors: errors
    };
}

module.exports = {
    isString: isString,
    isNumber: isNumber,
    isUuid: isUuid,
    isValidCategory: isValidCategory,
    validateProduct: validateProduct,
    validateFestival: validateFestival,
    validateOffer: validateOffer,
    VALID_CATEGORIES: VALID_CATEGORIES
};