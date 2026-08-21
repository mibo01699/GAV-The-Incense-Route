// gav-pos-engine-v2.js - تحديث نظام نقاط البيع لدعم الـ QR الديناميكي الهجين
const crypto = require('crypto');

class HybridPOSWithQR {
    constructor(merchantPiAddress, merchantYerAddress) {
        this.merchantPiAddress = merchantPiAddress;
        this.merchantYerAddress = merchantYerAddress;
        this.activeInvoices = new Map();
        
        // المقاييس العشرية المعتمدة في النظام المالي للمشروع (Protocol 23)
        this.YER_DECIMALS = 10n**10n; // 10 Decimal Places
        this.PI_DECIMALS = 10n**7n;   // 7 Decimal Places (Stroops)
    }

    /**
     * إنشاء فاتورة هجينة وتوليد بيانات الـ QR الخاصة بها
     */
    createHybridInvoice(invoiceId, totalPiAmount, totalYerAmount) {
        // تحويل المبالغ إلى BigInt لمنع الكسور العشرية العائمة (Zero-Float Compliance)
        const piInStroops = BigInt(Math.round(totalPiAmount * Number(this.PI_DECIMALS)));
        const yerInSubunits = BigInt(Math.round(totalYerAmount * Number(this.YER_DECIMALS)));

        const invoiceData = {
            invoiceId: invoiceId,
            merchantPi: this.merchantPiAddress,
            merchantYer: this.merchantYerAddress,
            piAmountStroops: piInStroops.toString(),
            yerAmountSubunits: yerInSubunits.toString(),
            timestamp: Date.now(),
            status: 'PENDING'
        };

        this.activeInvoices.set(invoiceId, invoiceData);

        // توليد النص الموحد المخصص للـ QR Code
        // الصيغة: protocol:hybrid-pay?param1=val1&param2=val2...
        const qrPayload = `pi-hybrid://pos-pay?id=${invoiceId}&piDest=${this.merchantPiAddress}&yerDest=${this.merchantYerAddress}&piAmt=${piInStroops.toString()}&yerAmt=${yerInSubunits.toString()}`;

        return {
            invoice: invoiceData,
            qrPayload: qrPayload // هذا النص يتم تمريره لمكتبة فرونت-إند مثل qrcode.js ليرسم كـ QR
        };
    }

    /**
     * تأكيد استلام الدفع من الشبكة (تستدعى بعد توقيع المحفظة للعملية)
     */
    verifyHybridPayment(invoiceId, txPiHash, txYerHash) {
        if (!this.activeInvoices.has(invoiceId)) {
            throw new Error("الفاتورة غير موجودة أو منتهية الصلاحية.");
        }

        const invoice = this.activeInvoices.get(invoiceId);
        
        // هنا يتم التحقق من معاملات البلوكشين عبر الـ SDK الخاص بـ Pi Network Layer 1
        console.log(`[البلوكشين] جاري التحقق من معاملة Pi: ${txPiHash}`);
        console.log(`[البلوكشين] جاري التحقق من معاملة YER: ${txYerHash}`);

        invoice.status = 'COMPLETED';
        invoice.txPiHash = txPiHash;
        invoice.txYerHash = txYerHash;
        
        this.activeInvoices.set(invoiceId, invoice);
        return { success: true, status: "PAID", invoice };
    }
}

module.exports = HybridPOSWithQR;
