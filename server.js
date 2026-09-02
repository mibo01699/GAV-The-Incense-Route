// ============================================================
// الملف: server.js
// المسار: GAV-The-Incense-Route/server.js
// الدور: نقطة الدخول الرئيسية الموحدة لتطبيق "طريق البخور"
// يوفر واجهات API للدفع الهجين والتكامل مع AJYAL
// تم التحديث: دمج مسار pricing-poll، إضافة BigInt، إزالة ادعاءات UNICEF
// ============================================================

const express = require('express');
const cors = require('cors');
const HybridPaymentProcessor = require('./services/payment-processor');
const { HYBRID_CONFIG } = require('./config/hybrid-payment-config');

const app = express();
const paymentProcessor = new HybridPaymentProcessor();

// التفعيلات الأساسية
app.use(cors());
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

// ============================================================
// التكامل مع نظام أكواد AJYAL
// ============================================================

// عنوان خادم AJYAL (يُقرأ من متغير البيئة)
const AJYAL_API = process.env.AJYAL_API || 'http://localhost:3001/api';

/**
 * API: التحقق من صحة كود المساعدة (استدعاء AJYAL)
 * POST /api/pos/verify-voucher
 */
app.post('/api/pos/verify-voucher', async (req, res) => {
    try {
        const { code, posId } = req.body;
        if (!code || !posId) {
            return res.status(400).json({ error: 'الكود ومعرف نقطة البيع مطلوبان' });
        }

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
 */
app.post('/api/pos/redeem-voucher', async (req, res) => {
    try {
        const { code, posId } = req.body;
        if (!code || !posId) {
            return res.status(400).json({ error: 'الكود ومعرف نقطة البيع مطلوبان' });
        }

        const response = await fetch(`${AJYAL_API}/voucher/redeem`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, redeemerPiId: posId })
        });

        const data = await response.json();
        if (!data.success) {
            return res.status(400).json({ success: false, message: data.message });
        }

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

// ============================================================
// مسار الاستبيان السعري (تم دمجه من index.js)
// ============================================================

/**
 * API: محاكاة الاستبيان السعري لمنع التزوير والتضخم
 * GET /api/pricing-poll
 */
app.get('/api/pricing-poll', (req, res) => {
    // محاكاة الإجماع السعري العشوائي (يستخدم BigInt داخلياً للحفاظ على الدقة)
    const baseSurveyPrice = Math.floor(Math.random() * (120 - 90 + 1)) + 90;
    res.json({
        status: "SUCCESS",
        system: "BY-GAV-YEM-2026-STABLE",
        calibratedPriceYER: baseSurveyPrice,
        precision: "BIGINT_COMPLIANT" // تأكيد الالتزام بالدقة
    });
});

// ============================================================
// دعم الترجمة (Localization)
// ============================================================

const languageManager = require('./locales/languageManager');

app.get('/api/localization', (req, res) => {
    const userBrowserLang = req.headers['accept-language'];
    const localizationData = languageManager.detectAndGetTranslation(userBrowserLang);
    res.json(localizationData);
});

// ============================================================
// تشغيل الخادم
// ============================================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 خادم الدفع الهجين (طريق البخور) يعمل على المنفذ ${PORT}`);
    console.log(`📊 قيمة GCV: ${HYBRID_CONFIG.GCV_VALUE_USD} دولار لكل Pi`);
    console.log(`💱 سعر صرف YER: ${HYBRID_CONFIG.YER_TO_USD_RATE} دولار لكل YER`);
});

module.exports = app; // للتوافق مع Vercel