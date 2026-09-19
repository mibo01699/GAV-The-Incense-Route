// ============================================
// GAV | Shopping Cart v3 (with Wallet Selection)
// ============================================

let cart = [];
let pendingPayment = null;

function loadCart() {
    try {
        const saved = localStorage.getItem('gav_cart');
        cart = saved ? JSON.parse(saved) : [];
    } catch (e) {
        cart = [];
    }
}

function saveCart() {
    localStorage.setItem('gav_cart', JSON.stringify(cart));
}

function addToCart(productId) {
    const product = allProducts.find(function(p) { return p.id === productId; });
    if (!product) {
        alert('المنتج غير موجود');
        return;
    }

    const existing = cart.find(function(item) { return item.productId === productId; });
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
    alert('✅ تمت إضافة "' + product.name + '" إلى السلة');
}

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

    cart.forEach(function(item, index) {
        totalPi += (item.pricePi * item.quantity);
        totalYER += (item.priceYER * item.quantity);

        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <div class="cart-item-name">${escapeHtml(item.name)}</div>
                <div class="cart-item-price">
                    ${item.pricePi > 0 ? item.pricePi.toFixed(4) + ' Pi' : ''}
                    ${item.pricePi > 0 && item.priceYER > 0 ? ' + ' : ''}
                    ${item.priceYER > 0 ? item.priceYER.toFixed(0) + ' YER' : ''}
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
            if (totalPi > 0) totalText += totalPi.toFixed(4) + ' Pi';
            if (totalPi > 0 && totalYER > 0) totalText += ' + ';
            if (totalYER > 0) totalText += totalYER.toFixed(0) + ' YER';
            totalEl.textContent = totalText || '0';
        }
    }
}

function removeFromCart(index) {
    if (index < 0 || index >= cart.length) return;
    cart.splice(index, 1);
    saveCart();
    updateCartBadge();
    renderCart();
}

function clearCart() {
    if (cart.length === 0) return;
    if (confirm('هل تريد إفراغ السلة؟')) {
        cart = [];
        saveCart();
        updateCartBadge();
        renderCart();
    }
}

function updateCartBadge() {
    const nav = document.querySelector('[data-page="cart"]');
    if (!nav) return;

    const count = cart.reduce(function(sum, item) { return sum + item.quantity; }, 0);
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
// نافذة اختيار المحفظة
// ============================================
function openWalletModal() {
    if (!currentUser) {
        alert('يجب تسجيل الدخول أولاً');
        return;
    }
    if (cart.length === 0) {
        alert('السلة فارغة');
        return;
    }

    const totalPi = cart.reduce(function(sum, item) { return sum + (item.pricePi * item.quantity); }, 0);
    const totalYER = cart.reduce(function(sum, item) { return sum + (item.priceYER * item.quantity); }, 0);

    if (totalPi === 0 && totalYER === 0) {
        alert('لا يوجد مبلغ للدفع');
        return;
    }

    pendingPayment = {
        totalPi: totalPi,
        totalYER: totalYER
    };

    const bigishBalEl = document.getElementById('wallet-bigish-balance');
    const piAmountEl = document.getElementById('wallet-pi-amount');
    const totalEl = document.getElementById('wallet-total');

    const piBal = document.getElementById('pi-balance');
    const yerBal = document.getElementById('yer-balance');

    if (bigishBalEl && piBal && yerBal) {
        bigishBalEl.textContent = piBal.textContent + ' Pi | ' + yerBal.textContent + ' YER';
    }

    if (piAmountEl) {
        piAmountEl.textContent = totalPi.toFixed(4) + ' Pi';
    }

    if (totalEl) {
        let text = '';
        if (totalPi > 0) text += totalPi.toFixed(4) + ' Pi';
        if (totalPi > 0 && totalYER > 0) text += ' + ';
        if (totalYER > 0) text += totalYER.toFixed(0) + ' YER';
        totalEl.textContent = text || '0';
    }

    const modal = document.getElementById('wallet-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeWalletModal() {
    const modal = document.getElementById('wallet-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

function selectWallet(walletType) {
    closeWalletModal();

    if (walletType === 'bigish') {
        checkoutWithBigishYer();
    } else if (walletType === 'pi-browser') {
        checkoutWithPiBrowser();
    }
}

// ============================================
// الدفع عبر BIGISH-YER
// ============================================
async function checkoutWithBigishYer() {
    const btn = document.querySelector('#cart-summary .btn-primary');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'جارٍ الدفع عبر BIGISH-YER...';
    }

    try {
        let successCount = 0;
        let pendingCount = 0;
        let failCount = 0;

        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            try {
                const res = await fetch('/api/checkout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        accessToken: currentUser.accessToken,
                        productId: item.productId,
                        piAmount: item.pricePi * item.quantity,
                        yerAmount: item.priceYER * item.quantity,
                        quantity: item.quantity,
                        walletType: 'bigish-yer'
                    })
                });

                const data = await res.json();
                if (data.success) {
                    if (data.order.status === 'PAID') successCount++;
                    else if (data.order.status === 'PENDING') pendingCount++;
                } else {
                    failCount++;
                }
            } catch (e) {
                failCount++;
            }
        }

        let message = '';
        if (successCount > 0) message += '✅ ' + successCount + ' طلب مدفوع\n';
        if (pendingCount > 0) message += '⏳ ' + pendingCount + ' طلب قيد المعالجة\n';
        if (failCount > 0) message += '❌ ' + failCount + ' طلب فشل';

        if (successCount + pendingCount > 0) {
            alert(message);
            cart = [];
            saveCart();
            updateCartBadge();
            renderCart();
            loadBalanceFromBIGISHYER();
            refreshOrders();
        } else {
            alert('❌ فشلت جميع العمليات\n' + message);
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
// الدفع عبر Pi Browser
// ============================================
async function checkoutWithPiBrowser() {
    if (!pendingPayment) return;

    if (pendingPayment.totalPi <= 0) {
        alert('⚠️ الدفع عبر Pi Browser يتطلب حصة Pi أكبر من 0');
        return;
    }

    const btn = document.querySelector('#cart-summary .btn-primary');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'جارٍ الدفع عبر Pi...';
    }

    try {
        await Pi.createPayment({
            amount: pendingPayment.totalPi,
            memo: 'دفع في GAV (عبر Pi Browser)',
            metadata: {
                type: 'gav_pi_browser_payment',
                totalYer: pendingPayment.totalYER,
                items: cart.map(function(i) { return i.productId; })
            }
        }, {
            onReadyForServerApproval: async function(paymentId) {
                try {
                    await fetch('/api/payments/approve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentId: paymentId })
                    });
                } catch (e) {
                    console.error('Approve error:', e);
                }
            },
            onReadyForServerCompletion: async function(paymentId, txid) {
                try {
                    const res = await fetch('/api/checkout', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accessToken: currentUser.accessToken,
                            productId: cart[0].productId,
                            piAmount: pendingPayment.totalPi,
                            yerAmount: pendingPayment.totalYER,
                            quantity: 1,
                            walletType: 'pi-browser',
                            paymentId: paymentId,
                            txid: txid
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('✅ تم الدفع عبر Pi Browser بنجاح!');
                        cart = [];
                        saveCart();
                        updateCartBadge();
                        renderCart();
                        refreshOrders();
                    }
                } catch (e) {
                    console.error('Complete error:', e);
                }
            },
            onCancel: function(paymentId) {
                alert('تم إلغاء الدفع');
            },
            onError: function(error) {
                alert('خطأ: ' + (error.message || 'غير معروف'));
            }
        });
    } catch (err) {
        alert('خطأ: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '💳 إتمام الدفع';
        }
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    loadCart();
    renderCart();
    updateCartBadge();
});