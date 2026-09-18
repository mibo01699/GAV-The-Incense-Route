// ============================================
// GAV - The Incense Route | Merchant Dashboard v2
// ============================================

let myProducts = [];

// ============================================
// تحميل إحصائيات التاجر
// ============================================
async function loadMerchantStats() {
    if (!currentUser) return;

    try {
        const res = await fetch(`/api/merchant/stats/${currentUser.uid}`);
        const data = await res.json();

        if (data.success) {
            document.getElementById('stat-products').textContent = data.stats.totalProducts;
            document.getElementById('stat-orders').textContent = data.stats.totalOrders;
            document.getElementById('stat-pi').textContent = parseFloat(data.stats.totalPiEarned || 0).toFixed(4);
            document.getElementById('stat-yer').textContent = parseFloat(data.stats.totalYerEarned || 0).toFixed(4);
        }
    } catch (err) {
        console.error("Merchant stats error:", err);
    }
}

// ============================================
// تحميل منتجات التاجر
// ============================================
async function loadMyProducts() {
    if (!currentUser) return;

    const container = document.getElementById('my-products-list');
    if (!container) return;

    container.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch(`/api/products?merchantId=${currentUser.uid}`);
        const data = await res.json();

        if (!data.success) throw new Error(data.error);

        myProducts = data.products || [];

        if (myProducts.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد منتجات بعد.</p>';
            return;
        }

        container.innerHTML = '';
        myProducts.forEach(product => {
            container.appendChild(createMyProductCard(product));
        });

    } catch (err) {
        console.error("My products error:", err);
        container.innerHTML = '<p class="empty-state">فشل تحميل المنتجات.</p>';
    }
}

// ============================================
// بطاقة منتج التاجر
// ============================================
function createMyProductCard(product) {
    const div = document.createElement('div');
    div.className = 'order-item';

    const category = allCategories.find(c => c.id === product.category);
    const icon = category ? category.icon : '📦';

    let priceText = '';
    if (product.pricePi > 0) priceText += `${parseFloat(product.pricePi).toFixed(4)} Pi`;
    if (product.pricePi > 0 && product.priceYER > 0) priceText += ' + ';
    if (product.priceYER > 0) priceText += `${parseFloat(product.priceYER).toFixed(0)} YER`;

    const refSource = product.referenceValue?.source === 'gcvalue' ? '💎 GCV' :
                      product.referenceValue?.source === 'dex' ? '📈 AMM' : '—';

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">${icon} ${escapeHtml(category?.name || '')}</span>
            <button class="btn-small" style="background:#e74c3c;" onclick="event.stopPropagation(); deleteProduct('${product.id}')">🗑️ حذف</button>
        </div>
        <div class="order-product">${escapeHtml(product.name)}</div>
        <div class="order-amount">${priceText}</div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            قيمة: ${product.priceUSD || 0}$ | مرجع: ${refSource} | مخزون: ${product.stock || 1}
        </div>
    `;

    return div;
}

// ============================================
// إضافة منتج جديد
// ============================================
async function addProduct() {
    if (!currentUser) return alert('يجب تسجيل الدخول أولاً');

    const name = document.getElementById('new-product-name').value.trim();
    const description = document.getElementById('new-product-description').value.trim();
    const category = document.getElementById('new-product-category').value;
    const priceUSD = parseFloat(document.getElementById('new-product-price-usd').value) || 0;
    const pricePi = parseFloat(document.getElementById('new-product-price-pi').value) || 0;
    const priceYER = parseFloat(document.getElementById('new-product-price-yer').value) || 0;
    const referenceSource = document.getElementById('new-product-reference-source').value || '';
    const piRatio = parseFloat(document.getElementById('new-product-pi-ratio').value) || 0;

    // التحقق من المدخلات
    if (!name) return alert('⚠️ يجب إدخال اسم المنتج');
    if (priceUSD <= 0) return alert('⚠️ يجب إدخال قيمة المنتج بالدولار');
    if (pricePi <= 0 && priceYER <= 0) {
        return alert('⚠️ يجب استخدام الحاسبة الذكية 🧮 لحساب التوزيع أولاً');
    }
    if (!referenceSource) {
        return alert('⚠️ يجب اختيار القيمة المرجعية في الحاسبة (GCV أو AMM)');
    }

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'جارٍ الإضافة...';

    try {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: currentUser.accessToken,
                product: {
                    name,
                    description,
                    category,
                    priceUSD,
                    pricePi,
                    priceYER,
                    referenceSource,
                    referencePiRatio: piRatio,
                    stock: 1
                }
            })
        });

        const data = await res.json();

        if (data.success) {
            alert('✅ تم إضافة المنتج بنجاح!');

            // تفريغ الحقول
            document.getElementById('new-product-name').value = '';
            document.getElementById('new-product-description').value = '';
            document.getElementById('new-product-price-usd').value = '';
            document.getElementById('new-product-price-pi').value = '';
            document.getElementById('new-product-price-yer').value = '';
            document.getElementById('new-product-reference-source').value = '';
            document.getElementById('new-product-pi-ratio').value = '';

            // إعادة التحميل
            await loadMyProducts();
            await loadMerchantStats();
            await loadFeaturedProducts();
        } else {
            alert('❌ فشل الإضافة: ' + (data.error || 'خطأ غير معروف'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '➕ إضافة المنتج';
    }
}

// ============================================
// حذف منتج
// ============================================
async function deleteProduct(productId) {
    if (!currentUser) return;
    if (!confirm('هل تريد حذف هذا المنتج؟')) return;

    try {
        const res = await fetch(`/api/products/${productId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: currentUser.accessToken })
        });

        const data = await res.json();
        if (data.success) {
            alert('✅ تم الحذف');
            await loadMyProducts();
            await loadMerchantStats();
            await loadFeaturedProducts();
        } else {
            alert('❌ فشل الحذف: ' + (data.error || 'غير معروف'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

// ============================================
// أدوات مساعدة
// ============================================
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'قبل لحظات';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
    return date.toLocaleDateString('ar-EG');
}

// ============================================
// تحميل تلقائي عند فتح صفحة التاجر
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const originalShowPage = window.showPage;
    if (originalShowPage) {
        window.showPage = function(pageName) {
            originalShowPage(pageName);
            if (pageName === 'merchant') {
                loadMerchantStats();
                loadMyProducts();
            }
        };
    }
});