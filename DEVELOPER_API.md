# GAV Dual-Wallet Integration Guide (Protocol 23 & PiRC1 Compliant)

This specification details how the GAV platform executes atomic, multi-token hybrid payments using the native **Pi Network JavaScript SDK** alongside the **BIGISH-YER DEX Protocol**.

## 🛠️ Enclosed Platform Architecture
To strictly comply with Pi Core Team guidelines, this infrastructure operates 100% within the **Pi Browser WebView**. External redirections, non-Pi oauth mechanisms, and direct fiat endpoints are mathematically prohibited.

## 💻 API Sequence & Event Hooks

### 1. Initializing the Shared Sandbox Environment
Before a producer settlement is triggered, the platform authenticates the Pioneer via `Pi.authenticate()` to map their cryptographic identity to a verified biometric anchor (Pi KYC).

```javascript
Pi.init({ version: "2.0", sandbox: false });

async function signGAVInvoice(invoiceData) {
    const user = await Pi.authenticate(['username', 'payments'], onIncompletePaymentFound);
    console.log(`Authenticated GAV User: ${user.username}`);
    return triggerDualWalletSettlement(invoiceData, user.username);
}
```

### 2. Executing the Dual-Token Atomic Settlement
The platform orchestrates the transaction sequentially. The backend requires verified cryptographic receipts from both the Pi Blockchain ledger and the YER Liquidity Pool before changing the status of physical assets.

```javascript
async function triggerDualWalletSettlement(invoice, username) {
    // Phase A: Initiating the Pi GCV Core Payment
    const piPayment = await Pi.createPayment({
        amount: invoice.requiredPiCoins, // Scaled precisely via Global Consensus Value
        memo: `GAV Route Batch Local Settlement - Pi GCV Portion`,
        metadata: { batchId: invoice.batchId, targetProducer: invoice.producer }
    });

    // Phase B: Initiating the YER DEX Decentralized Service Split
    if (piPayment.status === "completed") {
        const yerPaymentResult = await YERContract.executeAidOrPayroll(
            "GAV_TREASURY_ESCROW", 
            invoice.producer, 
            invoice.requiredYERTokens
        );

        if (yerPaymentResult.success) {
            return finalizeAssetTransfer(invoice.batchId, piPayment.txid, yerPaymentResult.txId);
        }
    }
}
```

## 🔒 Security & Data Integrity Compliance
- **Anti-Phishing Enclosure:** All operations utilize the enclosed Pi payment overlay. No plain-text private keys are handled by the server.
- **Audit Trails:** Transaction identifiers (`txid`) from both the native Pi ledger and the YER 
