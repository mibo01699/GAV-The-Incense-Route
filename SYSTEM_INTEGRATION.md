# System Integration Overview (Sandbox/Testnet)

## 🧭 Purpose

This document outlines how GAV integrates with other components of the Arabian Eagle Ecosystem.

## 🔗 Integrated Services

| Service | Purpose | Integration Method |
|---------|---------|-------------------|
| **BIGISH-YER** | Financial settlement | REST API (`/api/yer/transfer`) |
| **AJYAL** | Voucher verification | REST API (`/api/pos/verify-voucher`) |

## 🏗️ Architecture

```

[GAV POS] → [BIGISH-YER API] → [YER Ledger]
↓
[AJYAL API] → [Voucher Verification]

```

## ⚠️ Important

This is a **sandbox/testnet-only prototype**. All API calls are simulated or directed to test endpoints.

> **Note:** No official integration with Pi Network Core Team is claimed.