// ============================================
// GAV - The Incense Route | Payment & Balance
// ============================================

/**
 * جلب الرصيد من BIGISH-YER (المحفظة المركزية)
 */
async function loadBalanceFromBIGISHYER() {
    if (!currentUser) return;

    try {
        const res = await fetch(`${BIGISH_YER_URL}/api/balance/${currentUser.uid}`);
        const data = await res.json();

        const piEl = document.getElementById('pi-balance');
        const yerEl = document.getElementById('yer-balance');

        if (piEl) piEl.textContent = parseFloat(data.Pi || 0).toFixed(2);
        if (yerEl) yerEl.textContent = parseFloat(data.YER || 0).toFixed(2);

    } catch (err) {
        console.error("Balance load error:", err);
    }
}

/**
 * فتح محفظة BIGISH-YER في Pi Browser
 */
function openBigishYerWallet() {
    const url = `${BIGISH_YER_URL}`;
    if (typeof window !== 'undefined' && window.Pi && window.Pi.openShareDialog) {
        // إذا كان داخل Pi Browser
        window.location.href = url;
    } else {
        alert('افتح هذا الرابط في متصفح Pi:\n' + url);
    }
}

/**
 * إيداع Pi في محفظة BIGISH-YER (عند الحاجة)
 */
async function depositPi() {
    if (!currentUser) return alert('يجب تسجيل الدخول أولاً');

    const amount = parseFloat(prompt('أدخل المبلغ بـ Pi للإيداع في محفظة BIGISH-YER:', '1.0'));
    if (!amount || amount <= 0) return;

    try {
        await Pi.createPayment({
            amount: amount,
            memo: `إيداع Pi في BIGISH-YER (من GAV)`,
            metadata: {
                type: "pi_deposit_via_gav",
                orderId: "GAV-DEP-" + Date.now(),
                userId: currentUser.uid
            }
        }, {
            onReadyForServerApproval: async (paymentId) => {
                try {
                    await fetch(`${BIGISH_YER_URL}/api/payments/approve`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentId })
                    });
                } catch (e) { console.error('Approve error:', e); }
            },
            onReadyForServerCompletion: async (paymentId, txid) => {
                try {
                    const r = await fetch(`${BIGISH_YER_URL}/api/payments/complete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            paymentId,
                            txid,
                            userId: currentUser.uid,
                            piAmount: amount
                        })
                    });
                    if (r.ok) {
                        alert(`✅ تم إيداع ${amount} Pi في محفظتك بنجاح!`);
                        loadBalanceFromBIGISHYER();
                    }
                } catch (e) { console.error('Complete error:', e); }
            },
            onCancel: () => alert('تم إلغاء الإيداع'),
            onError: (error) => alert('خطأ: ' + (error.message || 'غير معروف'))
        });
    } catch (e) {
        alert('خطأ: ' + e.message);
    }
}

/**
 * الدفع المباشر لمبلغ محدد (اختياري)
 * يُستخدم في حالات خاصة خارج سلة التسوق
 */
async function directPayment(piAmount, yerAmount, memo) {
    if (!currentUser) return alert('يجب تسجيل الدخول أولاً');

    try {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: currentUser.accessToken,
                productId: 'direct', // يمكن أن يكون أي قيمة
                piAmount: parseFloat(piAmount) || 0,
                yerAmount: parseFloat(yerAmount) || 0,
                quantity: 1,
                directPayment: true,
                memo: memo || 'دفع مباشر'
            })
        });

        const data = await res.json();
        if (data.success) {
            alert('✅ تم الدفع بنجاح');
            loadBalanceFromBIGISHYER();
        } else {
            alert('❌ فشل الدفع: ' + (data.error || 'خطأ غير معروف'));
        }
    } catch (e) {
        alert('خطأ في الاتصال: ' + e.message);
    }
}

/**
 * التحقق من حالة الاتصال بـ BIGISH-YER
 */
async function checkBigishYerConnection() {
    try {
        const res = await fetch(`${BIGISH_YER_URL}/api/health`);
        const data = await res.json();
        console.log('🔗 BIGISH-YER Status:', data);
        return data.status === 'ONLINE';
    } catch (e) {
        console.error('BIGISH-YER unreachable:', e);
        return false;
    }
}

// تحقق تلقائي عند بدء التطبيق
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(checkBigishYerConnection, 2000);
});