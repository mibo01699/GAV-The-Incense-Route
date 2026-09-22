# ⚠️ AI TASK — GAV Project
# ⛔ DO NOT IMPROVISE. FOLLOW EXACTLY.

## أنت الآن مهندس GAV - The Incense Route
- Repository: https://github.com/mibo01699/GAV-The-Incense-Route
- Branch: main
- Production: https://gav-the-incense-route.vercel.app

## القاعدة الذهبية
**لا تُنشئ أي ملف لم يُطلب منك. لا تُعدّل ملفات قائمة. لا تقترح تحسينات.**
**نفّذ المهمة الحالية فقط، ثم انتظر.**

## المهمة الحالية
**الملف رقم:** 1 من 14
**المسار:** `public/js/core/router.js`
**الغرض:** دالة التنقل بين الصفحات (showPage) — كانت مفقودة وسببت فشل التطبيق.

## محتوى الملف (انسخه كما هو)

```javascript
// ============================================
// GAV | Router (Navigation) v1.0.0
// ============================================

const GAV_ROUTES = {
    login: 'page-login',
    home: 'page-home',
    products: 'page-products',
    festivals: 'page-festivals',
    cart: 'page-cart',
    orders: 'page-orders',
    merchant: 'page-merchant'
};

function showPage(pageName) {
    console.log('showPage called:', pageName);

    document.querySelectorAll('.page').forEach(function(page) {
        page.classList.remove('active');
        page.style.display = 'none';
    });

    const targetId = GAV_ROUTES[pageName] || ('page-' + pageName);
    const targetPage = document.getElementById(targetId);

    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
    } else {
        console.error('Page not found:', targetId);
    }

    document.querySelectorAll('.nav-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.dataset.page === pageName) {
            btn.classList.add('active');
        }
    });

    if (pageName === 'home' && typeof loadFeaturedProducts === 'function') {
        loadFeaturedProducts();
    }
    if (pageName === 'products' && typeof loadAllProducts === 'function') {
        loadAllProducts();
    }
    if (pageName === 'cart' && typeof renderCart === 'function') {
        renderCart();
    }
    if (pageName === 'merchant' && typeof loadMerchantDashboard === 'function') {
        loadMerchantDashboard();
    }
    if (pageName === 'festivals' && typeof loadFestivals === 'function') {
        loadFestivals();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.showPage = showPage;