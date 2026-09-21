// ============================================
// GAV | Authentication Module (Pi SDK)
// ============================================

let currentUser = null;
const BIGISH_YER_URL = 'https://bigish-yer.vercel.app';

// ============================================
// دالة تسجيل الدخول عبر Pi
// ============================================
function loginWithPi() {
    const btn = document.getElementById('login-btn');
    if (btn && btn.disabled) return;

    if (typeof window.Pi === 'undefined') {
        showLoginError('مكتبة Pi SDK غير محمّلة. افتح التطبيق عبر Pi Browser.');
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.textContent = 'جارٍ الاتصال بـ Pi...';
    }

    window.Pi.authenticate(
        ['username', 'payments'],
        onIncompletePaymentFound
    )
    .then(function(auth) {
        if (!auth || !auth.accessToken) {
            throw new Error('لم يتم استلام accessToken من Pi');
        }

        return fetch('/api/auth/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: auth.accessToken })
        });
    })
    .then(function(response) {
        return response.json().then(function(data) {
            return { ok: response.ok, status: response.status, data: data };
        });
    })
    .then(function(result) {
        if (!result.ok) {
            if (result.status === 401) {
                throw new Error('التوكن منتهي الصلاحية أو غير صالح');
            }
            throw new Error(result.data.error || 'فشل التحقق من الخادم');
        }

        currentUser = {
            uid: result.data.user.uid,
            username: result.data.user.username
        };

        localStorage.setItem('gav_user', JSON.stringify(currentUser));
        onLoginSuccess(currentUser);
    })
    .catch(function(err) {
        console.error('Login error:', err);
        showLoginError(err.message || 'فشل تسجيل الدخول');
    })
    .finally(function() {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🚀 تسجيل الدخول بحساب Pi';
        }
    });
}

// ============================================
// معالجة نجاح تسجيل الدخول
// ============================================
function onLoginSuccess(user) {
    const usernameEl = document.getElementById('username');
    if (usernameEl) usernameEl.textContent = user.username;

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.style.display = 'inline-block';

    const userNameEl = document.getElementById('user-name');
    if (userNameEl) userNameEl.textContent = user.username;

    const userIdEl = document.getElementById('user-id');
    if (userIdEl) userIdEl.textContent = user.uid;

    const loginPage = document.getElementById('page-login');
    if (loginPage) {
        loginPage.classList.remove('active');
        loginPage.style.display = 'none';
    }

    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.style.display = 'flex';

    if (typeof showPage === 'function') showPage('home');
    if (typeof loadBalanceFromBIGISHYER === 'function') loadBalanceFromBIGISHYER();
    if (typeof loadCategories === 'function') loadCategories();
    if (typeof loadFeaturedProducts === 'function') loadFeaturedProducts();

    if (typeof showCalculatorFAB === 'function') showCalculatorFAB();
    const txFab = document.getElementById('transactions-fab');
    if (txFab) txFab.style.display = 'flex';
}

// ============================================
// عرض رسائل الخطأ
// ============================================
function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } else {
        alert(message);
    }
}

// ============================================
// معالجة الدفعات غير المكتملة
// ============================================
function onIncompletePaymentFound(payment) {
    console.log('⚠️ Incomplete payment found:', payment);

    fetch('/api/payments/incomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment: payment })
    }).catch(function(err) {
        console.error('Failed to report incomplete payment:', err);
    });
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
// استعادة الجلسة عند إعادة تحميل الصفحة
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    if (typeof hideCalculatorFAB === 'function') hideCalculatorFAB();

    const txFab = document.getElementById('transactions-fab');
    if (txFab) txFab.style.display = 'none';

    const savedUser = localStorage.getItem('gav_user');
    if (savedUser) {
        try {
            const user = JSON.parse(savedUser);
            currentUser = user;
            console.log('Previous session found for:', user.username);
        } catch (e) {
            localStorage.removeItem('gav_user');
        }
    }
});