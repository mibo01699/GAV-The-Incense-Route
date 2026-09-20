// ============================================
// GAV | Festivals v3 (Decentralized + Messages)
// ============================================

let allFestivals = [];
let myFestivals = [];
let currentFestivalIdForMessages = null;
let currentFestivalProducts = [];

async function loadFestivals() {
    const container = document.getElementById('festivals-list');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch('/api/festivals');
        const data = await res.json();
        allFestivals = data.festivals || [];

        if (allFestivals.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد مهرجانات حالياً.</p>';
            return;
        }

        container.innerHTML = '';
        allFestivals.forEach(function(fest) {
            container.appendChild(createFestivalCard(fest));
        });
    } catch (err) {
        container.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

async function loadMyFestivals() {
    if (!currentUser) return;
    const container = document.getElementById('my-festivals-list');
    if (!container) return;

    try {
        const res = await fetch('/api/festivals/my/' + currentUser.uid);
        const data = await res.json();
        myFestivals = data.festivals || [];

        if (myFestivals.length === 0) {
            container.innerHTML = '<p class="empty-state">لم تنشئ أي مهرجان بعد.</p>';
            return;
        }

        container.innerHTML = '';
        myFestivals.forEach(function(fest) {
            container.appendChild(createMyFestivalCard(fest));
        });
    } catch (err) {
        container.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

function createFestivalCard(fest) {
    const div = document.createElement('div');
    div.className = 'order-item';

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">🎪 ${escapeHtmlF(fest.title)}</span>
            <span class="order-status ${fest.status}">${getStatusBadge(fest.status)}</span>
        </div>
        <div class="order-product">📍 ${escapeHtmlF(fest.location || '—')}</div>
        ${fest.directSaleAddress ? `<div style="font-size:0.75rem; color:#d4af37; margin-top:4px;">🏪 ${escapeHtmlF(fest.directSaleAddress)}</div>` : ''}
        <div class="order-amount">${escapeHtmlF(fest.country || '')} ${fest.region ? ' - ' + escapeHtmlF(fest.region) : ''}</div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            👤 ${escapeHtmlF(fest.creatorName)} | 🎁 ${fest.products ? fest.products.length : 0} عرض
        </div>
        <button class="btn-secondary" style="margin-top:8px; padding:6px 12px; font-size:0.8rem;" onclick="event.stopPropagation(); openFestivalMessages('${fest.id}')">💬 مراسلات المهرجان</button>
    `;
    div.onclick = function() { openFestivalDetails(fest.id); };
    return div;
}

function createMyFestivalCard(fest) {
    const div = document.createElement('div');
    div.className = 'order-item';
    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">🎪 ${escapeHtmlF(fest.title)}</span>
            <span class="order-status ${fest.status}">${getStatusBadge(fest.status)}</span>
        </div>
        <div class="order-product">📍 ${escapeHtmlF(fest.location || '—')}</div>
        ${fest.directSaleAddress ? `<div style="font-size:0.75rem; color:#d4af37; margin-top:4px;">🏪 ${escapeHtmlF(fest.directSaleAddress)}</div>` : ''}
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            🎁 ${fest.products ? fest.products.length : 0} عرض
        </div>
    `;
    div.onclick = function() { openFestivalDetails(fest.id); };
    return div;
}

function openCreateFestival() {
    if (!currentUser) return alert('يجب تسجيل الدخول أولاً');

    const title = prompt('🎪 اسم المهرجان:', 'مهرجان مقايضة');
    if (!title) return;
    const description = prompt('📝 وصف المهرجان:', '') || '';
    const location = prompt('📍 العنوان العام:', '');
    if (!location) return;
    const directSaleAddress = prompt('🏪 عنوان البيع المباشر (تفصيلي):', '') || '';
    const country = prompt('🌍 الدولة:', '') || '';
    const region = prompt('🏙️ المحافظة/الولاية:', '') || '';

    createFestival({
        title: title,
        description: description,
        location: location,
        directSaleAddress: directSaleAddress,
        country: country,
        region: region
    });
}

async function createFestival(festivalData) {
    try {
        const res = await fetch('/api/festivals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: currentUser.accessToken,
                festival: festivalData
            })
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ تم إنشاء المهرجان!\n\n📌 المهرجان بحالة "قيد المراجعة".\n\n🔓 سيُعتمد تلقائياً عند إضافة أول عرض منتج.');
            await loadMyFestivals();
            await loadFestivals();
        } else {
            alert('❌ فشل: ' + (data.error || 'خطأ'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

async function openFestivalDetails(festivalId) {
    try {
        const res = await fetch('/api/festivals/' + festivalId);
        const data = await res.json();
        if (!data.success) return alert('فشل تحميل المهرجان');

        const fest = data.festival;
        const summary = data.summary || {};
        currentFestivalProducts = fest.products || [];

        let msg = '🎪 ' + fest.title + '\n\n';
        msg += '📝 ' + (fest.description || '—') + '\n\n';
        msg += '📍 ' + (fest.location || '—') + '\n';
        if (fest.directSaleAddress) msg += '🏪 ' + fest.directSaleAddress + '\n';
        msg += '🌍 ' + (fest.country || '') + (fest.region ? ' - ' + fest.region : '') + '\n\n';
        msg += '👤 المنشئ: ' + fest.creatorName + '\n';
        msg += '🎁 العروض: ' + (fest.products ? fest.products.length : 0) + '\n';
        msg += '📊 الحالة: ' + getStatusBadge(fest.status) + '\n\n';

        if (summary.totalTransactions > 0) {
            msg += '📈 عمليات: ' + summary.totalTransactions + '\n';
            msg += '💰 Pi: ' + summary.totalPiValue + '\n';
            msg += '💵 USD: $' + summary.totalUSDValue + '\n\n';
        }

        if (confirm(msg + 'هل تريد عرض العروض؟')) {
            showFestivalProducts(fest);
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

function showFestivalProducts(fest) {
    if (!fest.products || fest.products.length === 0) {
        if (confirm('لا توجد عروض بعد.\n\nهل تريد إضافة عرض منتجك؟\n(سيؤدي ذلك إلى اعتماد المهرجان تلقائياً)')) {
            addProductToFestival(fest.id);
        }
        return;
    }

    let msg = '🎁 العروض:\n\n';
    fest.products.forEach(function(p, i) {
        msg += (i + 1) + '. ' + p.name + ' — ' + p.pricePi + ' Pi (×' + p.quantity + ')\n';
        msg += '   الكمية: ' + (p.quantity || 1) + ' | النوع: ' + (p.type || '—') + '\n\n';
    });

    if (confirm(msg + '\nهل تريد إضافة عرض منتجك؟')) {
        addProductToFestival(fest.id);
    } else {
        const wantsToBuy = confirm('هل تريد شراء أحد العروض؟\n(سيتم الدفع عبر محفظة Pi Browser)');
        if (wantsToBuy) buyFestivalProduct(fest);
    }
}

async function addProductToFestival(festivalId) {
    const name = prompt('اسم المنتج:');
    if (!name) return;
    const type = prompt('النوع:', '') || '';
    const quantity = parseInt(prompt('الكمية:', '1')) || 1;
    const pricePi = parseFloat(prompt('السعر بـ Pi (حرية كاملة):', '1'));
    if (!pricePi || pricePi <= 0) return;

    try {
        const res = await fetch('/api/festivals/' + festivalId + '/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: currentUser.accessToken,
                product: {
                    name: name,
                    type: type,
                    quantity: quantity,
                    pricePi: pricePi
                }
            })
        });
        const data = await res.json();
        if (data.success) {
            alert('✅ تم إضافة العرض!' + (data.autoApproved ? '\n\n🔓 تم اعتماد المهرجان تلقائياً!' : ''));
            await loadFestivals();
            await loadMyFestivals();
        } else {
            alert('❌ ' + (data.error || 'خطأ'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

async function buyFestivalProduct(fest) {
    if (!fest.products || fest.products.length === 0) return;

    const idx = parseInt(prompt('رقم العرض للشراء (1-' + fest.products.length + '):', '1')) - 1;
    if (idx < 0 || idx >= fest.products.length) return;

    const offer = fest.products[idx];
    if (offer.status !== 'AVAILABLE') {
        return alert('⚠️ هذا العرض لم يعد متاحاً');
    }

    if (!confirm('سيتم الدفع ' + offer.pricePi + ' Pi عبر محفظة Pi Browser.\n\nهل تريد المتابعة؟')) return;

    try {
        await Pi.createPayment({
            amount: offer.pricePi,
            memo: 'شراء في مهرجان: ' + fest.title + ' — ' + offer.name,
            metadata: {
                type: 'festival_purchase',
                festivalId: fest.id,
                offerId: offer.id
            }
        }, {
            onReadyForServerApproval: async function(paymentId) {
                try {
                    await fetch('/api/payments/approve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ paymentId: paymentId })
                    });
                } catch (e) {}
            },
            onReadyForServerCompletion: async function(paymentId, txid) {
                try {
                    const res = await fetch('/api/festivals/' + fest.id + '/exchange', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            accessToken: currentUser.accessToken,
                            offerId: offer.id,
                            piAmount: offer.pricePi,
                            txid: txid
                        })
                    });
                    const data = await res.json();
                    if (data.success) {
                        alert('✅ تم الشراء بنجاح عبر Pi Browser!');
                        await loadFestivals();
                    } else {
                        alert('⚠️ تم الدفع لكن فشل تسجيل المقايضة');
                    }
                } catch (e) {
                    alert('خطأ في التسجيل: ' + e.message);
                }
            },
            onCancel: function() { alert('تم إلغاء الدفع'); },
            onError: function(error) { alert('خطأ: ' + (error.message || 'غير معروف')); }
        });
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

// ============================================
// مراسلات المهرجان
// ============================================
async function openFestivalMessages(festivalId) {
    currentFestivalIdForMessages = festivalId;
    currentProductIdForMessages = null;
    document.getElementById('messages-title').textContent = '💬 مراسلات المهرجان';

    const modal = document.getElementById('messages-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        await loadFestivalMessages(festivalId);
    }
}

async function loadFestivalMessages(festivalId) {
    const container = document.getElementById('messages-list');
    if (!container) return;
    container.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch('/api/festivals/' + festivalId + '/messages');
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const messages = data.messages || [];
        if (messages.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد رسائل بعد. ابدأ النقاش!</p>';
            return;
        }

        container.innerHTML = '';
        messages.forEach(function(msg) {
            const div = document.createElement('div');
            const isMine = currentUser && msg.userId === currentUser.uid;
            div.style.cssText = 'padding:10px; margin-bottom:8px; border-radius:8px; ' +
                (isMine ? 'background:#d4edda; margin-right:20px;' : 'background:#f0f7f3; margin-left:20px;');
            div.innerHTML = '<strong style="font-size:0.8rem;">' + escapeHtmlF(msg.username) + '</strong>' +
                '<p style="margin:4px 0; font-size:0.9rem;">' + escapeHtmlF(msg.text) + '</p>' +
                '<small style="font-size:0.7rem; color:#7f8c8d;">' + formatDateF(msg.timestamp) + '</small>';
            container.appendChild(div);
        });

        container.scrollTop = container.scrollHeight;
    } catch (err) {
        container.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

async function loadFestivalLog() {
    const card = document.getElementById('festival-log-card');
    const content = document.getElementById('festival-log-content');
    if (!content) return;
    card.style.display = 'block';
    content.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch('/api/festivals/log/all');
        const data = await res.json();

        let html = '<div class="stats-grid" style="margin-bottom:16px;">';
        html += '<div class="stat-item"><span class="stat-label">المهرجانات</span><span class="stat-value">' + data.totalFestivals + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">العمليات</span><span class="stat-value">' + data.grandTotalTransactions + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">Pi</span><span class="stat-value">' + data.grandTotalPiValue + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">USD</span><span class="stat-value">$' + data.grandTotalUSDValue + '</span></div>';
        html += '</div>';

        if (data.festivals.length === 0) {
            html += '<p class="empty-state">لا توجد بيانات بعد.</p>';
        } else {
            data.festivals.forEach(function(f) {
                html += '<div class="order-item" style="border-right-color:#d4af37;">';
                html += '<div class="order-header"><span class="order-id">🎪 ' + escapeHtmlF(f.title) + '</span><span class="order-status ' + f.status + '">' + getStatusBadge(f.status) + '</span></div>';
                html += '<div style="font-size:0.8rem;margin-top:6px;">عمليات: ' + f.summary.totalTransactions + ' | Pi: ' + f.summary.totalPiValue + ' | USD: $' + f.summary.totalUSDValue + '</div>';
                html += '</div>';
            });
        }
        content.innerHTML = html;
    } catch (err) {
        content.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

function closeMessages() {
    const modal = document.getElementById('messages-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    currentFestivalIdForMessages = null;
    currentProductIdForMessages = null;
}

function getStatusBadge(status) {
    const map = {
        'PENDING': '⏳ قيد المراجعة',
        'APPROVED': '✅ معتمد',
        'ACTIVE': '🟢 نشط',
        'ENDED': '🔴 منتهي'
    };
    return map[status] || status;
}

function escapeHtmlF(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDateF(timestamp) {
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