# 🗳️ GAV — Voting & Governance System
## 7-Layer Transparent Community Voting

**Version:** 1.0.0  
**Date:** September 26, 2026

---

## 🎯 Philosophy

GAV's voting system is not a single vote — it is **7 parallel layers**:
- Each layer has a **specific geographic scope**.
- Each layer has **specific voting symbols**.
- Each layer has a **specific impact** on reputation and entitlement.

**Objective:** Multi-dimensional transparent governance that prevents manipulation and ensures credibility.

---

## 📊 The Seven Layers

### Layer 1: Profile Reputation Voting

**Scope:** Public (all users).

**Symbols:** ⭐ (Stars).

**Grantors:**

| Grantor | Stars | Condition |
|:---|:---|:---|
| Regular user | ⭐ | Direct vote |
| Festival participant | ⭐ | Automatic after participation confirmation |
| Festival invitation | ⭐ | Automatic when festival starts |
| Completed exchange | ⭐ | Automatic after exchange completion |
| Festival joiner | ⭐ | From audience at the conference |

**Impact:** Raises/lowers the profile rank.

---

### Layer 2: Festival Voting (Single Country)

**Scope:** Users within the country's borders.

**Symbols:**
- 🥳 = Celebration (strong positive)
- 🤠 = Trust (positive)
- 😱 = Fear (negative)
- 🤬 = Warning (strong negative)

**Applies to:** Festival invitations and events.

**Impact:**
- High 🥳 → Festival promotion.
- High 🤬 → Governance committee review.

---

### Layer 3: Public Voting on Completed Individual Exchanges

**Scope:** Global.

**Symbols:** 👍 / 👎.

**Applies to:** Individual exchanges **after completion**.

**Impact:** Builds a credibility database.

---

### Layer 4: Private Voting on Pending Individual Exchanges

**Scope:** Limited to **20,000 square meters** (nearby users by GPS).

**Symbols:** 🥳 🤠 😱 🤬.

**Applies to:** Barter requests **before execution**.

**Impact:** Matches a real geographic counterpart.

---

### Layer 5: Festival Invitation Voting

**Scope:** Limited to **50,000 square meters**.

**Symbols:** 🥳 🤠 😱 🤬.

**Applies to:** Festival invitations.

**Impact:** Attracts real participants from a wider geographic range.

---

### Layer 6: In-Festival Participant Voting

**Scope:** Festival participants (GPS inside venue).

**Symbols:** 🥳 🤠 😱 🤬.

**Applies to:** Festival events.

**Impact:** Measures festival success.

---

### Layer 7: Public Voting on Completed Festival Exchanges

**Scope:** Global.

**Symbols:** 👍 / 👎.

**Applies to:** Exchanges **after completion**.

**Impact:** Documents public credibility.

---

### Additional Layer: Receipt Confirmation Voting

**Scope:** Global.

**Symbol:** 🤑.

**Applies to:** Product receipt confirmation.

**Impact:** Releases payment (no 72-hour period).

---

## 💰 Vote Values (Micro-Units BigInt)

**⚠️ All values are integers (Micro-units).**

| Symbol | Value (Micro-YER) | Actual Value |
|:---|:---|:---|
| 👍 | +1n | +0.000001 YER |
| 👎 | -1n | -0.000001 YER |
| 🤑 | +100n | +0.000100 YER |
| 🥳 | +10n | +0.000010 YER |
| 🤠 | +5n | +0.000005 YER |
| 😱 | -5n | -0.000005 YER |
| 🤬 | -10n | -0.000010 YER |

**Note:** Values are stored as BigInt; text display adds the decimal point.

---

## 🎯 Voting Rules

### 1. One Vote Per User
- Cannot vote twice on the same post.
- Can change vote (previous is updated).

### 2. Geographic Verification is Mandatory
- Each layer has a defined GPS scope.
- If user is outside scope → vote rejected.

### 3. Time Limit
- Festival voting opens 7 days before festival starts.
- Closes 7 days after it ends.

### 4. Mutual Reputation
- In an exchange, each party rates the other.
- Rating affects both parties' rank.

### 5. Strict Governance
- If 🤬 exceeds 30% → community review opened.
- If 😱 exceeds 50% → operation suspended.
- If 🥳 exceeds 70% → festival receives a badge.

---

## 📊 Voting Impact on Entitlement

### On Reputation:
```

⭐ x 1 → +1 reputation point
⭐ x 10 → +10 reputation points
⭐ x 100 → +100 reputation points

```

### On YER:
```

👍 → +1n Micro-YER
👎 → -1n Micro-YER
🤑 → +100n Micro-YER
🥳 → +10n Micro-YER
🤠 → +5n Micro-YER
😱 → -5n Micro-YER
🤬 → -10n Micro-YER

```

### On Rank:
| Rank | Reputation Required | YER Required |
|:---|:---|:---|
| 😀 Regular User | 0 | 0 |
| 🤓 Formation Ambassador | 100 | 1,000 YER |
| 😎 Country Ambassador | 1,000 | 10,000 YER |
| 🥸 International Ambassador | 10,000 | 100,000 YER |
| 🏆 Global Ambassador | 100,000 | 1,000,000 YER |

---

## 🔐 Anti-Manipulation Protection

### 1. Prevent Duplicate Voting
- Store `userId + postId` in database.
- If exists → update instead of insert.

### 2. Geographic Verification
- Check GPS from image EXIF.
- Compare with voting scope.
- If outside scope → reject.

### 3. Behavior Analysis
- If user votes 100 times in a minute → temporary suspension.
- If duplicate vote repeated → ignore.

### 4. Community Governance
- Community can report manipulation.
- 🤬 vote on the manipulating user.

---

## 📌 Important Notes

### 1. All Numbers Are Integers
- Use BigInt for small values.
- No Float, no ParseFloat.
- Text display adds the decimal.

### 2. Entitlements Are Convertible
- Micro-YER → YER at official launch.
- On Pi Mainnet, conversion is automatic.

### 3. Full Transparency
- Every vote is publicly visible.
- Every result is verifiable.
- Records are permanent.

### 4. No Custody
- No party may hold YER in custody.
- User withdraws whenever they want (after launch).
- No 72-hour period.

---

## 🛠️ Technical Implementation Notes

### BigInt Usage:
```javascript
// Vote values as BigInt
const VOTE_VALUES = {
    '👍': 1n,
    '👎': -1n,
    '🤑': 100n,
    '🥳': 10n,
    '🤠': 5n,
    '😱': -5n,
    '🤬': -10n
};

// Accumulating reputation (safe with BigInt)
let reputation = 0n;
reputation += VOTE_VALUES['👍'];  // Always precise
```

No Float Anywhere:

```javascript
// ❌ FORBIDDEN
const value = parseFloat('0.000001');
const result = 0.1 + 0.2;

// ✅ REQUIRED
const value = 1n;  // Micro-unit
const result = 10000000000n + 20000000000n;  // Exact
```

Validation:

```javascript
// Validate that input is integer
if (!Number.isInteger(input)) {
    throw new Error('Value must be an integer');
}
```

---

© 2026 Arabian Eagle A.E.C
