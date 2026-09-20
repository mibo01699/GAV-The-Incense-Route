// ============================================
// GAV | Merchant Dashboard v3
// ============================================

let myProducts = [];

async function loadMerchantStats() {
    if (!currentUser) return;
    try {
        const res = await fetch('/api/merchant/stats/' + currentUser.uid);
        const data = await res.json();
        if (data.success) {
            document.getElementById('stat-products').textContent = data.stats.totalProducts;
            document.getElementById('stat-orders').textContent = data.stats.totalOrders;
            document.getElementById('stat-pi').textContent = parseFloat(data.stats.totalPiEarned || 0).toFixed(4);
            document.getElementById('stat-yer').textContent = parseFloat(data.stats.totalYerEarned || 0).toFixed(4);
        }
    } catch (err) {}
}

async function loadMyProducts() {
    if (!currentUser) return;
    const container = document.getElementById('my-products-list');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch('/api/products?merchantId=' + currentUser.uid);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        myProducts = data.products || [];

        if (myProducts.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد منتجات بعد.</p>';
            return;
        }

        container.innerHTML = '';
        myProducts.forEach(function(product) {
            container.appendChild(createMyProductCard(product));
        });
    } catch (err) {
        container.innerHTML = '<p class="empty-state">فشل تحميل المنتجات.</p>';
    }
}

function createMyProductCard(product) {
    const div = document.createElement('div');
    div.className = 'order-item';

    const category = allCategories.find(function(c) { return c.id === product.category; });
    const icon = category ? category.icon : '📦';

    let priceText = '';
    if (product.pricePi > 0) priceText += parseFloat(product.pricePi).toFixed(4) + ' Pi';
    if (product.pricePi > 0 && product.priceYER > 0) priceText += ' + ';
    if (product.priceYER > 0) priceText += parseFloat(product.priceYER).toFixed(0) + ' YER';

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">${icon} ${escapeHtmlM(category ? category.name : '')}</span>
            <button class="btn-small" style="background:#e74c3c;" onclick="event.stopPropagation(); deleteProduct('${product.id}')">🗑️ حذف</button>
        </div>
        <div class="order-product">${escapeHtmlM(product.name)}</div>
        <div class="order-amount">${priceText}</div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            قيمة: $${product.priceUSD || 0}
            ${product.type ? ' | نوع: ' + escapeHtmlM(product.type) : ''}
            ${product.quantity ? ' | كمية: ' + product.quantity : ''}
            | مخزون: ${product.stock || 1}
        </div>
        ${product.directSaleAddress ? `<div style="font-size:0.72rem;color:#d4af37;margin-top:4px;">📍 ${escapeHtmlM(product.directSaleAddress)}</div>` : ''}
        <button class="btn-secondary" style="margin-top:8px; padding:6px 12px; font-size:0.8rem;" onclick="event.stopPropagation(); openProductMessages('${product.id}')">💬 المراسلات</button>
    `;

    return div;
}

async function addProduct() {
    if (!currentUser) return alert('يجب تسجيل الدخول أولاً');

    const name = document.getElementById('new-product-name').value.trim();
    const type = document.getElementById('new-product-type').value.trim();
    const quantity = parseInt(document.getElementById('new-product-quantity').value) || 0;
    const stock = parseInt(document.getElementById('new-product-stock').value) || 1;
    const directSaleAddress = document.getElementById('new-product-direct-address').value.trim();
    const description = document.getElementById('new-product-description').value.trim();
    const category = document.getElementById('new-product-category').value;
    const priceUSD = parseFloat(document.getElementById('new-product-price-usd').value) || 0;
    const pricePi = parseFloat(document.getElementById('new-product-price-pi').value) || 0;
    const priceYER = parseFloat(document.getElementById('new-product-price-yer').value) || 0;
    const referenceSource = document.getElementById('new-product-reference-source').value || '';
    const piRatio = parseFloat(document.getElementById('new-product-pi-ratio').value) || 0;

    if (!name) return alert('⚠️ يجب إدخال اسم المنتج');
    if (quantity <= 0) return alert('⚠️ يجب إدخال الكمية');
    if (priceUSD <= 0) return alert('⚠️ يجب إدخال قيمة المنتج');
    if (pricePi <= 0 && priceYER <= 0) return alert('⚠️ استخدم الحاسبة 🧮 أولاً');
    if (!referenceSource) return alert('⚠️ اختر القيمة المرجعية عبر الحاسبة');

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
                    name: name,
                    type: type,
                    quantity: quantity,
                    stock: stock,
                    directSaleAddress: directSaleAddress,
                    description: description,
                    category: category,
                    priceUSD: priceUSD,
                    pricePi: pricePi,
                    priceYER: priceYER,
                    referenceSource: referenceSource,
                    referencePiRatio: piRatio
                }
            })
        });

        const data = await res.json();

        if (data.success) {
            alert('✅ تم إضافة المنتج بنجاح!');
            document.getElementById('new-product-name').value = '';
            document.getElementById('new-product-type').value = '';
            document.getElementById('new-product-quantity').value = '';
            document.getElementById('new-product-stock').value = '';
            document.getElementById('new-product-direct-address').value = '';
            document.getElementById('new-product-description').value = '';
            document.getElementById('new-product-price-usd').value = '';
            document.getElementById('new-product-price-pi').value = '';
            document.getElementById('new-product-price-yer').value = '';
            document.getElementById('new-product-reference-source').value = '';
            document.getElementById('new-product-pi-ratio').value = '';

            await loadMyProducts();
            await loadMerchantStats();
            if (typeof loadFeaturedProducts === 'function') await loadFeaturedProducts();
        } else {
            alert('❌ فشل: ' + (data.error || 'خطأ'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '➕ إضافة المنتج';
    }
}

async function deleteProduct(productId) {
    if (!currentUser) return;
    if (!confirm('هل تريد حذف هذا المنتج؟')) return;

    try {
        const res = await fetch('/api/products/' + productId, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: currentUser.accessToken })
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ تم الحذف');
            await loadMyProducts();
            await loadMerchantStats();
        } else {
            alert('❌ فشل: ' + (data.error || 'غير معروف'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

// ============================================
// رسائل المنتج (بين البائع والمشتري)
// ============================================
let currentProductIdForMessages = null;

async function openProductMessages(productId) {
    currentProductIdForMessages = productId;
    document.getElementById('messages-title').textContent = '💬 استفسارات المنتج';

    const modal = document.getElementById('messages-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        await loadProductMessages(productId);
    }
}

async function loadProductMessages(productId) {
    const container = document.getElementById('messages-list');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch('/api/products/' + productId + '/messages');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const messages = data.messages || [];
        if (messages.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد رسائل بعد.</p>';
            return;
        }

        container.innerHTML = '';
        messages.forEach(function(msg) {
            const div = document.createElement('div');
            const isMine = currentUser && msg.userId === currentUser.uid;
            div.style.cssText = 'padding:10px; margin-bottom:8px; border-radius:8px; ' +
                (isMine ? 'background:#d4edda; margin-right:20px;' : 'background:#f0f7f3; margin-left:20px;');
            div.innerHTML = '<strong style="font-size:0.8rem;">' + escapeHtmlM(msg.username) + '</strong>' +
                '<p style="margin:4px 0; font-size:0.9rem;">' + escapeHtmlM(msg.text) + '</p>' +
                '<small style="font-size:0.7rem; color:#7f8c8d;">' + formatDateM(msg.timestamp) + '</small>';
            container.appendChild(div);
        });

        container.scrollTop = container.scrollHeight;
    } catch (err) {
        container.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

async function sendMessage() {
    if (!currentUser) return alert('يجب تسجيل الدخول');
    const input = document.getElementById('message-input');
    const text = input.value.trim();
    if (!text) return;

    const isProductMsg = currentProductIdForMessages !== null;
    const url = isProductMsg
        ? '/api/products/' + currentProductIdForMessages + '/messages'
        : '/api/festivals/' + currentFestivalIdForMessages + '/messages';

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: currentUser.accessToken,
                text: text
            })
        });
        const data = await res.json();
        if (data.success) {
            input.value = '';
            if (isProductMsg) await loadProductMessages(currentProductIdForMessages);
            else await loadFestivalMessages(currentFestivalIdForMessages);
        } else {
            alert('فشل: ' + (data.error || 'خطأ'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

function escapeHtmlM(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateM(timestamp) {
    if (!timestamp) return '—';
    try {
        const date = new Date(timestamp);
        const diff = Math.floor((new Date() - date) / 1000);
        if (diff < 60) return 'قبل لحظات';
        if (diff < 3600) return 'قبل ' + Math.floor(diff / 60) + ' دقيقة';
        if (diff < 86400) return 'قبل ' + Math.floor(diff / 3600) + ' ساعة';
        return date.toLocaleDateString('ar-EG');
    } catch (e) { return '—'; }
}

document.addEventListener('DOMContentLoaded', function() {
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