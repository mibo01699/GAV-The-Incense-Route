// payment-calculator.js - احتساب الفواتير العادية بناءً على الإجمالي الكلي للعملية التجاريّة
class GavPaymentCalculator {
    static calculateSplitInvoice(invoiceTotalInYCOIN, customGcvRateInYCOIN, agreedPiPercentage) {
        const percentage = BigInt(agreedPiPercentage);
        const yerShare = (invoiceTotalInYCOIN * (100n - percentage)) / 100n;
        const piShare = invoiceTotalInYCOIN - yerShare;

        const piPrecision = 10000000n;
        let finalPiStroops = 0n;

        if (piShare > 0n && customGcvRateInYCOIN > 0n) {
            finalPiStroops = (piShare * piPrecision) / customGcvRateInYCOIN;
        }

        return {
            yerAmountToPay: yerShare.toString(),
            piAmountToPayInStroops: finalPiStroops.toString()
        };
    }
}
module.exports = GavPaymentCalculator;
