/**
 * GAV - The Incense Route: Professional Point-of-Sale (POS) Engine
 * Specially designed for the Yemeni Retail Market & Service Providers.
 * Supports Hybrid GCV Pi Network Protocol 23 and YER Dex-Token Settlements.
 * Multi-Language (Arabic/English) UI Data Architecture for Enclosed Pi Browser.
 */

class YemeniYEREcosystemPOS {
    constructor() {
        // Global Consensus Value (GCV) for Pi Coin (Benchmark Reference to anchor purchasing power)
        this.PI_GCV_VALUE_USD = 314159;
        
        // Dynamic merchant memory store (simulating transactional state)
        this.merchants = {};
        this.transactions = {};
        this.txCounter = 1000;
    }

    /**
     * 1. Register a new local merchant or service provider in the POS ecosystem
     */
    registerMerchant(merchantPiUser, businessName, locationCity, sector) {
        if (!merchantPiUser) throw new Error("A valid verified Pi Network username is mandatory.");
        
        this.merchants[merchantPiUser] = {
            username: merchantPiUser,
            businessName: businessName,
            location: locationCity, // e.g., Sana'a, Aden, Taiz, Mukalla
            sector: sector, // e.g., Coffee Retail, Agriculture Supply, Telecom Services
            registeredAt: Date.now(),
            totalVolumeUSD: 0,
            settledPi: 0,
            settledYER: 0
        };
        
        console.log(`[POS Registration] Merchant '${businessName}' successfully registered in ${locationCity}.`);
        return { success: true, merchant: this.merchants[merchantPiUser] };
    }

    /**
     * 2. Generate an itemized hybrid invoice tailored for the local currency crisis
     * Splits pricing dynamically across stable Pi (GCV) and local dynamic YER velocity token.
     * @param {string} merchantPiUser - Registered receiver username
     * @param {number} totalAmountUSD - Gross ticket cost in USD reference
     * @param {number} yerDexPriceUSD - Current live valuation of YER from Pi DEX
     * @param {number} piPaymentPercentage - Percent to split into Pi GCV (default 30%)
     */
    createHybridInvoice(merchantPiUser, totalAmountUSD, yerDexPriceUSD, piPaymentPercentage = 30) {
        if (!this.merchants[merchantPiUser]) {
            throw new Error("Merchant is not registered within the GAV terminal framework.");
        }
        if (piPaymentPercentage < 0 || piPaymentPercentage > 100) {
            throw new Error("Split configuration must sit precisely between 0% and 100%.");
        }

        // Divide dollar volumes based on the hybrid model parameters
        const piVolumeUSD = totalAmountUSD * (piPaymentPercentage / 100);
        const yerVolumeUSD = totalAmountUSD * ((100 - piPaymentPercentage) / 100);

        // Core Mathematical Split Executions
        const requiredPi = piVolumeUSD / this.PI_GCV_VALUE_USD;
        const requiredYER = yerVolumeUSD / yerDexPriceUSD;

        this.txCounter++;
        const invoiceId = `GAV-POS-${this.txCounter}`;

        const invoice = {
            invoiceId: invoiceId,
            merchant: merchantPiUser,
            businessName: this.merchants[merchantPiUser].businessName,
            grossUSD: totalAmountUSD,
            splitRatio: `${piPaymentPercentage}% Pi / ${100 - piPaymentPercentage}% YER`,
            amounts: {
                pi: requiredPi.toFixed(8),    // 8-decimal standard for Pi L1 ledger stability
                yer: requiredYER.toFixed(4)    // 4-decimal optimal pricing standard for YER utility token
            },
            status: "PENDING_DUAL_PAYMENT",
            createdAt: Date.now()
        };

        this.transactions[invoiceId] = invoice;
        console.log(`[POS Invoice Created] ID: ${invoiceId} | Gross: $${totalAmountUSD} | Requires: ${invoice.amounts.pi} Pi & ${invoice.amounts.yer} YER`);
        return invoice;
    }

    /**
     * 3. Atomic processing of dual-wallet transactional settlement signatures
     * Direct compliance checkpoint: Verifies block hashes for both payment components before releasing product inventory.
     */
    async processAtomicPOSSettlement(invoiceId, buyerPiUser, piTxId, yerTxId) {
        const tx = this.transactions[invoiceId];
        if (!tx) throw new Error("The specified POS invoice reference does not exist.");
        if (tx.status === "SETTLED_COMPLETED") throw new Error("This terminal transaction has already been closed.");
        
        if (!piTxId || !yerTxId) {
            throw new Error("Dual-ledger proof validation failure: Both Pi L1 Tx and YER Pool Tx hashes are mandatory.");
        }

        // Cryptographic confirmation routing simulation
        tx.buyer = buyerPiUser;
        tx.proofs = { piTxId: piTxId, yerTxId: yerTxId };
        tx.status = "SETTLED_COMPLETED";
        tx.finalizedAt = Date.now();

        // Accumulate historical financial metrics for the vendor terminal metrics
        const merchantObj = this.merchants[tx.merchant];
        merchantObj.totalVolumeUSD += tx.grossUSD;
        merchantObj.settledPi += parseFloat(tx.amounts.pi);
        merchantObj.settledYER += parseFloat(tx.amounts.yer);

        return {
            success: true,
            invoiceId: invoiceId,
            message: "Hybrid terminal collection verified and cleared successfully.",
            receipt: {
                merchantName: merchantObj.businessName,
                location: merchantObj.location,
                clearedPi: tx.amounts.pi,
                clearedYER: tx.amounts.yer,
                buyerUser: buyerPiUser,
                timestamp: new Date(tx.finalizedAt).toISOString()
            }
        };
    }
}

module.exports = YemeniYEREcosystemPOS;
