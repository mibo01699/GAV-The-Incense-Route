// ============================================================
// الملف: payment-calculator.js
// المسار: GAV-The-Incense-Route/utils/payment-calculator.js
// الدور: حساب قيم الدفع الهجين (Pi/YER) بناءً على سعر المنتج والنسب
// ============================================================

const { HYBRID_CONFIG } = require('../config/hybrid-payment-config');

class HybridPaymentCalculator {
    constructor(config = HYBRID_CONFIG) {
        this.config = config;
    }

    /**
     * حساب تفاصيل الدفع الهجين
     * @param {number} productPriceUSD - سعر المنتج بالدولار
     * @param {number} piPercent - النسبة المئوية للدفع بـ Pi (0-100)
     * @param {number} yerPercent - النسبة المئوية للدفع بـ YER (0-100)
     * @returns {Object} تفاصيل الدفع
     */
    calculatePaymentSplit(productPriceUSD, piPercent = null, yerPercent = null) {
        // استخدام النسب الافتراضية إذا لم يتم تحديدها
        const piRatio = (piPercent !== null) ? piPercent : this.config.DEFAULT_PI_PERCENT;
        const yerRatio = (yerPercent !== null) ? yerPercent : this.config.DEFAULT_YER_PERCENT;

        // التأكد من أن مجموع النسب 100%
        if (piRatio + yerRatio !== 100) {
            throw new Error(`مجموع النسب يجب أن يساوي 100% (الحالي: ${piRatio + yerRatio}%)`);
        }

        // حساب القيم بالدولار
        const piAmountUSD = (productPriceUSD * piRatio) / 100;
        const yerAmountUSD = (productPriceUSD * yerRatio) / 100;

        // تحويل قيم Pi إلى عملة Pi بناءً على GCV
        const piAmountPi = piAmountUSD / this.config.GCV_VALUE_USD;

        // تحويل قيم YER إلى عملة YER بناءً على سعر الصرف
        const yerAmountYER = yerAmountUSD / this.config.YER_TO_USD_RATE;

        return {
            productPriceUSD,
            piPercent: piRatio,
            yerPercent: yerRatio,
            piAmount: {
                usd: piAmountUSD,
                pi: piAmountPi,
                formatted: `${piAmountPi.toFixed(6)} Pi`
            },
            yerAmount: {
                usd: yerAmountUSD,
                yer: yerAmountYER,
                formatted: `${yerAmountYER.toFixed(2)} YER`
            },
            total: {
                usd: productPriceUSD,
                piValueUSD: piAmountUSD,
                yerValueUSD: yerAmountUSD
            }
        };
    }

    /**
     * تحديث النسب بناءً على إعدادات البائع
     * @param {number} newPiPercent - النسبة الجديدة للدفع بـ Pi
     * @param {number} newYerPercent - النسبة الجديدة للدفع بـ YER
     */
    updateSellerRatios(newPiPercent, newYerPercent) {
        if (newPiPercent + newYerPercent !== 100) {
            throw new Error('مجموع النسب يجب أن يساوي 100%');
        }
        this.config.DEFAULT_PI_PERCENT = newPiPercent;
        this.config.DEFAULT_YER_PERCENT = newYerPercent;
        console.log(`تم تحديث النسب: Pi=${newPiPercent}%, YER=${newYerPercent}%`);
    }
}

module.exports = HybridPaymentCalculator;