// gav-server-router.js - تحديث نقطة بيع المحاصيل الزراعية وصرف المساعدات
const express = require('express');
const router = express.Router();
const GavPaymentCalculator = require('./payment-calculator');

router.post('/api/pos/process-invoice', async (req, res) => {
    try {
        const { 
            invoiceId, 
            invoiceTotalInYCOIN, 
            customGcvRateInYCOIN, 
            agreedPiPercentage 
        } = req.body;

        // معالجة الحسابات بنظام BigInt الحامي من ثغرات التقريب
        const invoiceResult = GavPaymentCalculator.calculateSplitInvoice(
            BigInt(invoiceTotalInYCOIN),
            BigInt(customGcvRateInYCOIN),
            parseInt(agreedPiPercentage, 10)
        );

        // إرجاع خطة السداد لنقطة البيع لتهيئتها لعقد الضمان الذكي أو الـ SDK
        return res.status(200).json({
            success: true,
            invoiceId: invoiceId,
            splitData: invoiceResult
        });

    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
});

module.exports = router;
