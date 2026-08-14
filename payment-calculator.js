// payment-calculator.js - النسخة المحدثة لمرونة نقاط البيع والتعاقدات الزراعية

class GavPaymentCalculator {
    /**
     * احتساب فاتورة نقطة البيع أو عقد الضمان الزراعي بنسبة توافقية
     * @param {BigInt} invoiceTotalInYCOIN - الإجمالي الكلي للفاتورة بالوحدات الصغرى للعملة المحلية
     * @param {BigInt} customGcvRateInYCOIN - سعر عملة Pi المتوافق عليه في العقد/الصفقة بناءً على GCV
     * @param {number} agreedPiPercentage - النسبة المئوية المخصصة للدفع بـ Pi من قِبل الطرفين (0 - 100)
     */
    static calculateSplitInvoice(invoiceTotalInYCOIN, customGcvRateInYCOIN, agreedPiPercentage) {
        if (agreedPiPercentage < 0 || agreedPiPercentage > 100) {
            throw new Error("Percentage must be between 0 and 100");
        }

        const percentageBigInt = BigInt(agreedPiPercentage);
        const hundredBigInt = 100n;

        // حساب حصة العملة المحلية المستقرة وحصة الـ Pi بناءً على النسبة التوافقية الحرة
        const yerInvoiceShare = (invoiceTotalInYCOIN * (hundredBigInt - percentageBigInt)) / hundredBigInt;
        const piInvoiceShare = invoiceTotalInYCOIN - yerInvoiceShare; // منع معالجة الكسور المفقودة

        const piStroopsPrecision = 10000000n; // دقة الـ Pi البالغة 7 أصفار (Stroops)
        let finalPiRequiredInStroops = 0n;

        if (piInvoiceShare > 0n && customGcvRateInYCOIN > 0n) {
            finalPiRequiredInStroops = (piInvoiceShare * piStroopsPrecision) / customGcvRateInYCOIN;
        }

        return {
            status: "CALCULATED",
            piPercentage: agreedPiPercentage,
            yerPercentage: 100 - agreedPiPercentage,
            yerAmountToPay: yerInvoiceShare.toString(),
            piAmountToPayInStroops: finalPiRequiredInStroops.toString()
        };
    }
}

module.exports = GavPaymentCalculator;
