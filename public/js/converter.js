// ============================================
// GAV | Smart Calculator v4 (AMM Only)
// ============================================

let lastCalculation = null;

function openCalculator() {
    const modal = document.getElementById('calculator-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function closeCalculator() {
    const modal = document.getElementById('calculator-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

document.addEventListener('click', function(e) {
    const modal = document.getElementById('calculator-modal');
    if (e.target === modal) closeCalculator();

    const walletModal = document.getElementById('wallet-modal');
    if (e.target === walletModal) closeWalletModal();
});

async function calculateConversion() {
    const usdInput = document.getElementById('calc-usd');
    const usd = parseFloat(usdInput ? usdInput.value : 0);

    if (!usd || usd <= 0) {
        alert('⚠️ أدخل قيمة المنتج بالدولار أولاً');
        return;
    }

    try {
        const res = await fetch('/api/converter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productUSD: usd,
                referenceSource: 'dex'
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'فشل الحساب');

        lastCalculation = data;

        document.getElementById('calc-result-pi').textContent =
            formatAmount(data.split.piAmount) + ' Pi';
        document.getElementById('calc-result-yer').textContent =
            formatAmount(data.split.yerAmount) + ' YER';

        document.getElementById('calc-results').style.display = 'block';

    } catch (err) {
        console.error('Calculator error:', err);
        alert('❌ فشل الحساب: ' + err.message);
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

document.addEventListener('DOMContentLoaded', function() {
    hideCalculatorFAB();
});