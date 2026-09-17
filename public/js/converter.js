// ============================================
// GAV - The Incense Route | Smart Converter
// ============================================

/**
 * تحديث نتيجة المحول عند تحريك الشريط
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

    if (ratioDisplay) {
        ratioDisplay.textContent = `${slider.value}% Pi`;
    }

    const piPart = total * ratio;
    const yerPart = total * (1 - ratio);

    if (piEl) piEl.textContent = piPart.toFixed(4) + ' Pi';
    if (yerEl) yerEl.textContent = yerPart.toFixed(0) + ' YER';
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

    alert(`✅ تم تطبيق التقسيم:\n${piPart.toFixed(4)} Pi\n${yerPart.toFixed(0)} YER`);

    // التمرير لحقول المنتج
    piPriceInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * تحويل سعر مدخل بالكامل (API call)
 */
async function convertWithAPI(totalPrice, currency, piRatio) {
    try {
        const res = await fetch('/api/converter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totalPrice: parseFloat(totalPrice),
                currency: currency || 'Pi',
                piRatio: parseFloat(piRatio) || 0.5
            })
        });

        const data = await res.json();
        if (data.success) {
            return data.split;
        }
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
    if (totalInput) {
        totalInput.addEventListener('input', updateConverter);
    }

    // إضافة زر "تطبيق على المنتج" إذا لم يكن موجوداً
    const converterCard = document.querySelector('#page-merchant .card:has(#converter-result)');
    if (converterCard) {
        const existingBtn = converterCard.querySelector('.apply-converter-btn');
        if (!existingBtn) {
            const btn = document.createElement('button');
            btn.className = 'btn-secondary apply-converter-btn';
            btn.style.marginTop = '12px';
            btn.textContent = '📋 تطبيق على المنتج الجديد';
            btn.onclick = applyConverterToProduct;
            converterCard.appendChild(btn);
        }
    }

    updateConverter();
});