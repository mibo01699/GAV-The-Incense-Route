// ============================================================
// الملف: server.js (متوافق مع Vercel Serverless)
// الدور: نقطة الدخول الرئيسية الموحدة
// تم التحديث: إزالة app.listen()، تصدير التطبيق كدالة
// ============================================================

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ============================================================
// مسار الصحة (Health Check) - ضروري لـ Vercel
// ============================================================
app.get('/api/health', (req, res) => {
    res.json({
        status: 'online',
        service: 'GAV-The-Incense-Route',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

// ============================================================
// المسار الرئيسي (للتحقق من عمل الخادم)
// ============================================================
app.get('/', (req, res) => {
    res.json({
        message: '🚀 GAV-The-Incense-Route API is running',
        documentation: '/api/health',
        endpoints: [
            '/api/health',
            '/api/pricing-poll',
            '/api/pos/verify-voucher',
            '/api/pos/redeem-voucher',
            '/api/localization'
        ]
    });
});

// ============================================================
// مسار الاستبيان السعري
// ============================================================
app.get('/api/pricing-poll', (req, res) => {
    const baseSurveyPrice = Math.floor(Math.random() * (120 - 90 + 1)) + 90;
    res.json({
        status: "SUCCESS",
        system: "BY-GAV-YEM-2026-STABLE",
        calibratedPriceYER: baseSurveyPrice,
        precision: "BIGINT_COMPLIANT"
    });
});

// ============================================================
// التكامل مع نظام أكواد AJYAL
// ============================================================
const AJYAL_API = process.env.AJYAL_API || 'http://localhost:3001/api';

app.post('/api/pos/verify-voucher', async (req, res) => {
    try {
        const { code, posId } = req.body;
        if (!code || !posId) {
            return res.status(400).json({ error: 'الكود ومعرف نقطة البيع مطلوبان' });
        }

        // محاكاة التحقق (في حالة عدم توفر AJYAL)
        // في البيئة الحقيقية، يتم استدعاء AJYAL_API
        res.json({
            success: true,
            voucher: { code, amount: 100, type: 'food_basket' },
            message: 'الكود صالح للصرف (محاكاة)'
        });

    } catch (error) {
        console.error('خطأ في التحقق من الكود:', error);
        res.status(500).json({ error: 'فشل في التحقق من الكود' });
    }
});

app.post('/api/pos/redeem-voucher', async (req, res) => {
    try {
        const { code, posId } = req.body;
        if (!code || !posId) {
            return res.status(400).json({ error: 'الكود ومعرف نقطة البيع مطلوبان' });
        }

        console.log(`✅ تم صرف الكود ${code} في نقطة البيع ${posId}`);

        res.json({
            success: true,
            message: 'تم صرف الكود بنجاح (محاكاة)',
            voucher: { code, redeemedAt: new Date().toISOString() }
        });

    } catch (error) {
        console.error('خطأ في صرف الكود:', error);
        res.status(500).json({ error: 'فشل في صرف الكود' });
    }
});

// ============================================================
// دعم الترجمة (Localization)
// ============================================================
try {
    const languageManager = require('./locales/languageManager');
    app.get('/api/localization', (req, res) => {
        const userBrowserLang = req.headers['accept-language'];
        const localizationData = languageManager.detectAndGetTranslation(userBrowserLang);
        res.json(localizationData);
    });
} catch (error) {
    app.get('/api/localization', (req, res) => {
        res.json({ message: 'Localization service unavailable', fallback: 'en' });
    });
}

// ============================================================
// ✅ نقطة الدخول لـ Vercel (تصدير التطبيق)
// ============================================================
module.exports = app;