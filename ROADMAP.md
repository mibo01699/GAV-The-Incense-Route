# 🗺️ GAV — Development Roadmap
## Complete Build Plan v1.0.0

**Version:** 1.0.0  
**Date:** September 26, 2026  
**Target:** Testnet Launch (Full Functional App)

---

## 🎯 Overview

**Total Duration:** 22 working days (approximately 3 weeks)  
**Total Files:** ~50 files  
**Precision:** BigInt only (no floats)

---

## 📐 Global Rules (Non-Negotiable)

1. **File-by-file delivery** — one file per message.
2. **Test after each file** — confirm success before next.
3. **No retrofitting** — no repairs to old code.
4. **No float** — BigInt only for all numeric values.
5. **No YER in Mainnet payment** — Pi-only transactions.
6. **No GCV as official price**.
7. **Server-side verification** — mandatory for all sensitive operations.
8. **Idempotency** — mandatory for all payments.
9. **Audit logging** — every operation logged.
10. **No fake APIs** — only real implementations.

---

## 📅 The Seven Phases

### 🏗️ Phase 1: Backend Foundation
**Duration:** 3 days  
**Files:** 11

#### Day 1: Core Libraries (4 files)
- [ ] `api/_lib/pi-platform.js` — Pi Platform API client
- [ ] `api/_lib/db.js` — In-memory database (BigInt-aware)
- [ ] `api/_lib/auth.js` — Authentication middleware
- [ ] `api/_lib/response.js` — Standardized API responses

#### Day 2: Advanced Libraries (4 files)
- [ ] `api/_lib/validators.js` — Input validation (integer checks)
- [ ] `api/_lib/audit.js` — Audit logging
- [ ] `api/_lib/gps.js` — GPS verification (integer arithmetic)
- [ ] `api/_lib/exif.js` — EXIF photo validation

#### Day 3: Main Server (3 files)
- [ ] `api/_lib/voting.js` — Voting logic (BigInt values)
- [ ] `api/index.js` — Main server entry point
- [ ] **Test:** All endpoints return expected responses

**Checkpoint 1:**
- [ ] Backend runs locally
- [ ] All endpoints tested
- [ ] Pi authentication works
- [ ] No float arithmetic

---

### 🎨 Phase 2: Frontend Core
**Duration:** 3 days  
**Files:** 9

#### Day 4: HTML + CSS (3 files)
- [ ] `public/index.html` — Main page structure
- [ ] `public/css/style.css` — Main styling
- [ ] `public/css/rtl.css` — RTL support

#### Day 5: Pi SDK + API (3 files)
- [ ] `public/js/sdk/pi-config.js` — Pi SDK initialization
- [ ] `public/js/sdk/pi-auth.js` — Pi authentication
- [ ] `public/js/core/api.js` — HTTP client

#### Day 6: Router + State + i18n (3 files)
- [ ] `public/js/core/router.js` — Navigation (showPage)
- [ ] `public/js/core/state.js` — State management
- [ ] `public/js/core/i18n.js` — Translation system

**Checkpoint 2:**
- [ ] Login works
- [ ] Navigation smooth
- [ ] UI renders correctly
- [ ] Language switching works

---

### 📱 Phase 3: Feed + Profile
**Duration:** 3 days  
**Files:** 5

#### Day 7: Feed (2 files)
- [ ] `api/routes/feed.js` — Feed API
- [ ] `public/js/modules/feed.js` — Feed UI

#### Day 8: Profile (2 files)
- [ ] `api/routes/users.js` — Users API
- [ ] `public/js/modules/profile.js` — Profile UI

#### Day 9: Media (1 file)
- [ ] `public/js/modules/media.js` — Photo/video upload

**Checkpoint 3:**
- [ ] Feed loads
- [ ] Profile displays
- [ ] Photo upload works

---

### 🎪 Phase 4: Exchange + Festival
**Duration:** 4 days  
**Files:** 6

#### Day 10: Individual Exchange (2 files)
- [ ] `api/routes/individual.js` — Individual exchange API
- [ ] `public/js/modules/individual-exchange.js` — UI

#### Day 11: Festival (2 files)
- [ ] `api/routes/events.js` — Festival API
- [ ] `public/js/modules/festival.js` — Festival UI

#### Day 12: Exchange Recording (2 files)
- [ ] `api/routes/exchanges.js` — Exchange recording API
- [ ] `public/js/modules/exchanges.js` — Exchange UI

#### Day 13: Testing
- [ ] End-to-end test of exchange flow

**Checkpoint 4:**
- [ ] Create individual exchange
- [ ] Create festival
- [ ] Record exchange
- [ ] GPS verification works

---

### 🗳️ Phase 5: Voting + Governance
**Duration:** 4 days  
**Files:** 6

#### Day 14: Voting Layers 1-7 (2 files)
- [ ] `api/routes/votes.js` — Voting API (7 layers)
- [ ] `public/js/modules/voting.js` — Voting UI

#### Day 15: Governance (2 files)
- [ ] `api/routes/governance.js` — Governance API
- [ ] `public/js/modules/governance.js` — Governance UI

#### Day 16: YER System (2 files)
- [ ] `api/routes/yer.js` — YER API
- [ ] `public/js/modules/yer.js` — YER UI

#### Day 17: Testing
- [ ] Test all 7 voting layers
- [ ] Test YER entitlements

**Checkpoint 5:**
- [ ] All 7 voting layers work
- [ ] YER grants work
- [ ] Governance displays

---

### 🏆 Phase 6: Ambassadors + Wallet + Map
**Duration:** 3 days  
**Files:** 5

#### Day 18: Ambassadors (2 files)
- [ ] `api/routes/ambassadors.js` — Ambassadors API
- [ ] `public/js/modules/ambassadors.js` — Ambassadors UI

#### Day 19: Wallet (2 files)
- [ ] `api/routes/wallet.js` — Wallet API
- [ ] `public/js/modules/wallet.js` — Wallet UI

#### Day 20: Map (1 file)
- [ ] `public/js/modules/map.js` — Global map

**Checkpoint 6:**
- [ ] Ambassador ranks work
- [ ] Wallet displays
- [ ] Map loads

---

### 🌐 Phase 7: Notifications + i18n
**Duration:** 2 days  
**Files:** 5

#### Day 21: Notifications (2 files)
- [ ] `api/routes/notifications.js` — Notifications API
- [ ] `public/js/modules/notifications.js` — Notifications UI

#### Day 22: i18n + Final Testing (3 files)
- [ ] `public/locales/ar.json` — Arabic translations
- [ ] `public/locales/en.json` — English translations
- [ ] **Final end-to-end test**

**Checkpoint 7:**
- [ ] Notifications work
- [ ] Arabic/English switch works
- [ ] Full app works

---

## 🎯 Verification Gates

### After Each File:
1. Upload file.
2. Test in browser.
3. Confirm success.
4. Move to next file.

### If File Fails:
1. Do NOT proceed.
2. Fix the failing file only.
3. Re-test.
4. Confirm success.
5. Move to next file.

### If Multiple Files Fail:
1. STOP.
2. Review the last working checkpoint.
3. Rebuild from that checkpoint.

---

## 📊 Success Criteria

### Technical:
- [ ] Build succeeds.
- [ ] All tests pass.
- [ ] Pi authentication works.
- [ ] Pi payment lifecycle works.
- [ ] GPS verification works.
- [ ] Photo EXIF validation works.
- [ ] All 7 voting layers work.
- [ ] YER entitlements work.
- [ ] No secrets committed.
- [ ] No float arithmetic.
- [ ] BigInt used everywhere needed.

### Functional:
- [ ] User can register.
- [ ] User can log in with Pi.
- [ ] User can create festival.
- [ ] User can create individual exchange.
- [ ] User can record exchange.
- [ ] User can vote (all 7 layers).
- [ ] User can view profile.
- [ ] User can view global map.
- [ ] User can receive notifications.
- [ ] User can switch language.

### Compliance:
- [ ] Pi-only transactions.
- [ ] No YER in Mainnet.
- [ ] No GCV as official.
- [ ] Server-side verification.
- [ ] Idempotency.
- [ ] Audit logging.
- [ ] Minimal data collection.
- [ ] No external redirects.

---

## 🚨 Risk Management

| Risk | Probability | Mitigation |
|:---|:---|:---|
| Pi Auth fails | Medium | Review docs, test extensively |
| GPS fails | Low | Fallback to browser GPS |
| Slow performance | Medium | Optimize queries |
| Deployment fails | Low | Review Vercel logs |
| Pi compliance issue | Low | Review PI_COMPLIANCE.md |
| BigInt conversion error | Low | Test all numeric paths |
| EXIF parsing fails | Low | Use robust library |

---

## 📌 Delivery Order

### Phase 0 (Documentation) — ✅ COMPLETE
1. ✅ PROJECT_VISION.md
2. ✅ VOTING_SYSTEM.md
3. ✅ YER_TOKENOMICS.md
4. ✅ GPS_VERIFICATION.md
5. ✅ SMART_CONTRACT.md
6. ✅ ROADMAP.md (this file)

### Phase 1 (Backend) — NEXT
7. `api/_lib/pi-platform.js`
8. `api/_lib/db.js`
9. `api/_lib/auth.js`
10. `api/_lib/response.js`
11. `api/_lib/validators.js`
12. `api/_lib/audit.js`
13. `api/_lib/gps.js`
14. `api/_lib/exif.js`
15. `api/_lib/voting.js`
16. `api/index.js`

### Phase 2 (Frontend Core) — AFTER PHASE 1
17-25. (9 files)

### Phase 3-7 (Features) — AFTER PHASE 2
26-50. (25 files)

---

## 📌 Discipline Rules

1. **One file per message.**
2. **Test immediately after upload.**
3. **No proceeding until confirmed.**
4. **No skipping steps.**
5. **No retrofitting.**
6. **No improvising.**
7. **No floats.**
8. **BigInt only.**
9. **Pi-only.**
10. **Server-side verification always.**

---

## ✅ Ready to Begin?

**Next file:** `api/_lib/pi-platform.js`

**Action:** Wait for confirmation that ROADMAP.md is uploaded.

**Then:** Send the first Backend file.

---

© 2026 Arabian Eagle A.E.C