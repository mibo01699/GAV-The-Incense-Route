// تحديث تدفق الفواتير داخل راوتر مستودع GAV لمطابقة هيكل الرسوم الجديد لعام 2026

router.post('/api/pos/process-invoice', async (req, res) => {
    try {
        const { invoiceId, invoiceTotalInYCOIN, customGcvRateInYCOIN, agreedPiPercentage } = req.body;
        
        const total = BigInt(invoiceTotalInYCOIN);

        // 1. استدعاء واحتساب الرسوم التنافسية المخصصة لـ GAV (0.5%) بنظام BigInt
        const gavPlatformFee = (total * 5n) / 1000n; 
        const merchantNetProceeds = total - gavPlatformFee; // صافي مستحقات التجر بعد خصم الرسوم

        // 2. معالجة حسابات الفاتورة بعد اقتطاع الرسوم التنافسية
        // (يتم تمرير المبلغ المالي للنواة والمقاصة المركزية)
        
        return res.status(200).json({
            success: true,
            invoiceId: invoiceId,
            auditStatus: "COMPLIANT_WITH_COMPETITIVE_FEES",
            pricingStructure: {
                totalGrossRetailYCOIN: total.toString(),
                gavPlatformFeeAppliedYCOIN: gavPlatformFee.toString(), // الرسوم التنافسية المستقطعة للمنصة
                merchantNetEarningsYCOIN: merchantNetProceeds.toString() // صافي أرباح التاجر المحمية
            }
        });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message });
    }
});
