# GAV Developer API Guide (Sandbox/Testnet)

## 🛠️ Overview

This document describes the API endpoints available in the GAV sandbox environment.

## 📡 Endpoints

### GET `/api/health`
Check service health.

**Response:**
```json
{
  "status": "online",
  "service": "GAV-The-Incense-Route",
  "version": "1.0.0"
}
```

GET /api/pricing-poll

Simulated pricing survey.

Response:

```json
{
  "status": "SUCCESS",
  "system": "BY-GAV-YEM-2026-STABLE",
  "calibratedPriceYER": 105,
  "precision": "BIGINT_COMPLIANT"
}
```

POST /api/pos/verify-voucher

Verify AJYAL voucher code (simulated).

Request:

```json
{
  "code": "ABCD1234",
  "posId": "GAV-POS-001"
}
```

Response:

```json
{
  "success": true,
  "voucher": {
    "code": "ABCD1234",
    "amount": 100,
    "type": "food_basket"
  },
  "message": "الكود صالح للصرف"
}
```

POST /api/pos/redeem-voucher

Redeem AJYAL voucher (simulated).

Request:

```json
{
  "code": "ABCD1234",
  "posId": "GAV-POS-001"
}
```

Response:

```json
{
  "success": true,
  "message": "تم صرف الكود بنجاح",
  "redeemedAt": "2026-09-02T12:00:00.000Z"
}
```

⚠️ Important

All endpoints operate in sandbox mode and do not execute real Pi Network transactions.

Note: No real Pi SDK calls are made. All responses are simulated for testing.