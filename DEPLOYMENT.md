# دليل النشر على شبكة Pi Testnet

## المتطلبات الأساسية
- حساب مطور على Pi Network (للحصول على API Key).
- Node.js (الإصدار 18 أو أحدث).
- Python (للـ BIGISH-YER).

## خطوات النشر

### 1. الحصول على مفاتيح API
- سجل دخولك إلى [Pi Developer Portal](https://developers.pi).
- أنشئ تطبيقاً جديداً واحصل على `API Key` و `Wallet ID`.

### 2. إعداد بيئة التشغيل
- انسخ ملف `.env.example` إلى `.env`:
  ```bash
  cp .env.example .env