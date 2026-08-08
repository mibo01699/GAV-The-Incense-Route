// ============================================================
// الملف: clearing-system.js
// المسار: AJYAL/clearing-system.js
// الدور: نظام المقاصة لتسوية مستحقات نقاط البيع
// ============================================================

const { redeemVoucher, getVoucherStats } = require('./voucher-system');

// قاعدة بيانات مؤقتة لنقاط البيع والمستحقات
let posAccounts = {}; // { posId: { name, totalAmount, vouchers: [] } }

/**
 * تسجيل نقطة بيع جديدة
 * @param {string} posId - معرف نقطة البيع
 * @param {string} name - اسم نقطة البيع
 */
const registerPOS = (posId, name) => {
    if (!posAccounts[posId]) {
        posAccounts[posId] = {
            name: name,
            totalAmount: 0,
            vouchers: []
        };
    }
    return posAccounts[posId];
};

/**
 * تسجيل صرف كود (يتم استدعاؤها من GAV بعد الصرف الناجح)
 * @param {string} code - الكود المشفر
 * @param {string} posId - معرف نقطة البيع
 * @param {number} value - القيمة النقدية للكود
 */
const recordVoucherRedeem = (code, posId, value) => {
    if (!posAccounts[posId]) {
        throw new Error(`نقطة البيع ${posId} غير مسجلة في نظام المقاصة`);
    }

    posAccounts[posId].totalAmount += value;
    posAccounts[posId].vouchers.push({
        code: code,
        value: value,
        redeemedAt: new Date().toISOString()
    });

    console.log(`💰 تم تسجيل صرف كود في نقطة البيع ${posId} بقيمة ${value} YER`);
};

/**
 * حساب مستحقات نقطة بيع
 * @param {string} posId - معرف نقطة البيع
 * @returns {Object} المستحقات
 */
const calculatePOSBalance = (posId) => {
    if (!posAccounts[posId]) {
        return { success: false, message: 'نقطة البيع غير موجودة' };
    }
    return {
        success: true,
        posId: posId,
        name: posAccounts[posId].name,
        totalAmount: posAccounts[posId].totalAmount,
        voucherCount: posAccounts[posId].vouchers.length
    };
};

/**
 * تسوية مستحقات نقطة بيع (إرسال طلب دفع إلى BIGISH-YER)
 * @param {string} posId - معرف نقطة البيع
 * @param {string} sourceWalletId - معرف محفظة المصدر (الميزانية العامة)
 * @returns {Promise<Object>} نتيجة التسوية
 */
const settlePOSBalance = async (posId, sourceWalletId) => {
    const balance = calculatePOSBalance(posId);
    if (!balance.success || balance.totalAmount === 0) {
        return { success: false, message: 'لا توجد مستحقات للتسوية' };
    }

    // استدعاء واجهة BIGISH-YER للدفع
    const BIGISH_YER_API = process.env.BIGISH_YER_API || 'http://localhost:5001/api';
    const response = await fetch(`${BIGISH_YER_API}/yer/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            fromWalletId: sourceWalletId,
            toWalletId: posId, // نفترض أن معرف نقطة البيع هو نفسه معرف محفظتها
            amount: balance.totalAmount,
            description: `تسوية مستحقات نقطة البيع ${posId}`
        })
    });

    const result = await response.json();
    if (result.success) {
        // إعادة تعيين المستحقات بعد التسوية
        posAccounts[posId].totalAmount = 0;
        posAccounts[posId].vouchers = [];
        console.log(`✅ تم تسوية مستحقات نقطة البيع ${posId} بمبلغ ${balance.totalAmount} YER`);
    }

    return result;
};

module.exports = {
    registerPOS,
    recordVoucherRedeem,
    calculatePOSBalance,
    settlePOSBalance
};