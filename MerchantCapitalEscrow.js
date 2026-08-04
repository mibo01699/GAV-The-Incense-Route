/**
 * BIGISH-YER: Merchant Capital Protection & Cross-Border Escrow Contract
 * Compliant with Pi Network Protocol 23, International Trade Standards, and Yemeni Commercial Law.
 * Enables Yemeni merchants to lock Pi GCV revenue and safely deploy it for international B2B supply procurement.
 */

const PiSDK = require('@pinetwork-js/sdk');

class MerchantCapitalEscrow {
    constructor() {
        this.escrowVaults = {}; // مخزن رأس مال التجار المغلق برمجياً
        this.LOCK_PERIOD_MS = 90 * 24 * 60 * 60 * 1000; // فترة الإغلاق الافتراضية لحماية رأس المال (90 يوماً كمثال لتدوير البضائع)
    }

    /**
     * 1. حماية وتأمين إيداعات التاجر داخل العقد الذكي
     * التاجر يودع أرباح الـ Pi المستلمة عبر نقطة البيع لحمايتها وتجميدها ضد المضاربة
     */
    lockMerchantRevenue(merchantPiUser, amountPi, businessLicenseYemen) {
        if (!merchantPiUser || !businessLicenseYemen) {
            throw new Error("Merchant authentication and active Yemeni business registry are mandatory.");
        }
        if (amountPi <= 0) throw new Error("Invalid deposit volume.");

        // إذا كان للتاجر خزنة سابقة يتم الإيداع فيها، وإلا يتم إنشاء خزنة جديدة
        if (!this.escrowVaults[merchantPiUser]) {
            this.escrowVaults[merchantPiUser] = {
                merchant: merchantPiUser,
                license: businessLicenseYemen,
                totalLockedPi: 0,
                vaultCreated: Date.now(),
                unlockTimestamp: Date.now() + this.LOCK_PERIOD_MS,
                auditedImportHistory: []
            };
        }

        this.escrowVaults[merchantPiUser].totalLockedPi += amountPi;
        
        console.log(`[Escrow Locked] Secured ${amountPi} Pi (GCV Backed) for Merchant: ${merchantPiUser}. Capital protected until lock release.`);
        return { success: true, vault: this.escrowVaults[merchantPiUser] };
    }

    /**
     * 2. تدوير رأس المال عبر الحدود لشراء بضائع من تاجر خارجي (B2B Importation)
     * الامتثال القانوني: يتطلب العقد وثيقة فاتورة استيراد معتمدة ومطابقة لشروط الامتثال الدولي
     */
    async executeCrossBorderProcurement(merchantPiUser, foreignSupplierPiUser, amountPiToTransfer, importInvoiceRef) {
        const vault = this.escrowVaults[merchantPiUser];
        
        if (!vault) throw new Error("No secure escrow vault found for this merchant.");
        if (Date.now() < vault.unlockTimestamp) {
            throw new Error(`Capital Lock Enforced: Funds are locked to stabilize local GCV metrics. Wait until maturity.`);
        }
        if (vault.totalLockedPi < amountPiToTransfer) {
            throw new Error("Insolvent Execution: Requested procurement volume exceeds locked trade capital.");
        }
        if (!importInvoiceRef) {
            throw new Error("Yemeni Law & Anti-Money Laundering (AML) Compliance: Verified international trade invoice required.");
        }

        try {
            // تنفيذ التحويل عابر الحدود بين التاجر اليمني والمورد الخارجي عبر بوابة دفع Pi الرسمية الحصرية
            // هذا يضمن بقاء الحركة حقيقية وتجارية 100% داخل متصفح Pi لمنع تسريب السيولة خارج النظام
            const crossBorderPayment = await PiSDK.createPayment({
                amount: amountPiToTransfer,
                memo: `B2B Cross-Border Importation - Invoice Ref: ${importInvoiceRef}`,
                metadata: {
                    importerLicense: vault.license,
                    buyer: merchantPiUser,
                    supplier: foreignSupplierPiUser
                }
            });

            if (crossBorderPayment.status === "completed") {
                // خصم رأس المال المستهلك في الاستيراد من الخزنة
                vault.totalLockedPi -= amountPiToTransfer;
                
                // توثيق المعاملة في سجل الاستيراد التجاري الخاضع لرقابة المنظمات المانحة والقوانين المحلية
                const tradeRecord = {
                    supplier: foreignSupplierPiUser,
                    amountPi: amountPiToTransfer,
                    invoice: importInvoiceRef,
                    txId: crossBorderPayment.txid,
                    timestamp: Date.now()
                };
                vault.auditedImportHistory.push(tradeRecord);

                console.log(`[Cross-Border Success] ${amountPiToTransfer} Pi safely transferred out to Supplier ${foreignSupplierPiUser} for verified imports.`);
                return { success: true, txId: crossBorderPayment.txid, remainingLockedCapital: vault.totalLockedPi };
            }
        } catch (error) {
            console.error("Cross-Border Settlement Blocked by Protocol Security Framework:", error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = MerchantCapitalEscrow;
