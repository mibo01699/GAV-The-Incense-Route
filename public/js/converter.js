// ============================================
// GAV - The Incense Route | Smart Calculator v3
// Dynamic Calculator with 2 reference modes only
// ============================================

let lastCalculation = null;

// ============================================
// فتح / إغلاق الحاسبة
// ============================================
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

// إغلاق عند النقر خارج النافذة
document.addEventListener('click', (e) => {
    const modal = document.getElementById('calculator-modal');
    if (e.target === modal) closeCalculator();
});

// ============================================
// الحساب
// ============================================
async function calculateConversion() {
    const usdInput = document.getElementById('calc-usd');
    const usd = parseFloat(usdInput?.value);
    const refRadio = document.querySelector('input[name="calc-ref"]:checked');

    if (!usd || usd <= 0) {
        alert('⚠️ أدخل قيمة المنتج بالدولار أولاً');
        return;
    }
    if (!refRadio) {
        alert('⚠️ اختر القيمة المرجعية (GCV أو AMM)');
        return;
    }

    try {
        const res = await fetch('/api/converter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productUSD: usd,
                referenceSource: refRadio.value
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'فشل الحساب');

        lastCalculation = data;

        // عرض النتائج
        document.getElementById('calc-result-pi').textContent =
            formatAmount(data.split.piAmount) + ' Pi';
        document.getElementById('calc-result-yer').textContent =
            formatAmount(data.split.yerAmount) + ' YER';

        const note = document.getElementById('calc-result-note');
        if (data.mode === 'GCV') {
            note.innerHTML = `💎 GCV Mode: 15% Pi (أرباح) + 85% YER (رأس المال)`;
        } else {
            note.innerHTML = `📈 AMM Mode: 50% Pi + 50% YER (توزيع إجباري)`;
        }

        document.getElementById('calc-results').style.display = 'block';

    } catch (err) {
        console.error('Calculator error:', err);
        alert('❌ فشل الحساب: ' + err.message);
    }
}

// ============================================
// تطبيق على المنتج
// ============================================
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
    if (refSource) refSource.value = lastCalculation.mode === 'GCV' ? 'gcvalue' : 'dex';
    if (ratioField) ratioField.value = lastCalculation.split.piPercentage;

    closeCalculator();

    // التمرير إلى نموذج المنتج
    setTimeout(() => {
        if (usdInput) usdInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);

    alert('✅ تم تطبيق القيم على نموذج المنتج');
}

// ============================================
// أدوات مساعدة
// ============================================
function formatAmount(num) {
    if (num === 0) return '0';
    if (num >= 1000000) return num.toLocaleString('en-US', { maximumFractionDigits: 4 });
    if (num >= 1) return num.toFixed(4);
    if (num >= 0.001) return num.toFixed(6);
    return num.toFixed(10);
}

// ============================================
// إظهار زر الحاسبة بعد تسجيل الدخول
// ============================================
function showCalculatorFAB() {
    const fab = document.getElementById('calculator-fab');
    if (fab) fab.style.display = 'flex';
}

function hideCalculatorFAB() {
    const fab = document.getElementById('calculator-fab');
    if (fab) fab.style.display = 'none';
}

// عند تسجيل الدخول
document.addEventListener('DOMContentLoaded', () => {
    // سيتم استدعاء showCalculatorFAB من auth.js عند النجاح
});