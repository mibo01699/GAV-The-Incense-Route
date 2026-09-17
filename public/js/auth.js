// ============================================
// GAV - The Incense Route | Authentication
// ============================================

let currentUser = null;
const BIGISH_YER_URL = 'https://bigish-yer.vercel.app';

/**
 * تسجيل الدخول عبر Pi
 */
async function loginWithPi() {
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'جارٍ الاتصال بـ Pi...';
    errorDiv.style.display = 'none';

    try {
        // المصادقة عبر Pi SDK
        const auth = await Pi.authenticate(
            ['username', 'payments', 'wallet_address'],
            onIncompletePaymentFound
        );

        console.log("✅ Pi Auth success:", auth);

        // التحقق من التوكن عبر BIGISH-YER
        const response = await fetch(`${BIGISH_YER_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: auth.accessToken })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'فشل التحقق من التوكن');
        }

        // حفظ بيانات المستخدم
        currentUser = {
            uid: data.user.uid,
            username: data.user.username,
            accessToken: auth.accessToken
        };

        localStorage.setItem('gav_user', JSON.stringify({
            uid: currentUser.uid,
            username: currentUser.username
        }));

        onLoginSuccess(currentUser);

    } catch (err) {
        console.error("❌ Login error:", err);
        errorDiv.textContent = 'فشل تسجيل الدخول: ' + err.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 تسجيل الدخول بحساب Pi';
    }
}

/**
 * معالجة نجاح تسجيل الدخول
 */
function onLoginSuccess(user) {
    document.getElementById('username').textContent = user.username;
    document.getElementById('logout-btn').style.display = 'inline-block';
    document.getElementById('user-name').textContent = user.username;
    document.getElementById('user-id').textContent = user.uid;

    document.getElementById('page-login').classList.remove('active');
    document.getElementById('bottom-nav').style.display = 'flex';

    showPage('home');
    loadBalanceFromBIGISHYER();
    loadCategories();
    loadFeaturedProducts();
}

/**
 * معالجة الدفعات غير المكتملة
 */
function onIncompletePaymentFound(payment) {
    console.log("⚠️ Incomplete payment found:", payment);
    fetch(`${BIGISH_YER_URL}/api/payments/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            paymentId: payment.identifier,
            txid: payment.transaction?.txid,
            userId: currentUser ? currentUser.uid : null
        })
    }).catch(err => console.error("Complete payment error:", err));
}

/**
 * تسجيل الخروج
 */
function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('gav_user');
        currentUser = null;
        location.reload();
    }
}

/**
 * استعادة الجلسة عند إعادة تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', function() {
    const savedUser = localStorage.getItem('gav_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            console.log("Previous session found for:", user.username);
        } catch (e) {
            localStorage.removeItem('gav_user');
        }
    }
});