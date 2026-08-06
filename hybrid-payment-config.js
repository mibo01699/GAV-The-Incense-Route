// ============================================================
// الملف: hybrid-payment-config.js
// المسار: GAV/hybrid-payment-config.js
// الدور: تكوين الدفع الهجين مع GCV قابلة للتعديل
// ============================================================

const HYBRID_CONFIG = {
    // قراءة قيمة GCV من متغير بيئي أو استخدام قيمة افتراضية
    GCV_VALUE_USD: process.env.GCV_VALUE_USD 
        ? parseFloat(process.env.GCV_VALUE_USD) 
        : 314159, // قيمة افتراضية

    // سعر صرف YER من متغير بيئي
    YER_TO_USD_RATE: process.env.YER_TO_USD_RATE 
        ? parseFloat(process.env.YER_TO_USD_RATE) 
        : 0.0007,

    // النسب الافتراضية (قابلة للتكوين عبر API)
    DEFAULT_PI_PERCENT: 5,
    DEFAULT_YER_PERCENT: 95,
};

module.exports = { HYBRID_CONFIG };