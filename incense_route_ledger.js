// incense_route_ledger.js - نظام دفاتر تتبع البضائع
// يستخدم BigInt للعمليات المالية

class IncenseRouteLedger {
    constructor() {
        this.transactions = [];
    }

    addTransaction(productId, farmerId, amountYER) {
        // تحويل المبلغ إلى BigInt
        const amount = BigInt(amountYER);
        
        this.transactions.push({
            productId,
            farmerId,
            amount: amount.toString(),
            timestamp: new Date().toISOString(),
            status: 'PENDING'
        });

        return { success: true, transactionId: this.transactions.length - 1 };
    }

    getTotalAmount() {
        // جمع المبالغ باستخدام BigInt
        return this.transactions.reduce((sum, tx) => sum + BigInt(tx.amount), 0n).toString();
    }
}

module.exports = IncenseRouteLedger;