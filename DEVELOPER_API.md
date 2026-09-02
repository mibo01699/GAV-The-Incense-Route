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