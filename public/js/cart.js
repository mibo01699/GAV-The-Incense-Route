// ============================================
// GAV - The Incense Route | Shopping Cart
// ============================================

let cart = [];

// تحميل السلة من التخزين المحلي
function loadCart() {
    try {
        const saved = localStorage.getItem('gav_cart');
        cart = saved ? JSON.parse(saved) : [];
    } catch (e) {
        cart = [];
    }
}

// حفظ السلة
function saveCart() {
    localStorage.setItem('gav_cart', JSON.stringify(cart));
}

// ============================================
// إضافة منتج للسلة
// ============================================
function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        alert('المنتج غير موجود');
        return;
    }

    const existing = cart.find(item => item.productId === productId);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            productId: product.id,
            name: product.name,
            pricePi: product.pricePi || 0,
            priceYER: product.priceYER || 0,
            merchantId: product.merchantId,
            merchantName: product.merchantName,
            category: product.category,
            quantity: 1
        });
    }

    saveCart();
    updateCartBadge();
    alert(`✅ تمت إضافة "${product.name}" إلى السلة`);
}

// ============================================
// عرض السلة
// ============================================
function renderCart() {
    const container = document.getElementById('cart-items');
    const summary = document.getElementById('cart-summary');
    if (!container) return;

    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-state">السلة فارغة حالياً.</p>';
        if (summary) summary.style.display = 'none';
        return;
    }

    container.innerHTML = '';
    let totalPi = 0;
    let totalYER = 0;

    cart.forEach((item, index) => {
        totalPi += (item.pricePi * item.quantity);
        totalYER += (item.priceYER * item.quantity);

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">
                    ${item.pricePi > 0 ? `${item.pricePi.toFixed(2)} Pi` : ''}
                    ${item.pricePi > 0 && item.priceYER > 0 ? ' + ' : ''}
                    ${item.priceYER > 0 ? `${item.priceYER.toFixed(0)} YER` : ''}
                    × ${item.quantity}
                </div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart(${index})">×</button>
        `;
        container.appendChild(div);
    });

    if (summary) {
        summary.style.display = 'block';
        const totalEl = document.getElementById('cart-total-amount');
        if (totalEl) {
            let totalText = '';
            if (totalPi > 0) totalText += `${totalPi.toFixed(2)} Pi`;
            if (totalPi > 0 && totalYER > 0) totalText += ' + ';
            if (totalYER > 0) totalText += `${totalYER.toFixed(0)} YER`;
            totalEl.textContent = totalText || '0';
        }
    }
}

// ============================================
// حذف من السلة
// ============================================
function removeFromCart(index) {
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    saveCart();
    updateCartBadge();
    renderCart();
}

// ============================================
// تفريغ السلة
// ============================================
function clearCart() {
    if (cart.length === 0) return;
    if (confirm('هل تريد إفراغ السلة؟')) {
        cart = [];
        saveCart();
        updateCartBadge();
        renderCart();
    }
}

// ============================================
// شارة السلة
// ============================================
function updateCartBadge() {
    const nav = document.querySelector('[data-page="cart"]');
    if (!nav) return;

    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    let badge = nav.querySelector('.cart-badge');

    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'cart-badge';
            badge.style.cssText = 'position:absolute;top:2px;left:50%;transform:translateX(-50%);background:#e74c3c;color:white;font-size:0.65rem;padding:1px 6px;border-radius:10px;font-weight:700;';
            nav.style.position = 'relative';
            nav.appendChild(badge);
        }
        badge.textContent = count;
    } else if (badge) {
        badge.remove();
    }
}

// ============================================
// إتمام الدفع
// ============================================
async function checkout() {
    if (!currentUser) {
        alert('يجب تسجيل الدخول أولاً');
        return;
    }
    if (cart.length === 0) {
        alert('السلة فارغة');
        return;
    }

    // حساب الإجمالي
    const totalPi = cart.reduce((sum, item) => sum + (item.pricePi * item.quantity), 0);
    const totalYER = cart.reduce((sum, item) => sum + (item.priceYER * item.quantity), 0);

    if (totalPi === 0 && totalYER === 0) {
        alert('لا يوجد مبلغ للدفع');
        return;
    }

    if (!confirm(`سيتم دفع:\n${totalPi.toFixed(2)} Pi\n${totalYER.toFixed(0)} YER\n\nهل تريد المتابعة؟`)) {
        return;
    }

    // الدفع لكل منتج على حدة
    const btn = document.querySelector('#cart-summary .btn-primary');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'جارٍ الدفع...';
    }

    try {
        let successCount = 0;
        let failCount = 0;

        for (const item of cart) {
            try {
                const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accessToken: currentUser.accessToken,
                        productId: item.productId,
                        piAmount: item.pricePi * item.quantity,
                        yerAmount: item.priceYER * item.quantity,
                        quantity: item.quantity
                    })
                });

                const data = await res.json();
                if (data.success) {
                    successCount++;
                } else {
                    failCount++;
                    console.error('Order failed:', data.error);
                }
            } catch (e) {
                failCount++;
                console.error('Order exception:', e);
            }
        }

        if (successCount > 0) {
            alert(`✅ تمت ${successCount} عملية بنجاح${failCount > 0 ? `\n⚠️ فشلت ${failCount} عملية` : ''}`);
            cart = [];
            saveCart();
            updateCartBadge();
            renderCart();
            loadBalanceFromBIGISHYER();
            refreshOrders();
        } else {
            alert('❌ فشلت جميع العمليات');
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💳 إتمام الدفع';
        }
    }
}

// ============================================
// تحميل عند البدء
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    renderCart();
    updateCartBadge();
});