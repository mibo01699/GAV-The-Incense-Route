// ============================================================
// الملف: server.js
// المسار: GAV-The-Incense-Route/server.js
// الدور: نقطة الدخول الرئيسية لتطبيق "طريق البخور"، يوفر واجهات API للدفع الهجين
// ============================================================

const express = require('express');
const HybridPaymentProcessor = require('./services/payment-processor');
const { HYBRID_CONFIG } = require('./config/hybrid-payment-config');

const app = express();
const paymentProcessor = new HybridPaymentProcessor();

app.use(express.json());

// --- API: حساب قيمة الدفع الهجين (بدون تنفيذ) ---
app.post('/api/calculate-payment', (req, res) => {
    try {
        const { productPriceUSD, piPercent, yerPercent } = req.body;
        const result = paymentProcessor.calculator.calculatePaymentSplit(
            productPriceUSD,
            piPercent,
            yerPercent
        );
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// --- API: تنفيذ الدفع الهجين الكامل ---
app.post('/api/process-payment', async (req, res) => {
    try {
        const paymentRequest = req.body;
        const result = await paymentProcessor.processHybridPayment(paymentRequest);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// --- API: تحديث نسب الدفع للبائع ---
app.post('/api/update-ratios', (req, res) => {
    try {
        const { piPercent, yerPercent } = req.body;
        paymentProcessor.updateSellerRatios(piPercent, yerPercent);
        res.json({
            success: true,
            message: `تم تحديث النسب إلى Pi=${piPercent}%, YER=${yerPercent}%`
        });
    } catch (error) {
        res.status(400).json({ success: false, error: error.message });
    }
});

// --- API: الحصول على التكوين الحالي ---
app.get('/api/config', (req, res) => {
    res.json({
        success: true,
        data: {
            gcvValueUSD: HYBRID_CONFIG.GCV_VALUE_USD,
            yerToUsdRate: HYBRID_CONFIG.YER_TO_USD_RATE,
            defaultPiPercent: HYBRID_CONFIG.DEFAULT_PI_PERCENT,
            defaultYerPercent: HYBRID_CONFIG.DEFAULT_YER_PERCENT
        }
    });
});

// --- تشغيل الخادم ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 خادم الدفع الهجين (طريق البخور) يعمل على المنفذ ${PORT}`);
    console.log(`📊 قيمة GCV: ${HYBRID_CONFIG.GCV_VALUE_USD} دولار لكل Pi`);
    console.log(`💱 سعر صرف YER: ${HYBRID_CONFIG.YER_TO_USD_RATE} دولار لكل YER`);
});


// ============================================================
// إضافة إلى GAV/server.js (التكامل مع نظام أكواد AJYAL)
// ============================================================

// عنوان خادم AJYAL (يجب تعيينه كمتغير بيئي)
const AJYAL_API = process.env.AJYAL_API || 'http://localhost:3001/api';

/**
 * API: التحقق من صحة كود المساعدة (استدعاء AJYAL)
 * POST /api/pos/verify-voucher
 * Body: { "code": "ABCD1234...", "posId": "GABC..." }
 */
app.post('/api/pos/verify-voucher', async (req, res) => {
    try {
        const { code, posId } = req.body;
        if (!code || !posId) {
            return res.status(400).json({ error: 'الكود ومعرف نقطة البيع مطلوبان' });
        }

        // استدعاء واجهة AJYAL للتحقق
        const response = await fetch(`${AJYAL_API}/voucher/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redeemerPiId: posId })
        });

        const data = await response.json();
        if (!data.success) {
            return res.status(400).json({ success: false, message: data.message });
        }

        res.json({
            success: true,
            voucher: data.voucher,
            message: 'الكود صالح للصرف'
        });

    } catch (error) {
        console.error('خطأ في التحقق من الكود:', error);
        res.status(500).json({ error: 'فشل في التحقق من الكود' });
    }
});

/**
 * API: صرف الكود (استبدال السلع)
 * POST /api/pos/redeem-voucher
 * Body: { "code": "ABCD1234...", "posId": "GABC..." }
 */
app.post('/api/pos/redeem-voucher', async (req, res) => {
    try {
        const { code, posId } = req.body;
        if (!code || !posId) {
            return res.status(400).json({ error: 'الكود ومعرف نقطة البيع مطلوبان' });
        }

        // استدعاء واجهة AJYAL لصرف الكود
        const response = await fetch(`${AJYAL_API}/voucher/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redeemerPiId: posId })
        });

        const data = await response.json();
        if (!data.success) {
            return res.status(400).json({ success: false, message: data.message });
        }

        // هنا يمكن إضافة منطق لتسجيل عملية الصرف محلياً في GAV
        console.log(`✅ تم صرف الكود ${code} في نقطة البيع ${posId}`);

        res.json({
            success: true,
            message: data.message,
            voucher: data.voucher
        });

    } catch (error) {
        console.error('خطأ في صرف الكود:', error);
        res.status(500).json({ error: 'فشل في صرف الكود' });
    }
});

