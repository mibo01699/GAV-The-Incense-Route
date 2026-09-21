// ============================================
// GAV | Smart Calculator v5
// ============================================

let lastCalculation = null;

function openCalculator() {
    console.log('🧮 openCalculator called');
    const modal = document.getElementById('calculator-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    } else {
        console.error('❌ calculator-modal not found');
    }
}

function closeCalculator() {
    const modal = document.getElementById('calculator-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// ✅ الدالة الرئيسية للحساب
async function calculateConversion() {
    console.log('⚡ calculateConversion called');

    const usdInput = document.getElementById('calc-usd');
    if (!usdInput) {
        alert('❌ خطأ: حقل الإدخال غير موجود');
        return;
    }

    const usd = parseFloat(usdInput.value);
    if (!usd || usd <= 0) {
        alert('⚠️ أدخل قيمة المنتج بالدولار أولاً');
        return;
    }

    const btn = event ? event.target : null;
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'جارٍ الحساب...';
    }

    try {
        console.log('📡 Sending request to /api/converter');
        const res = await fetch('/api/converter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productUSD: usd,
                referenceSource: 'dex'
            })
        });

        console.log('📥 Response status:', res.status);
        const data = await res.json();
        console.log('📥 Response data:', data);

        if (!data.success) {
            throw new Error(data.error || 'فشل الحساب');
        }

        lastCalculation = data;

        const piEl = document.getElementById('calc-result-pi');
        const yerEl = document.getElementById('calc-result-yer');
        const resultsEl = document.getElementById('calc-results');

        if (piEl) piEl.textContent = formatAmount(data.split.piAmount) + ' Pi';
        if (yerEl) yerEl.textContent = formatAmount(data.split.yerAmount) + ' YER';
        if (resultsEl) resultsEl.style.display = 'block';

        console.log('✅ Calculation displayed');

    } catch (err) {
        console.error('❌ Calculator error:', err);
        alert('❌ فشل الحساب: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '⚡ احسب التوزيع';
        }
    }
}

function applyCalculatorToProduct() {
    if (!lastCalculation) {
        alert('⚠️ احسب أولاً');
        return;
    }

    const usdInput = document.getElementById('new-product-price-usd');
    const piInput = document.getElementById('new-product-price-pi');
    const yerInput = document.getElementById('new-product-price-yer');
    const refSource = document.getElementById('new-product-reference-source');
    const ratioField = document.getElementById('new-product-pi-ratio');

    if (usdInput) usdInput.value = lastCalculation.original.productUSD;
    if (piInput) piInput.value = lastCalculation.split.piAmount;
    if (yerInput) yerInput.value = lastCalculation.split.yerAmount;
    if (refSource) refSource.value = 'dex';
    if (ratioField) ratioField.value = 50;

    closeCalculator();

    setTimeout(function() {
        if (usdInput) usdInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);

    alert('✅ تم تطبيق القيم على نموذج المنتج');
}

function formatAmount(num) {
    if (num === 0) return '0';
    if (num >= 1000000) return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.001) return num.toFixed(6);
    return num.toFixed(10);
}

function showCalculatorFAB() {
    const fab = document.getElementById('calculator-fab');
    if (fab) fab.style.display = 'flex';
}

function hideCalculatorFAB() {
    const fab = document.getElementById('calculator-fab');
    if (fab) fab.style.display = 'none';
}

// إغلاق عند النقر خارج النافذة
document.addEventListener('click', function(e) {
    const calcModal = document.getElementById('calculator-modal');
    if (e.target === calcModal) closeCalculator();

    const txModal = document.getElementById('transactions-modal');
    if (e.target === txModal && typeof closeTransactionsLog === 'function') closeTransactionsLog();

    const walletModal = document.getElementById('wallet-modal');
    if (e.target === walletModal && typeof closeWalletModal === 'function') closeWalletModal();

    const msgModal = document.getElementById('messages-modal');
    if (e.target === msgModal && typeof closeMessages === 'function') closeMessages();
});

document.addEventListener('DOMContentLoaded', function() {
    hideCalculatorFAB();
});