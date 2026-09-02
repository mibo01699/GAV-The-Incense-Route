# 🦅 GAV - The Incense Route: Decentralized Supply Chain Protocol 🇾🇪

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black.svg)](https://vercel.com/)

> **⚠️ Important:** This is a **sandbox/testnet-only prototype**.  
> It does **NOT** claim official certification or funding from any organization.

---

## 📖 نبذة عن المشروع

**GAV - The Incense Route** (طريق البخور) هو بروتوكول لامركزي لسلاسل التوريد والتتبع، مصمم لإحياء الشبكات التجارية التاريخية في اليمن (البن، العسل، البخور).  
يمكّن البروتوكول التعاونيات الزراعية المحلية من خلال مسارات إمداد قابلة للتحقق عبر البلوكشين، وحلقات تسوية عابرة للحدود غير استغلالية.

---

## 🌍 الرؤية والأهداف

- **تمكين صغار المنتجين** من خلال تتبع شفاف للمنتجات الزراعية.
- **توفير نظام دفع هجين** (Pi + YER) لحماية المنتجين من تقلبات الأسعار.
- **التكامل مع منظومة A.E.C** عبر BIGISH-YER و AJYAL.
- **تعزيز الشفافية ومكافحة الفساد** في سلاسل التوريد.

---

## 🛠️ المكونات الأساسية

| الملف | الوصف |
|-------|-------|
| `server.js` | نقطة الدخول الرئيسية (متوافقة مع Vercel) |
| `gav-pos-engine-v2.js` | محرك نقاط البيع الهجين (متوافق مع BigInt) |
| `incense_route_ledger.js` | نظام دفاتر تتبع البضائع |
| `AuctionLocalizationEngine.js` | دعم 11 لغة عالمية |
| `AuctionSupportSystem.js` | نظام دعم ذكي يعمل بالذكاء الاصطناعي |
| `hybrid-payment-config.js` | إعدادات الدفع الهجين (Pi + YER) |

---

## 🚀 التشغيل والنشر

### التشغيل المحلي

```bash
# استنساخ المستودع
git clone https://github.com/mibo01699/GAV-The-Incense-Route.git
cd GAV-The-Incense-Route

# تثبيت الاعتماديات
npm install

# تشغيل الخادم
npm start
```

النشر على Vercel

المشروع مهيأ مسبقاً للنشر على Vercel. ما عليك سوى:

1. ربط المستودع بحساب Vercel.
2. النشر التلقائي سيتم عند كل رفع للفرع الرئيسي.

---

🔌 واجهات برمجة التطبيقات (APIs)

المسار الطريقة الوصف
/api/health GET التحقق من صحة الخادم
/api/pricing-poll GET محاكاة الاستبيان السعري
/api/pos/verify-voucher POST التحقق من صحة كود المساعدة (AJYAL)
/api/pos/redeem-voucher POST صرف كود المساعدة
/api/localization GET الحصول على الترجمة حسب لغة المتصفح

---

🧪 الاختبارات

```bash
npm test
```

---

🔗 التكامل مع المشاريع الأخرى

المشروع الوصف الرابط
BIGISH-YER البنية التحتية المالية الأساسية GitHub
AJYAL منصة التعليم والمساعدات GitHub
Suppliers Auction منصة المزادات والمشتريات GitHub

---

📄 الترخيص

هذا المشروع مرخص تحت رخصة MIT، مما يجعله متاحاً كمنفعة عامة رقمية (Digital Public Good).

---

📬 التواصل

· Official X: @Arabianeagleaec
· CEO X: @YemenPi
· GitHub: mibo01699

---

🦅 Developed by Arabian Eagle Technology Group (A.E.C.)
Building the Digital Future for Conflict-Affected Regions

