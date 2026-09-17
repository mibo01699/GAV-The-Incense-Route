// ============================================
// GAV - The Incense Route | Authentication + Navigation v2
// ============================================

let currentUser = null;
const BIGISH_YER_URL = 'https://bigish-yer.vercel.app';

// ============================================
// دالة التنقل بين الصفحات (محصّنة)
// ============================================
function showPage(pageName) {
    try {
        // إخفاء جميع الصفحات
        const allPages = document.querySelectorAll('.page');
        allPages.forEach(page => {
            page.classList.remove('active');
            page.style.display = 'none'; // إجبار الإخفاء
        });

        // إظهار الصفحة المطلوبة
        const targetPage = document.getElementById('page-' + pageName);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.style.display = 'block';
        }

        // تحديث حالة أزرار التنقل
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.page === pageName) {
                btn.classList.add('active');
            }
        });

        // تحميل بيانات خاصة بكل صفحة
        if (pageName === 'home') {
            if (typeof loadBalanceFromBIGISHYER === 'function') loadBalanceFromBIGISHYER();
            if (typeof loadFeaturedProducts === 'function') loadFeaturedProducts();
        }
        if (pageName === 'products' && typeof loadFeaturedProducts === 'function') loadFeaturedProducts();
        if (pageName === 'cart' && typeof renderCart === 'function') renderCart();
        if (pageName === 'orders' && typeof refreshOrders === 'function') refreshOrders();
        if (pageName === 'merchant') {
            if (typeof loadMerchantStats === 'function') loadMerchantStats();
            if (typeof loadMyProducts === 'function') loadMyProducts();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error('showPage error:', err);
    }
}

// ============================================
// تسجيل الدخول
// ============================================
async function loginWithPi() {
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');

    btn.disabled = true;
    btn.textContent = 'جارٍ الاتصال بـ Pi...';
    errorDiv.style.display = 'none';

    try {
        const auth = await Pi.authenticate(
            ['username', 'payments', 'wallet_address'],
            onIncompletePaymentFound
        );

        console.log("✅ Pi Auth success:", auth);

        const response = await fetch(`${BIGISH_YER_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: auth.accessToken })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'فشل التحقق من التوكن');
        }

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

// ============================================
// معالجة نجاح تسجيل الدخول
// ============================================
function onLoginSuccess(user) {
    // تحديث الشريط العلوي
    document.getElementById('username').textContent = user.username;
    document.getElementById('logout-btn').style.display = 'inline-block';

    // تحديث بيانات المستخدم
    document.getElementById('user-name').textContent = user.username;
    document.getElementById('user-id').textContent = user.uid;

    // ✅ إخفاء صفحة تسجيل الدخول بشكل صريح
    const loginPage = document.getElementById('page-login');
    if (loginPage) {
        loginPage.classList.remove('active');
        loginPage.style.display = 'none';
    }

    // ✅ إظهار شريط التنقل
    document.getElementById('bottom-nav').style.display = 'flex';

    // ✅ إظهار الزر العائم 🧮
    if (typeof showCalculatorFAB === 'function') {
        showCalculatorFAB();
    }

    // ✅ عرض الصفحة الرئيسية
    showPage('home');

    // تحميل الأقسام
    if (typeof loadCategories === 'function') loadCategories();
}

// ============================================
// معالجة الدفعات غير المكتملة
// ============================================
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

// ============================================
// تسجيل الخروج
// ============================================
function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('gav_user');
        currentUser = null;
        location.reload();
    }
}

// ============================================
// إخفاء الزر العائم عند البدء (يظهر بعد الدخول)
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    if (typeof hideCalculatorFAB === 'function') {
        hideCalculatorFAB();
    }

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