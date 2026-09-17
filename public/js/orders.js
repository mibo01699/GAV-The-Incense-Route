// ============================================
// GAV - The Incense Route | Orders Management
// ============================================

let allOrders = [];

/**
 * تحميل طلبات المستخدم من GAV
 */
async function refreshOrders() {
    if (!currentUser) return;

    const container = document.getElementById('orders-list');
    if (!container) return;

    container.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const res = await fetch(`/api/orders/user/${currentUser.uid}`);
        const data = await res.json();

        if (!data.success) {
            throw new Error(data.error || 'فشل التحميل');
        }

        allOrders = data.orders || [];

        if (allOrders.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد طلبات بعد.</p>';
            return;
        }

        container.innerHTML = '';
        allOrders.forEach(order => {
            container.appendChild(createOrderCard(order));
        });

    } catch (err) {
        console.error("Orders load error:", err);
        container.innerHTML = '<p class="empty-state">فشل تحميل الطلبات.</p>';
    }
}

/**
 * إنشاء بطاقة طلب
 */
function createOrderCard(order) {
    const div = document.createElement('div');
    div.className = 'order-item';

    const statusClass = order.status || 'PENDING';
    const statusText = translateStatus(statusClass);

    let amountHTML = '';
    if (order.piAmount > 0) {
        amountHTML += `<span>${parseFloat(order.piAmount).toFixed(2)} Pi</span>`;
    }
    if (order.piAmount > 0 && order.yerAmount > 0) {
        amountHTML += ' <span>+</span> ';
    }
    if (order.yerAmount > 0) {
        amountHTML += `<span>${parseFloat(order.yerAmount).toFixed(0)} YER</span>`;
    }

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">#${(order.id || '').slice(-8)}</span>
            <span class="order-status ${statusClass}">${statusText}</span>
        </div>
        <div class="order-product">${escapeHtml(order.productName || 'منتج')}</div>
        <div class="order-amount">${amountHTML}</div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            ${formatDate(order.createdAt)}
        </div>
    `;

    div.onclick = () => showOrderDetails(order);
    return div;
}

/**
 * ترجمة حالة الطلب
 */
function translateStatus(status) {
    const map = {
        'PAID': '✅ مدفوع',
        'PENDING': '⏳ قيد الانتظار',
        'SHIPPED': '🚚 تم الشحن',
        'DELIVERED': '📬 تم التسليم',
        'CANCELLED': '❌ ملغي',
        'FAILED': '⚠️ فشل'
    };
    return map[status] || status;
}

/**
 * عرض تفاصيل الطلب
 */
function showOrderDetails(order) {
    let msg = `📋 تفاصيل الطلب\n\n`;
    msg += `رقم الطلب: #${(order.id || '').slice(-8)}\n`;
    msg += `المنتج: ${order.productName || '—'}\n`;
    msg += `الكمية: ${order.quantity || 1}\n`;

    if (order.piAmount > 0) {
        msg += `مبلغ Pi: ${parseFloat(order.piAmount).toFixed(4)}\n`;
    }
    if (order.yerAmount > 0) {
        msg += `مبلغ YER: ${parseFloat(order.yerAmount).toFixed(4)}\n`;
    }

    msg += `الحالة: ${translateStatus(order.status)}\n`;
    if (order.transactionId) {
        msg += `رقم المعاملة: ${order.transactionId.slice(0, 20)}...\n`;
    }
    msg += `التاريخ: ${formatDate(order.createdAt)}`;

    alert(msg);
}

/**
 * تنسيق التاريخ
 */
function formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);

    if (diff < 60) return 'قبل لحظات';
    if (diff < 3600) return `قبل ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `قبل ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 604800) return `قبل ${Math.floor(diff / 86400)} يوم`;

    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * أدوات مساعدة
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * تحميل تلقائي عند التنقل إلى صفحة الطلبات
 */
document.addEventListener('DOMContentLoaded', () => {
    const originalShowPage = window.showPage;
    if (originalShowPage) {
        window.showPage = function(pageName) {
            originalShowPage(pageName);
            if (pageName === 'orders') {
                refreshOrders();
            }
        };
    }
});