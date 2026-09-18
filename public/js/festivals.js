// ============================================
// GAV - The Incense Route | Festivals v1
// مهرجانات المقايضة - نظام كامل
// ============================================

let allFestivals = [];
let myFestivals = [];

// ============================================
// تحميل المهرجانات العامة
// ============================================
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
        console.error('Festivals load error:', err);
        container.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

// ============================================
// تحميل مهرجاناتي
// ============================================
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
        console.error('My festivals error:', err);
        container.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

// ============================================
// بطاقة مهرجان عام
// ============================================
function createFestivalCard(fest) {
    const div = document.createElement('div');
    div.className = 'order-item';

    const statusBadge = getStatusBadge(fest.status);
    const editorCount = (fest.editors ? fest.editors.length - 1 : 0);

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">🎪 ${escapeHtml(fest.title)}</span>
            <span class="order-status ${fest.status}">${statusBadge}</span>
        </div>
        <div class="order-product">📍 ${escapeHtml(fest.location || '—')}</div>
        <div class="order-amount">
            ${escapeHtml(fest.country || '')} ${fest.region ? ' - ' + escapeHtml(fest.region) : ''}
        </div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            👤 ${escapeHtml(fest.creatorName)} | 🎁 ${fest.products ? fest.products.length : 0} عرض
            ${editorCount > 0 ? ' | 👥 ' + editorCount + ' محررين' : ''}
        </div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:4px;">
            📅 ${formatDate(fest.startDate)} → ${formatDate(fest.endDate)}
        </div>
    `;

    div.onclick = function() { openFestivalDetails(fest.id); };
    return div;
}

// ============================================
// بطاقة مهرجاني
// ============================================
function createMyFestivalCard(fest) {
    const div = document.createElement('div');
    div.className = 'order-item';

    const statusBadge = getStatusBadge(fest.status);

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">🎪 ${escapeHtml(fest.title)}</span>
            <span class="order-status ${fest.status}">${statusBadge}</span>
        </div>
        <div class="order-product">📍 ${escapeHtml(fest.location || '—')}</div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            🎁 ${fest.products ? fest.products.length : 0} عرض | 👥 ${fest.editors ? fest.editors.length : 0} محرر
        </div>
    `;

    div.onclick = function() { openFestivalDetails(fest.id); };
    return div;
}

// ============================================
// إنشاء مهرجان جديد (Modal)
// ============================================
function openCreateFestival() {
    if (!currentUser) return alert('يجب تسجيل الدخول أولاً');

    const title = prompt('🎪 اسم المهرجان:', 'مهرجان مقايضة');
    if (!title) return;

    const description = prompt('📝 وصف المهرجان:', '') || '';
    const location = prompt('📍 العنوان (مكان المهرجان):', '');
    if (!location) return;

    const country = prompt('🌍 الدولة:', '') || '';
    const region = prompt('🏙️ المحافظة/الولاية:', '') || '';

    const startDate = prompt('📅 تاريخ البدء (YYYY-MM-DD):', new Date().toISOString().slice(0, 10)) || new Date().toISOString();
    const endDate = prompt('📅 تاريخ الانتهاء (YYYY-MM-DD):', new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)) || new Date(Date.now() + 7 * 86400000).toISOString();

    createFestival({
        title: title,
        description: description,
        location: location,
        country: country,
        region: region,
        startDate: startDate,
        endDate: endDate
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
            alert('✅ تم إنشاء المهرجان بنجاح!\n\n' +
                  'الحالة: قيد المراجعة (PENDING)\n' +
                  'سيظهر للعامة بعد الموافقة.\n\n' +
                  'رقم المهرجان: ' + data.festival.id.slice(-8));
            await loadMyFestivals();
            await loadFestivals();
        } else {
            alert('❌ فشل الإنشاء: ' + (data.error || 'خطأ غير معروف'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

// ============================================
// فتح تفاصيل مهرجان
// ============================================
async function openFestivalDetails(festivalId) {
    try {
        const res = await fetch('/api/festivals/' + festivalId);
        const data = await res.json();

        if (!data.success) {
            return alert('فشل تحميل المهرجان');
        }

        const fest = data.festival;
        const summary = data.summary || {};

        let msg = '🎪 ' + fest.title + '\n\n';
        msg += '📝 ' + (fest.description || '—') + '\n\n';
        msg += '📍 ' + (fest.location || '—') + '\n';
        msg += '🌍 ' + (fest.country || '') + (fest.region ? ' - ' + fest.region : '') + '\n\n';
        msg += '👤 المنشئ: ' + fest.creatorName + '\n';
        msg += '👥 المحررون: ' + (fest.editors ? fest.editors.length : 1) + '\n';
        msg += '🎁 العروض: ' + (fest.products ? fest.products.length : 0) + '\n';
        msg += '📊 الحالة: ' + getStatusBadge(fest.status) + '\n\n';
        msg += '📅 من: ' + formatDate(fest.startDate) + '\n';
        msg += '📅 إلى: ' + formatDate(fest.endDate) + '\n\n';

        if (summary.totalTransactions > 0) {
            msg += '📈 الملخص:\n';
            msg += '   • عمليات: ' + summary.totalTransactions + '\n';
            msg += '   • قيمة Pi: ' + summary.totalPiValue + '\n';
            msg += '   • قيمة USD: $' + summary.totalUSDValue + '\n\n';
        }

        msg += 'هل تريد عرض تفاصيل العروض؟';

        if (confirm(msg)) {
            showFestivalProducts(fest);
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

// ============================================
// عرض منتجات المهرجان
// ============================================
function showFestivalProducts(fest) {
    if (!fest.products || fest.products.length === 0) {
        return alert('لا توجد عروض في هذا المهرجان بعد.');
    }

    let msg = '🎁 العروض المتاحة:\n\n';
    fest.products.forEach(function(p, i) {
        msg += (i + 1) + '. ' + p.name + '\n';
        msg += '   💰 ' + p.pricePi + ' Pi\n';
        msg += '   📦 ' + p.quantity + ' قطعة\n';
        msg += '   👤 ' + p.sellerName + '\n\n';
    });

    msg += 'هل تريد إضافة عرض منتجك؟';

    if (confirm(msg)) {
        addProductToFestival(fest.id);
    }
}

// ============================================
// إضافة عرض منتج للمهرجان
// ============================================
async function addProductToFestival(festivalId) {
    const name = prompt('اسم المنتج:');
    if (!name) return;

    const description = prompt('وصف المنتج:', '') || '';
    const pricePi = parseFloat(prompt('السعر بـ Pi (حرية كاملة):', '1'));
    if (!pricePi || pricePi <= 0) return;

    const quantity = parseInt(prompt('الكمية:', '1')) || 1;
    const category = prompt('الفئة (incense/luban/dates/textiles/food/...):', 'others') || 'others';

    try {
        const res = await fetch('/api/festivals/' + festivalId + '/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                accessToken: currentUser.accessToken,
                product: {
                    name: name,
                    description: description,
                    category: category,
                    pricePi: pricePi,
                    quantity: quantity
                }
            })
        });

        const data = await res.json();
        if (data.success) {
            alert('✅ تم إضافة العرض بنجاح!');
            openFestivalDetails(festivalId);
        } else {
            alert('❌ فشل: ' + (data.error || 'خطأ'));
        }
    } catch (err) {
        alert('خطأ: ' + err.message);
    }
}

// ============================================
// سجل المهرجانات (Log)
// ============================================
async function loadFestivalLog() {
    const card = document.getElementById('festival-log-card');
    const content = document.getElementById('festival-log-content');
    if (!content) return;

    card.style.display = 'block';
    content.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch('/api/festivals/log/all');
        const data = await res.json();

        if (!data.success) throw new Error('فشل التحميل');

        let html = '';

        // الإجمالي العام
        html += '<div class="stats-grid" style="margin-bottom:16px;">';
        html += '<div class="stat-item"><span class="stat-label">عدد المهرجانات</span><span class="stat-value">' + data.totalFestivals + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">إجمالي العمليات</span><span class="stat-value">' + data.grandTotalTransactions + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">إجمالي Pi</span><span class="stat-value">' + data.grandTotalPiValue + '</span></div>';
        html += '<div class="stat-item"><span class="stat-label">إجمالي USD</span><span class="stat-value">$' + data.grandTotalUSDValue + '</span></div>';
        html += '</div>';

        if (data.festivals.length === 0) {
            html += '<p class="empty-state">لا توجد بيانات بعد.</p>';
        } else {
            html += '<h4 style="color:#1a4d2e;margin:16px 0 8px;">تفاصيل المهرجانات:</h4>';
            data.festivals.forEach(function(f) {
                const cats = Object.keys(f.summary.categoriesSold || {});
                html += '<div class="order-item" style="border-right-color:#d4af37;">';
                html += '<div class="order-header"><span class="order-id">🎪 ' + escapeHtml(f.title) + '</span><span class="order-status ' + f.status + '">' + getStatusBadge(f.status) + '</span></div>';
                html += '<div style="font-size:0.8rem;color:#7f8c8d;">📍 ' + escapeHtml(f.location || '—') + '</div>';
                html += '<div style="font-size:0.8rem;margin-top:6px;"><strong>عمليات:</strong> ' + f.summary.totalTransactions + ' | <strong>Pi:</strong> ' + f.summary.totalPiValue + ' | <strong>USD:</strong> $' + f.summary.totalUSDValue + '</div>';
                if (cats.length > 0) {
                    html += '<div style="font-size:0.72rem;color:#7f8c8d;margin-top:4px;">الفئات: ' + cats.join(', ') + '</div>';
                }
                html += '</div>';
            });
        }

        content.innerHTML = html;
    } catch (err) {
        console.error('Log error:', err);
        content.innerHTML = '<p class="empty-state">فشل التحميل.</p>';
    }
}

// ============================================
// Helpers
// ============================================
function getStatusBadge(status) {
    const map = {
        'PENDING': '⏳ قيد المراجعة',
        'APPROVED': '✅ معتمد',
        'ACTIVE': '🟢 نشط',
        'ENDED': '🔴 منتهي'
    };
    return map[status] || status;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    try {
        return new Date(timestamp).toLocaleDateString('ar-EG', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    } catch (e) {
        return '—';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================
// تحميل تلقائي عند فتح صفحة المهرجانات
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    const originalShowPage = window.showPage;
    if (originalShowPage) {
        window.showPage = function(pageName) {
            originalShowPage(pageName);
            if (pageName === 'festivals') {
                loadFestivals();
                loadMyFestivals();
            }
        };
    }
});