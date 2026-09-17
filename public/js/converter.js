// ============================================
// GAV - The Incense Route | Smart Converter v2
// ============================================

/**
 * تحديث نتيجة المحول
 */
function updateConverter() {
    const totalInput = document.getElementById('converter-total');
    const slider = document.getElementById('ratio-slider');
    const ratioDisplay = document.getElementById('ratio-display');
    const piEl = document.getElementById('converter-pi');
    const yerEl = document.getElementById('converter-yer');

    if (!totalInput || !slider) return;

    const total = parseFloat(totalInput.value) || 0;
    const ratio = parseInt(slider.value) / 100;

    if (ratioDisplay) ratioDisplay.textContent = `${slider.value}% Pi`;

    const piPart = total * ratio;
    const yerPart = total * (1 - ratio);

    if (piEl) piEl.textContent = piPart.toFixed(4) + ' Pi';
    if (yerEl) yerEl.textContent = yerPart.toFixed(0) + ' YER';
}

/**
 * تحديث عرض القيمة المرجعية
 */
function updateReferenceDisplay() {
    const sourceSelect = document.getElementById('reference-source');
    const customValueInput = document.getElementById('reference-custom-value');
    const customGroup = document.getElementById('reference-custom-group');
    const display = document.getElementById('reference-display');

    if (!sourceSelect) return;

    const source = sourceSelect.value;

    if (customGroup) {
        customGroup.style.display = (source === 'custom') ? 'block' : 'none';
    }

    if (display) {
        let text = '';
        let color = '#7f8c8d';

        switch (source) {
            case 'gcvalue':
                text = '💎 314,159 USD — القيمة المرجعية المقترحة';
                color = '#d4af37';
                break;
            case 'dex':
                text = '📈 السعر الحي من Pi DEX AMM (Pi/YER)';
                color = '#2d7a4a';
                break;
            case 'custom':
                const customVal = parseFloat(customValueInput?.value) || 0;
                text = customVal > 0
                    ? `✏️ ${customVal.toLocaleString()} USD — قيمة مخصصة`
                    : '✏️ أدخل قيمة مخصصة أعلاه';
                color = '#4a90e2';
                break;
            default:
                text = 'لم يتم اختيار قيمة مرجعية';
        }

        display.textContent = text;
        display.style.color = color;
        display.style.fontWeight = '600';
    }
}

/**
 * الحصول على القيمة المرجعية الحالية
 */
function getReferenceValue() {
    const sourceSelect = document.getElementById('reference-source');
    const customValueInput = document.getElementById('reference-custom-value');

    if (!sourceSelect) return { source: 'none', value: 0 };

    const source = sourceSelect.value;
    let value = 0;

    switch (source) {
        case 'gcvalue': value = 314159; break;
        case 'dex': value = 0; break;
        case 'custom': value = parseFloat(customValueInput?.value) || 0; break;
    }

    return { source, value };
}

/**
 * تطبيق السعر المقسم على حقول إضافة المنتج
 */
function applyConverterToProduct() {
    const totalInput = document.getElementById('converter-total');
    const slider = document.getElementById('ratio-slider');
    const piPriceInput = document.getElementById('new-product-price-pi');
    const yerPriceInput = document.getElementById('new-product-price-yer');

    if (!totalInput || !slider || !piPriceInput || !yerPriceInput) return;

    const total = parseFloat(totalInput.value) || 0;
    if (total <= 0) {
        alert('⚠️ أدخل السعر الإجمالي أولاً');
        return;
    }

    const ratio = parseInt(slider.value) / 100;
    const piPart = total * ratio;
    const yerPart = total * (1 - ratio);

    piPriceInput.value = piPart.toFixed(4);
    yerPriceInput.value = yerPart.toFixed(0);

    const ref = getReferenceValue();
    let refInfo = '';
    if (ref.source !== 'none') {
        refInfo = `\n\nالقيمة المرجعية: ${ref.value > 0 ? ref.value.toLocaleString() + ' USD' : 'Pi DEX AMM'}`;
    }

    alert(`✅ تم تطبيق التقسيم:\n${piPart.toFixed(4)} Pi\n${yerPart.toFixed(0)} YER${refInfo}`);

    piPriceInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * التحويل عبر API
 */
async function convertWithAPI(totalPrice, currency, piRatio) {
    try {
        const ref = getReferenceValue();
        const res = await fetch('/api/converter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totalPrice: parseFloat(totalPrice),
                currency: currency || 'USD',
                piRatio: parseFloat(piRatio) || 0.5,
                referenceSource: ref.source,
                referenceValue: ref.value
            })
        });

        const data = await res.json();
        if (data.success) return data.split;
        throw new Error(data.error || 'فشل التحويل');
    } catch (e) {
        console.error('Converter API error:', e);
        return null;
    }
}

/**
 * تهيئة المحول عند البدء
 */
document.addEventListener('DOMContentLoaded', () => {
    const totalInput = document.getElementById('converter-total');
    if (totalInput) totalInput.addEventListener('input', updateConverter);

    const sourceSelect = document.getElementById('reference-source');
    if (sourceSelect) sourceSelect.addEventListener('change', updateReferenceDisplay);

    const customValueInput = document.getElementById('reference-custom-value');
    if (customValueInput) customValueInput.addEventListener('input', updateReferenceDisplay);

    // إضافة زر "تطبيق على المنتج"
    const converterCard = document.getElementById('converter-result')?.closest('.card');
    if (converterCard && !converterCard.querySelector('.apply-converter-btn')) {
        const btn = document.createElement('button');
        btn.className = 'btn-secondary apply-converter-btn';
        btn.style.marginTop = '12px';
        btn.textContent = '📋 تطبيق على المنتج الجديد';
        btn.onclick = applyConverterToProduct;
        converterCard.appendChild(btn);
    }

    updateConverter();
    updateReferenceDisplay();
});