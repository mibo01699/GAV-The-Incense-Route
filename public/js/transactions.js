// ============================================
// GAV | Transactions Log v1
// سجل موحد لجميع المعاملات
// ============================================

let allTransactions = [];
let currentFilter = 'all';

function openTransactionsLog() {
    if (!currentUser) return alert('يجب تسجيل الدخول أولاً');

    const modal = document.getElementById('transactions-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        loadTransactions();
    }
}

function closeTransactionsLog() {
    const modal = document.getElementById('transactions-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

async function loadTransactions() {
    const container = document.getElementById('tx-list');
    const summaryDiv = document.getElementById('tx-summary');
    if (!container) return;

    container.innerHTML = '<p class="empty-state">جارٍ التحميل...</p>';

    try {
        const url = '/api/transactions/all/' + currentUser.uid + '?type=' + currentFilter;
        const res = await fetch(url);
        const data = await res.json();

        if (!data.success) throw new Error(data.error || 'فشل التحميل');

        allTransactions = data.transactions || [];

        // عرض الملخص
        if (summaryDiv) {
            summaryDiv.innerHTML = `
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-label">عدد العمليات</span>
                        <span class="stat-value">${data.summary.count}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">إجمالي Pi</span>
                        <span class="stat-value">${formatTxAmount(data.summary.totalPi)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">إجمالي YER</span>
                        <span class="stat-value">${formatTxAmount(data.summary.totalYer)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">إجمالي USD</span>
                        <span class="stat-value">$${data.summary.totalUsd}</span>
                    </div>
                </div>
            `;
        }

        if (allTransactions.length === 0) {
            container.innerHTML = '<p class="empty-state">لا توجد معاملات بعد.</p>';
            return;
        }

        container.innerHTML = '';
        allTransactions.forEach(function(tx) {
            container.appendChild(createTransactionCard(tx));
        });

    } catch (err) {
        console.error('Transactions error:', err);
        container.innerHTML = '<p class="empty-state">فشل تحميل السجل.</p>';
    }
}

function createTransactionCard(tx) {
    const div = document.createElement('div');
    div.className = 'order-item';

    const icon = tx.type === 'FESTIVAL_EXCHANGE' ? '🎪' : '🛒';
    const title = tx.type === 'FESTIVAL_EXCHANGE'
        ? 'مقايضة: ' + (tx.productName || 'منتج')
        : 'بيع: ' + (tx.productName || 'منتج');

    const typeLabel = tx.type === 'FESTIVAL_EXCHANGE' ? 'مهرجان' : 'منتج';
    const walletLabel = tx.walletType === 'pi-browser' ? 'π Pi Browser' : '🦅 BIGISH-YER';

    div.innerHTML = `
        <div class="order-header">
            <span class="order-id">${icon} ${escapeHtmlTx(title)}</span>
            <span class="order-status ${tx.status}">${getTxStatusBadge(tx.status)}</span>
        </div>
        <div class="order-product" style="font-size:0.85rem;color:#7f8c8d;">
            ${typeLabel} | ${walletLabel} | ${formatTxDate(tx.timestamp)}
        </div>
        <div class="order-amount" style="font-weight:700;">
            ${formatTxValues(tx)}
        </div>
        <div style="font-size:0.72rem;color:#7f8c8d;margin-top:6px;">
            مرجع السعر: ${escapeHtmlTx(tx.referenceSource || 'Pi DEX AMM')}
        </div>
    `;

    div.onclick = function() { showTxDetails(tx); };
    return div;
}

function formatTxValues(tx) {
    let parts = [];
    if (tx.piAmount > 0) parts.push(formatTxAmount(tx.piAmount) + ' Pi');
    if (tx.yerAmount > 0) parts.push(formatTxAmount(tx.yerAmount) + ' YER');
    if (parts.length === 0) parts.push('—');
    return parts.join(' + ');
}

function formatTxAmount(num) {
    if (!num && num !== 0) return '0';
    if (num >= 1000000) return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.001) return num.toFixed(6);
    return num.toFixed(10);
}

function getTxStatusBadge(status) {
    const map = {
        'PAID': '✅ مدفوع',
        'PENDING': '⏳ قيد المعالجة',
        'COMPLETED': '✅ مكتمل',
        'FAILED': '❌ فشل',
        'CANCELLED': '🚫 ملغي'
    };
    return map[status] || status;
}

function formatTxDate(timestamp) {
    if (!timestamp) return '—';
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return 'قبل لحظات';
        if (diff < 3600) return 'قبل ' + Math.floor(diff / 60) + ' دقيقة';
        if (diff < 86400) return 'قبل ' + Math.floor(diff / 3600) + ' ساعة';
        return date.toLocaleDateString('ar-EG');
    } catch (e) {
        return '—';
    }
}

function showTxDetails(tx) {
    let msg = '📋 تفاصيل المعاملة\n\n';
    msg += 'النوع: ' + (tx.type === 'FESTIVAL_EXCHANGE' ? 'مقايضة في مهرجان' : 'بيع منتج') + '\n';
    msg += 'المنتج: ' + (tx.productName || '—') + '\n';
    if (tx.festivalTitle) msg += 'المهرجان: ' + tx.festivalTitle + '\n';
    if (tx.sellerName) msg += 'البائع: ' + tx.sellerName + '\n';
    if (tx.merchantName) msg += 'التاجر: ' + tx.merchantName + '\n';
    msg += 'المبلغ: ' + formatTxValues(tx) + '\n';
    msg += 'القيمة بالدولار: $' + (tx.usdValue || 0) + '\n';
    msg += 'المحفظة: ' + (tx.walletType === 'pi-browser' ? 'Pi Browser' : 'BIGISH-YER') + '\n';
    msg += 'مرجع السعر: ' + (tx.referenceSource || 'Pi DEX AMM') + '\n';
    msg += 'رقم المعاملة: ' + (tx.transactionId || '—') + '\n';
    msg += 'الحالة: ' + getTxStatusBadge(tx.status) + '\n';
    msg += 'التاريخ: ' + formatTxDate(tx.timestamp);

    alert(msg);
}

function filterTransactions(type) {
    currentFilter = type;

    // تحديث الأزرار
    document.querySelectorAll('.tx-filter-btn').forEach(function(btn) {
        btn.classList.remove('active');
        if (btn.dataset.filter === type) btn.classList.add('active');
    });

    loadTransactions();
}

function escapeHtmlTx(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// إغلاق عند النقر خارج النافذة
document.addEventListener('click', function(e) {
    const modal = document.getElementById('transactions-modal');
    if (e.target === modal) closeTransactionsLog();
});
