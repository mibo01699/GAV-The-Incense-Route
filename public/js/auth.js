// ============================================
// GAV | Authentication + Navigation v3
// ============================================

let currentUser = null;
const BIGISH_YER_URL = 'https://bigish-yer.vercel.app';

function showPage(pageName) {
    try {
        document.querySelectorAll('.page').forEach(function(page) {
            page.classList.remove('active');
            page.style.display = 'none';
        });

        const targetPage = document.getElementById('page-' + pageName);
        if (targetPage) {
            targetPage.classList.add('active');
            targetPage.style.display = 'block';
        }

        document.querySelectorAll('.nav-btn').forEach(function(btn) {
            btn.classList.remove('active');
            if (btn.dataset.page === pageName) {
                btn.classList.add('active');
            }
        });

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
        if (pageName === 'festivals') {
            if (typeof loadFestivals === 'function') loadFestivals();
            if (typeof loadMyFestivals === 'function') loadMyFestivals();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
        console.error('showPage error:', err);
    }
}

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

        const response = await fetch(BIGISH_YER_URL + '/api/auth', {
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
        console.error("Login error:", err);
        errorDiv.textContent = 'فشل تسجيل الدخول: ' + err.message;
        errorDiv.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = '🚀 تسجيل الدخول بحساب Pi';
    }
}

function onLoginSuccess(user) {
    document.getElementById('username').textContent = user.username;
    document.getElementById('logout-btn').style.display = 'inline-block';
    document.getElementById('user-name').textContent = user.username;
    document.getElementById('user-id').textContent = user.uid;

    const loginPage = document.getElementById('page-login');
    if (loginPage) {
        loginPage.classList.remove('active');
        loginPage.style.display = 'none';
    }

    document.getElementById('bottom-nav').style.display = 'flex';

    // إظهار الأزرار العائمة
    if (typeof showCalculatorFAB === 'function') showCalculatorFAB();
    const txFab = document.getElementById('transactions-fab');
    if (txFab) txFab.style.display = 'flex';

    showPage('home');

    if (typeof loadCategories === 'function') loadCategories();
}

function onIncompletePaymentFound(payment) {
    fetch(BIGISH_YER_URL + '/api/payments/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            paymentId: payment.identifier,
            txid: payment.transaction ? payment.transaction.txid : null,
            userId: currentUser ? currentUser.uid : null
        })
    }).catch(function(err) { console.error("Complete payment error:", err); });
}

function logout() {
    if (confirm('هل تريد تسجيل الخروج؟')) {
        localStorage.removeItem('gav_user');
        currentUser = null;
        location.reload();
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof hideCalculatorFAB === 'function') hideCalculatorFAB();

    const txFab = document.getElementById('transactions-fab');
    if (txFab) txFab.style.display = 'none';

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