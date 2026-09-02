// gav-pos-engine-v2.js - محرك نقاط البيع الهجين
// يستخدم BigInt حصرياً للعمليات المالية

const { HYBRID_CONFIG } = require('./hybrid-payment-config');

class GavPOSEngine {
    constructor() {
        this.gcvValue = BigInt(HYBRID_CONFIG.GCV_VALUE_USD * 100); // تحويل إلى سنتات
        this.yerToUsdRate = BigInt(HYBRID_CONFIG.YER_TO_USD_RATE * 100);
    }

    calculateSplit(productPriceUSD, piPercent, yerPercent) {
        // تحويل المبلغ إلى BigInt (باستخدام سنتات)
        const priceInCents = BigInt(Math.round(productPriceUSD * 100));
        const piRatio = BigInt(piPercent);
        const yerRatio = BigInt(yerPercent);

        const piAmount = (priceInCents * piRatio) / 100n;
        const yerAmount = (priceInCents * yerRatio) / 100n;

        return {
            piAmount: piAmount.toString(),
            yerAmount: yerAmount.toString(),
            precision: 'BIGINT_COMPLIANT'
        };
    }
}

module.exports = GavPOSEngine;