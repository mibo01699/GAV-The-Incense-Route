const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const BIGISH_YER_URL = process.env.BIGISH_YER_URL || 'https://bigish-yer.vercel.app';
const GAV_APP_ID = process.env.GAV_APP_ID || 'gav';
const GAV_API_KEY = process.env.GAV_API_KEY || 'gav-secret-pending';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// أسعار التحويل المرجعية
// ============================================
const RATES = {
    piGcvUsd: 314159,
    piAmmUsd: parseFloat(process.env.PI_AMM_RATE) || 0.63,
    yerAmmUsd: parseFloat(process.env.YER_AMM_RATE) || 0.01,
    priceCapPercent: 15,  // هامش 15% كحد أقصى
    source: process.env.PI_AMM_RATE ? 'live' : 'placeholder',
    updatedAt: new Date().toISOString()
};

// ============================================
// Database
// ============================================
const db = {
    products: [],
    orders: [],
    merchants: {},
    festivals: [],
    categories: [
        { id: 'incense', name: 'البخور والعطور', nameEn: 'Incense & Perfumes', icon: '🌿' },
        { id: 'luban', name: 'البان', nameEn: 'Luban', icon: '🪔' },
        { id: 'dates', name: 'التمور', nameEn: 'Dates', icon: '🌴' },
        { id: 'textiles', name: 'المنسوجات', nameEn: 'Textiles', icon: '🧵' },
        { id: 'handicrafts', name: 'الحرف اليدوية', nameEn: 'Handicrafts', icon: '🏺' },
        { id: 'food', name: 'المواد الغذائية', nameEn: 'Food Products', icon: '🥫' },
        { id: 'vegetables', name: 'الخضروات والفواكه', nameEn: 'Vegetables & Fruits', icon: '🥬' },
        { id: 'meat', name: 'اللحوم', nameEn: 'Meat', icon: '🥩' },
        { id: 'fish', name: 'الأسماك', nameEn: 'Fish & Seafood', icon: '🐟' },
        { id: 'beverages', name: 'المشروبات', nameEn: 'Beverages', icon: '🥤' },
        { id: 'coffee', name: 'البن والقهوة', nameEn: 'Coffee', icon: '☕' },
        { id: 'honey', name: 'العسل الطبيعي', nameEn: 'Natural Honey', icon: '🍯' },
        { id: 'spices', name: 'التوابل', nameEn: 'Spices', icon: '🌶️' },
        { id: 'gold', name: 'الذهب والمجوهرات', nameEn: 'Gold & Jewelry', icon: '💍' },
        { id: 'silver', name: 'الفضيات', nameEn: 'Silverware', icon: '🥈' },
        { id: 'clothing', name: 'الملابس', nameEn: 'Clothing', icon: '👕' },
        { id: 'accessories', name: 'الإكسسوارات', nameEn: 'Accessories', icon: '👜' },
        { id: 'cosmetics', name: 'أدوات التجميل', nameEn: 'Cosmetics', icon: '💄' },
        { id: 'electronics', name: 'الأجهزة الإلكترونية', nameEn: 'Electronics', icon: '📱' },
        { id: 'smartphones', name: 'الهواتف الذكية', nameEn: 'Smartphones', icon: '📲' },
        { id: 'hardware', name: 'الخردوات والأدوات', nameEn: 'Hardware & Tools', icon: '🔧' },
        { id: 'home', name: 'مستلزمات المنزل', nameEn: 'Home Supplies', icon: '🏠' },
        { id: 'agriculture', name: 'المستلزمات الزراعية', nameEn: 'Agricultural Supplies', icon: '🌾' },
        { id: 'others', name: 'أخرى', nameEn: 'Others', icon: '📦' }
    ]
};

// ============================================
// Helpers
// ============================================
async function verifyUser(accessToken) {
    try {
        const res = await fetch(`${BIGISH_YER_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.success ? data.user : null;
    } catch (e) {
        console.error('verifyUser error:', e);
        return null;
    }
}

function calculateMaxPrice(piAmount) {
    // السعر المرجعي = Pi DEX AMM
    // السعر المسموح = المرجع + 15%
    const multiplier = 1 + (RATES.priceCapPercent / 100);
    return piAmount * multiplier;
}

// ============================================
// API: Health
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        service: 'gav-the-incense-route',
        status: 'ONLINE',
        environment: NODE_ENV,
        timestamp: new Date().toISOString(),
        integrations: {
            bigishYer: BIGISH_YER_URL,
            appId: GAV_APP_ID,
            apiKeyConfigured: GAV_API_KEY !== 'gav-secret-pending'
        },
        rates: RATES,
        stats: {
            products: db.products.length,
            orders: db.orders.length,
            festivals: db.festivals.length,
            categories: db.categories.length
        }
    });
});

app.get('/api/rates', (req, res) => {
    res.json({
        success: true,
        rates: {
            piGcv: RATES.piGcvUsd,
            piAmm: RATES.piAmmUsd,
            yerAmm: RATES.yerAmmUsd,
            priceCapPercent: RATES.priceCapPercent
        },
        source: RATES.source,
        timestamp: RATES.updatedAt
    });
});

app.get('/api/categories', (req, res) => {
    res.json({ success: true, categories: db.categories, count: db.categories.length });
});

// ============================================
// API: Products
// ============================================
app.get('/api/products', (req, res) => {
    const { category, merchantId, search } = req.query;
    let filtered = [...db.products];

    if (category) filtered = filtered.filter(p => p.category === category);
    if (merchantId) filtered = filtered.filter(p => p.merchantId === merchantId);
    if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(p =>
            p.name.toLowerCase().includes(s) ||
            (p.description && p.description.toLowerCase().includes(s))
        );
    }

    res.json({ success: true, products: filtered, count: filtered.length });
});

app.get('/api/products/:id', (req, res) => {
    const product = db.products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product });
});

app.post('/api/products', async (req, res) => {
    const { accessToken, product } = req.body;
    if (!accessToken || !product) {
        return res.status(400).json({ error: 'accessToken and product required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    // التحقق من هامش 15%
    const refPiPrice = product.pricePi || 0;
    const maxAllowedPi = calculateMaxPrice(refPiPrice);

    if (product.pricePi > maxAllowedPi) {
        return res.status(400).json({
            error: `السعر يتجاوز الحد المسموح به (${RATES.priceCapPercent}% فوق المرجع)`,
            maxAllowed: maxAllowedPi,
            requested: product.pricePi
        });
    }

    const newProduct = {
        id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        merchantId: user.uid,
        merchantName: user.username,
        name: product.name,
        description: product.description || '',
        category: product.category || 'incense',
        priceUSD: parseFloat(product.priceUSD) || 0,
        pricePi: refPiPrice,
        priceYER: parseFloat(product.priceYER) || 0,
        referenceValue: {
            source: product.referenceSource || 'dex',
            piRatio: parseFloat(product.referencePiRatio) || 50,
            maxAllowedPi: maxAllowedPi,
            priceCapPercent: RATES.priceCapPercent,
            updatedAt: new Date().toISOString()
        },
        imageUrl: product.imageUrl || '',
        stock: parseInt(product.stock) || 1,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE'
    };

    db.products.push(newProduct);
    res.json({ success: true, product: newProduct });
});

app.delete('/api/products/:id', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const index = db.products.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    if (db.products[index].merchantId !== user.uid) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    db.products.splice(index, 1);
    res.json({ success: true });
});

// ============================================
// API: Checkout (مع قبول Testnet)
// ============================================
app.post('/api/checkout', async (req, res) => {
    const { accessToken, productId, piAmount, yerAmount, quantity, shippingInfo } = req.body;

    if (!accessToken || !productId) {
        return res.status(400).json({ error: 'accessToken and productId required' });
    }

    try {
        const product = db.products.find(p => p.id === productId);
        if (!product) return res.status(404).json({ error: 'Product not found' });

        const qty = parseInt(quantity) || 1;
        const pi = parseFloat(piAmount) || (product.pricePi * qty);
        const yer = parseFloat(yerAmount) || (product.priceYER * qty);

        let paymentData = { success: false };

        try {
            const paymentResponse = await fetch(`${BIGISH_YER_URL}/api/integration/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-app-id': GAV_APP_ID,
                    'x-api-key': GAV_API_KEY
                },
                body: JSON.stringify({
                    accessToken,
                    piAmount: pi,
                    yerAmount: yer,
                    orderId: `GAV-ORDER-${Date.now()}`,
                    memo: `GAV: ${product.name} × ${qty}`
                })
            });
            paymentData = await paymentResponse.json();
        } catch (e) {
            console.error('Payment gateway error (Testnet mode):', e.message);
            paymentData = { success: false, testnetMode: true };
        }

        const isPending = !paymentData.success;
        const transactionId = paymentData.transactionId || `TEST-${Date.now()}`;

        const order = {
            id: `ord_${Date.now()}`,
            productId,
            productName: product.name,
            merchantId: product.merchantId,
            quantity: qty,
            piAmount: pi,
            yerAmount: yer,
            shippingInfo: shippingInfo || {},
            transactionId: transactionId,
            status: isPending ? 'PENDING' : 'PAID',
            createdAt: new Date().toISOString()
        };
        db.orders.push(order);

        res.json({
            success: true,
            order,
            payment: {
                transactionId: transactionId,
                status: order.status,
                testnetMode: !paymentData.success,
                newPiBalance: paymentData.newPiBalance || 0,
                newYerBalance: paymentData.newYerBalance || 0
            }
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

app.get('/api/orders/user/:uid', (req, res) => {
    const { uid } = req.params;
    const orders = db.orders.filter(o => o.userId === uid || o.merchantId === uid);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, orders });
});

// ============================================
// API: Smart Converter (مع هامش 15%)
// ============================================
app.post('/api/converter', (req, res) => {
    const { productUSD, referenceSource, customPiPrice } = req.body;
    if (!productUSD || parseFloat(productUSD) <= 0) {
        return res.status(400).json({ error: 'productUSD required' });
    }

    const total = parseFloat(productUSD);
    let result = {};

    if (referenceSource === 'gcvalue') {
        const capitalUSD = total * 0.85;
        const profitUSD = total * 0.15;
        const yerAmount = capitalUSD / RATES.yerAmmUsd;
        const piAmount = profitUSD / RATES.piGcvUsd;

        result = {
            mode: 'GCV',
            split: {
                piPercentage: 15,
                yerPercentage: 85,
                piAmount: parseFloat(piAmount.toFixed(10)),
                yerAmount: parseFloat(yerAmount.toFixed(4))
            },
            calculation: {
                capitalUSD: parseFloat(capitalUSD.toFixed(2)),
                profitUSD: parseFloat(profitUSD.toFixed(2)),
                piRateUsed: RATES.piGcvUsd,
                yerRateUsed: RATES.yerAmmUsd
            }
        };
    } else if (referenceSource === 'dex') {
        const piUSD = total * 0.50;
        const yerUSD = total * 0.50;
        const piAmount = piUSD / RATES.piAmmUsd;
        const yerAmount = yerUSD / RATES.yerAmmUsd;

        result = {
            mode: 'AMM/DEX',
            split: {
                piPercentage: 50,
                yerPercentage: 50,
                piAmount: parseFloat(piAmount.toFixed(4)),
                yerAmount: parseFloat(yerAmount.toFixed(4))
            },
            calculation: {
                piUSD: parseFloat(piUSD.toFixed(2)),
                yerUSD: parseFloat(yerUSD.toFixed(2)),
                piRateUsed: RATES.piAmmUsd,
                yerRateUsed: RATES.yerAmmUsd
            }
        };
    } else {
        return res.status(400).json({ error: 'Invalid referenceSource' });
    }

    // إضافة هامش 15% (للمتاجر فقط)
    const maxAllowedPi = result.split.piAmount * (1 + RATES.priceCapPercent / 100);

    res.json({
        success: true,
        original: { productUSD: total },
        ...result,
        priceCap: {
            percent: RATES.priceCapPercent,
            maxAllowedPi: parseFloat(maxAllowedPi.toFixed(10))
        },
        rates: RATES,
        timestamp: new Date().toISOString()
    });
});

// ============================================
// API: Barter Festivals (مهرجانات المقايضة)
// ============================================

// إنشاء مهرجان جديد
app.post('/api/festivals', async (req, res) => {
    const { accessToken, festival } = req.body;
    if (!accessToken || !festival) {
        return res.status(400).json({ error: 'accessToken and festival required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const newFestival = {
        id: `fest_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        creatorId: user.uid,
        creatorName: user.username,
        title: festival.title || 'مهرجان مقايضة',
        description: festival.description || '',
        location: festival.location || '',
        gpsCoordinates: festival.gpsCoordinates || { lat: 0, lng: 0 },
        country: festival.country || '',
        region: festival.region || '',
        startDate: festival.startDate || new Date().toISOString(),
        endDate: festival.endDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        editors: [user.uid],  // المالك كـ أول محرر
        editorNames: [user.username],
        maxEditors: 5,
        products: [],  // عروض المنتجات
        status: 'PENDING',  // PENDING → APPROVED → ACTIVE → ENDED
        createdAt: new Date().toISOString(),
        approvedAt: null
    };

    db.festivals.push(newFestival);
    res.json({ success: true, festival: newFestival });
});

// قائمة المهرجانات (العامة - المعتمدة فقط)
app.get('/api/festivals', (req, res) => {
    const { status, country, region } = req.query;
    let filtered = db.festivals.filter(f => f.status !== 'PENDING'); // لا تظهر المعلقة للعامة

    if (status) filtered = filtered.filter(f => f.status === status);
    if (country) filtered = filtered.filter(f => f.country === country);
    if (region) filtered = filtered.filter(f => f.region === region);

    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, festivals: filtered, count: filtered.length });
});

// مهرجاناتي (التي أنشأتها أو أديرها)
app.get('/api/festivals/my/:uid', (req, res) => {
    const { uid } = req.params;
    const myFestivals = db.festivals.filter(f =>
        f.creatorId === uid || f.editors.includes(uid)
    );
    myFestivals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, festivals: myFestivals });
});

// تفاصيل مهرجان
app.get('/api/festivals/:id', (req, res) => {
    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });
    res.json({ success: true, festival });
});

// تعديل مهرجان (بحاجة إلى أن تكون من المحررين)
app.put('/api/festivals/:id', async (req, res) => {
    const { accessToken, updates } = req.body;
    if (!accessToken || !updates) {
        return res.status(400).json({ error: 'accessToken and updates required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    if (!festival.editors.includes(user.uid)) {
        return res.status(403).json({ error: 'You are not an editor of this festival' });
    }

    // الحقول المسموح تعديلها
    const allowed = ['title', 'description', 'location', 'gpsCoordinates', 'country', 'region', 'startDate', 'endDate'];
    allowed.forEach(key => {
        if (updates[key] !== undefined) festival[key] = updates[key];
    });

    festival.updatedAt = new Date().toISOString();
    festival.lastUpdatedBy = user.username;

    res.json({ success: true, festival });
});

// إضافة محرر (حتى 5 محررين)
app.post('/api/festivals/:id/add-editor', async (req, res) => {
    const { accessToken, editorUid, editorName } = req.body;
    if (!accessToken || !editorUid) {
        return res.status(400).json({ error: 'accessToken and editorUid required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    if (festival.creatorId !== user.uid) {
        return res.status(403).json({ error: 'Only creator can add editors' });
    }

    if (festival.editors.length >= festival.maxEditors + 1) { // +1 للمالك
        return res.status(400).json({ error: `الحد الأقصى ${festival.maxEditors} محررين` });
    }

    if (festival.editors.includes(editorUid)) {
        return res.status(400).json({ error: 'Editor already added' });
    }

    festival.editors.push(editorUid);
    festival.editorNames.push(editorName || `User-${editorUid.slice(0, 6)}`);

    res.json({ success: true, festival });
});

// الموافقة على مهرجان (Admin)
app.post('/api/festivals/:id/approve', (req, res) => {
    const { adminKey } = req.body;
    if (adminKey !== 'ae-admin-2026') {
        return res.status(403).json({ error: 'Invalid admin key' });
    }

    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    festival.status = 'APPROVED';
    festival.approvedAt = new Date().toISOString();

    res.json({ success: true, festival });
});

// إضافة عرض منتج في المهرجان (بأي سعر - حرية كاملة)
app.post('/api/festivals/:id/products', async (req, res) => {
    const { accessToken, product } = req.body;
    if (!accessToken || !product) {
        return res.status(400).json({ error: 'accessToken and product required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) retur