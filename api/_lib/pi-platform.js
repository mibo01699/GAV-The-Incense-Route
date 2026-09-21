// ============================================
// GAV | Pi Platform API Client
// ============================================

const PI_API_BASE = process.env.PI_API_BASE || 'https://api.minepi.com';
const PI_API_KEY = process.env.PI_API_KEY || '';

/**
 * التحقق من توكن المستخدم عبر /v2/me
 */
async function verifyUserToken(accessToken) {
    if (!accessToken) {
        return { ok: false, status: 400, error: 'accessToken مطلوب' };
    }

    try {
        const response = await fetch(PI_API_BASE + '/v2/me', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return {
                ok: false,
                status: response.status,
                error: 'توكن غير صالح أو منتهي الصلاحية'
            };
        }

        const user = await response.json();
        return {
            ok: true,
            user: {
                uid: user.uid,
                username: user.username
            }
        };
    } catch (error) {
        return {
            ok: false,
            status: 500,
            error: 'فشل الاتصال بـ Pi Platform'
        };
    }
}

/**
 * موافقة الخادم على الدفع
 */
async function approvePayment(paymentId) {
    if (!PI_API_KEY) {
        return { ok: false, status: 500, error: 'PI_API_KEY غير مُهيأ' };
    }

    if (!paymentId) {
        return { ok: false, status: 400, error: 'paymentId مطلوب' };
    }

    try {
        const response = await fetch(
            PI_API_BASE + '/v2/payments/' + paymentId + '/approve',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Key ' + PI_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            return { ok: false, status: response.status, error: errorText };
        }

        return { ok: true, paymentId: paymentId };
    } catch (error) {
        return { ok: false, status: 500, error: 'فشل الاتصال بـ Pi Platform' };
    }
}

/**
 * إكمال الدفع
 */
async function completePayment(paymentId, txid) {
    if (!PI_API_KEY) {
        return { ok: false, status: 500, error: 'PI_API_KEY غير مُهيأ' };
    }

    if (!paymentId || !txid) {
        return { ok: false, status: 400, error: 'paymentId و txid مطلوبان' };
    }

    try {
        const response = await fetch(
            PI_API_BASE + '/v2/payments/' + paymentId + '/complete',
            {
                method: 'POST',
                headers: {
                    'Authorization': 'Key ' + PI_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ txid: txid })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            if (errorText.indexOf('already_completed') !== -1) {
                return { ok: true, alreadyCompleted: true };
            }
            return { ok: false, status: response.status, error: errorText };
        }

        return { ok: true, paymentId: paymentId, txid: txid };
    } catch (error) {
        return { ok: false, status: 500, error: 'فشل الاتصال بـ Pi Platform' };
    }
}

/**
 * جلب تفاصيل دفع
 */
async function getPayment(paymentId) {
    if (!PI_API_KEY) {
        return { ok: false, status: 500, error: 'PI_API_KEY غير مُهيأ' };
    }

    try {
        const response = await fetch(
            PI_API_BASE + '/v2/payments/' + paymentId,
            {
                method: 'GET',
                headers: { 'Authorization': 'Key ' + PI_API_KEY }
            }
        );

        if (!response.ok) {
            return { ok: false, status: response.status, error: 'لم يتم العثور على الدفع' };
        }

        const payment = await response.json();
        return { ok: true, payment: payment };
    } catch (error) {
        return { ok: false, status: 500, error: 'فشل الاتصال بـ Pi Platform' };
    }
}

module.exports = {
    verifyUserToken,
    approvePayment,
    completePayment,
    getPayment
};