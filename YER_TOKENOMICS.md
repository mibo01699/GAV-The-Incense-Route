# 💰 GAV — YER Tokenomics
## YER Token Distribution & Entitlement Model

**Version:** 1.0.0  
**Date:** September 26, 2026  
**Status:** Testnet (Test Token)

---

## ⚠️ Critical Notice

**The current YER token is a TEST TOKEN.**
- It has **no monetary value**.
- It is **not traded** outside GAV.
- It is used **only** to develop the governance system.
- When real YER launches on Pi Mainnet, Testnet entitlements will be converted.

---

## 🎯 Total Supply

**Total YER Supply: 300,000,000 YER**

| Allocation | Amount | Percentage |
|:---|:---|:---|
| **Public Subscription** | 100,000 YER | 0.0333% |
| **Governance Entitlements** | 150,000,000 YER | 50.0000% |
| **Liquidity Pool (Pi/YER)** | 50,000,000 YER | 16.6667% |
| **Community & Public Utility** | 30,000,000 YER | 10.0000% |
| **Ecosystem Launch** | 69,900,000 YER | 23.3000% |
| **TOTAL** | **300,000,000 YER** | **100%** |

---

## 📊 Allocation Breakdown

### 1. Public Subscription (100,000 YER)

**Purpose:** Initial subscription on Pi Launchpad.

**Pair:** 100,000 YER ↔ 500,000 Pi.

**Rate:** 1 YER = 5 Pi (Testnet rate).

**Status:** Awaiting Pi Launchpad activation.

**Distribution:** To public subscribers after launch.

---

### 2. Governance Entitlements (150,000,000 YER)

**Purpose:** Reward community governance participation.

**Distribution Sources:**

| Source | YER Reward |
|:---|:---|
| User registration | 100 YER |
| Completed individual exchange | 500 YER (to seller) |
| Completed festival exchange | 500 YER (to seller) |
| Vote 👍 | +1 micro-YER |
| Vote 👎 | -1 micro-YER |
| Vote 🤑 | +100 micro-YER |
| Vote 🥳 | +10 micro-YER |
| Vote 🤠 | +5 micro-YER |
| Vote 😱 | -5 micro-YER |
| Vote 🤬 | -10 micro-YER |

**Total Budget:** 150,000,000 YER (locked until Pi Mainnet launch).

---

### 3. Liquidity Pool (50,000,000 YER)

**Purpose:** Create Pi/YER liquidity pool on Pi DEX.

**Pair:** Pi / YER.

**AMM Model:** Constant product (x * y = k).

**Status:** Awaiting Pi DEX activation.

**Distribution:** Locked until official DEX launch.

---

### 4. Community & Public Utility (30,000,000 YER)

**Purpose:** Community rewards, public utility, ecosystem growth.

**Distribution:** Community voting determines allocation.

**Status:** Reserved.

---

### 5. Ecosystem Launch (69,900,000 YER)

**Purpose:** Launch incentives, partnerships, ecosystem growth.

**Distribution:** Strategic allocation.

**Status:** Reserved.

---

## 🎁 User Entitlements

### Registration Grant (100 YER)

Every new user receives **100 YER** upon:
1. Complete registration.
2. Connect Pi Browser wallet.

**Storage:** In user's GAV internal balance.

**Withdrawal:** Only after YER official listing on Pi Mainnet.

---

### Exchange Rewards

| Type | Reward | Recipient |
|:---|:---|:---|
| Individual exchange completed | 500 YER | Seller |
| Festival exchange completed | 500 YER | Seller |

**Condition:** Confirmation of receipt by buyer.

---

### Voting Rewards (Micro-Units)

**All values are integers (Micro-YER).**
**1 Micro-YER = 0.000001 YER**

| Symbol | Micro-YER | Display |
|:---|:---|:---|
| 👍 | +1n | +0.000001 YER |
| 👎 | -1n | -0.000001 YER |
| 🤑 | +100n | +0.000100 YER |
| 🥳 | +10n | +0.000010 YER |
| 🤠 | +5n | +0.000005 YER |
| 😱 | -5n | -0.000005 YER |
| 🤬 | -10n | -0.000010 YER |

---

## 🔒 Withdrawal Rules

Users can withdraw YER **only after all three conditions are met:**

1. ✅ YER listed on Pi Launchpad.
2. ✅ YER subscription completed.
3. ✅ Pi/YER liquidity pool opened on Pi DEX via AMM.

**Until then:** YER balance is locked in the user's GAV account.

---

## 📐 Precision Requirements

### BigInt Arithmetic (MANDATORY)

**All YER values are stored as BigInt.**

```javascript
// ✅ CORRECT
const REGISTRATION_GRANT = 100n * 1000000n;  // 100 YER in micro-units
const EXCHANGE_REWARD = 500n * 1000000n;     // 500 YER in micro-units
const VOTE_UP = 1n;                          // +0.000001 YER
const VOTE_DOWN = -1n;                       // -0.000001 YER

// ❌ FORBIDDEN
const grant = 100.0;                         // Float
const reward = parseFloat('500');            // ParseFloat
const value = 0.000001;                      // Decimal
```

No Floating-Point Anywhere

```javascript
// ❌ WRONG: Accumulation error
let balance = 0.1 + 0.2;  // 0.30000000000000004

// ✅ CORRECT: BigInt
let balance = 100000n + 200000n;  // 300000n exact
```

Validation

```javascript
// Ensure all inputs are integers
if (!Number.isInteger(input)) {
    throw new Error('Invalid input: must be integer');
}
```

---

📊 Testnet vs Mainnet

Aspect Testnet (Current) Mainnet (Future)
Token Test YER Real YER
Value 0 Determined by market
Trading Not allowed On Pi DEX
Withdrawal Locked After listing
Conversion N/A Testnet → Mainnet 1:1

---

🎯 Conversion Plan

When real YER launches on Pi Mainnet:

1. Snapshot: Take snapshot of all Testnet YER balances.
2. Conversion: Convert Testnet YER → Mainnet YER 1:1.
3. Verification: Verify all entitlements against source data.
4. Distribution: Distribute Mainnet YER to user wallets.
5. Notification: Notify all users before conversion.

Important: Conversion is 1:1 — every Testnet YER becomes 1 Mainnet YER.

---

🔐 Security Measures

1. No Custody: GAV does not hold user funds.
2. Direct Wallet Link: Pi Browser wallet linked directly.
3. Transparent Ledger: Every transaction logged.
4. Audit Trail: All changes recorded permanently.
5. No Manipulation: Community governance prevents abuse.

---

📌 Summary

Item Value
Total Supply 300,000,000 YER
Public Subscription 100,000 YER
Governance Entitlements 150,000,000 YER
Liquidity Pool 50,000,000 YER
Community & Utility 30,000,000 YER
Ecosystem Launch 69,900,000 YER
Registration Grant 100 YER
Exchange Reward 500 YER
Vote Value ±1 micro-YER
Precision BigInt only

---

© 2026 Arabian Eagle A.E.C
