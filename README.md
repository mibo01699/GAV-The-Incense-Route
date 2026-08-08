# GAV - The Incense Route: Decentralized Supply Chain Protocol 🇾🇪

GAV is an open-source, decentralized supply chain provenance and tracking infrastructure built directly on the **Pi Network Layer 1 (Protocol 23)**. It is tailored to protect and revive historical Yemeni trade networks (Coffee, Honey, Incense) by empowering localized smallholder cooperatives through blockchain-verifiable supply paths and non-exploitative cross-border settlement loops.

## 🔄 The Pi GCV + YER DEX Split Engine
To shelter vulnerable rural agricultural producers from volatile pricing structures, GAV implements an advanced **Dual-Wallet Split Payment Engine**. Single-invoices are dynamically partitioned between high-stability **Pi Coins** valued at the **Global Consensus Value (GCV)** standard and high-velocity ecosystem tokens (**YER**) settled via automated market makers on the Pi DEX.

## 🛠️ System Architecture & Mechanics
- **Immutable Ledger Logging:** Tracks agricultural crop processing milestones (Harvest, Quality Certification, Packing, Transport) completely within the enclosed **Pi Browser WebView**.
- **Atomic Escrow Releases:** Integrates with the `BIGISH-YER` contract ecosystem to release instant payments directly to the verified farmer's wallet immediately upon cryptographic proof of delivery, bypassing predatory intermediaries.
- **MIT Digital Public Good:** Developed as a free, transparent public utility aligned directly with **UN SDG 9** (Industry, Innovation, and Infrastructure) and **SDG 12** (Responsible Consumption and Production).

## 🏪 Integrated Hybrid Point-of-Sale (POS) Terminal
The repository now includes `gav-pos-engine.js`, a production-ready Web3 retail engine operating under Protocol 23. It enables local Yemeni service nodes and coffee cooperatives to issue single-invoice checkouts split atomically between stable Pi GCV metrics and fluid YER tokens traded on the Pi DEX AMM.

# GAV-The-Incense-Route: Web3 Logistics & Regional Trade via Pi Network

This repository implements the decentralized logistics and supply chain framework for **"The Incense Route" (GAV)**, an economic model designed to revive regional trade and cross-border commercial corridors for Yemen using the Pi Network infrastructure.

## 🌍 Abstract & Sovereign Trade Utility
By leveraging Pi Network's decentralized ledger, this project bypasses standard banking gridlocks in conflict zones. It establishes transparent, immutable tracking for goods and services while enabling secure peer-to-peer and institutional settlement via the Pi SDK.

## 🛠️ Architecture & Core Components
- `incense_route_ledger.js`: A Node.js ledger system demonstrating the lifecycle of regional cargo tracking, integrated with automated payment escrow hooks via Pi Wallet.
- **Supply Chain Cryptography**: Proof of delivery verification concepts tailored for small and medium enterprises (SMEs) in Yemen.

## 🖥️ Getting Started
To view or test the ledger engine pipeline, execute via Node.js environment:
```bash
node incense_route_ledger.js
```

## 📜 Compliance & Global Funding Focus
Built strictly as a **Digital Public Good**, open for global deployment under the MIT standards, addressing institutional recovery goals set by UNICEF, Mercy Corps Ventures, and developmental funding entities.

## 🏪 نقاط البيع وصرف المساعدات (POS Integration)

يدعم GAV صرف المساعدات العينية (السلات الغذائية) لذوي الاحتياجات الخاصة من خلال التكامل مع نظام الأكواد في AJYAL.

### الميزات الرئيسية:
- **التحقق من الكود:** استدعاء واجهة AJYAL للتحقق من صحة الكود قبل الصرف.
- **صرف السلع:** تأكيد عملية الصرف وتسجيلها في نظام المقاصة.
- **واجهة مستخدم بسيطة:** نموذج سهل لموظفي نقاط البيع.

### واجهات برمجة التطبيقات (APIs) المستخدمة:
- `POST /api/pos/verify-voucher` – التحقق من الكود (ينادي AJYAL).
- `POST /api/pos/redeem-voucher` – صرف الكود (ينادي AJYAL).

### الربط مع التطبيقات الأخرى:
- **AJYAL:** المصدر الرئيسي للأكواد والتحقق.
- **BIGISH-YER:** يستقبل طلبات الدفع لتسوية المستحقات (عبر نظام المقاصة).



