const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BIGISH_YER_URL = process.env.BIGISH_YER_URL || 'https://bigish-yer.vercel.app';
const GAV_APP_ID = process.env.GAV_APP_ID || 'gav';
const GAV_API_KEY = process.env.GAV_API_KEY || 'gav-secret-pending';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const RATES = {
    piGcvUsd: 314159,
    piAmmUsd: 0.63,
    yerAmmUsd: 0.01,
    priceCapPercent: 15
};

const db = {
    products: [],
    orders: [],
    festivals: []
};

const CATEGORIES = [
    { id: 'incense', name: 'البخور والعطور', icon: '🌿' },
    { id: 'luban', name: 'البان', icon: '🪔' },
    { id: 'dates', name: 'التمور', icon: '🌴' },
    { id: 'textiles', name: 'المنسوجات', icon: '🧵' },
    { id: 'handicrafts', name: 'الحرف اليدوية', icon: '🏺' },
    { id: 'food', name: 'المواد الغذائية', icon: '🥫' },
    { id: 'vegetables', name: 'الخضروات والفواكه', icon: '🥬' },
    { id: 'meat', name: 'اللحوم', icon: '🥩' },
    { id: 'fish', name: 'الأسماك', icon: '🐟' },
    { id: 'beverages', name: 'المشروبات', icon: '🥤' },
    { id: 'coffee', name: 'البن والقهوة', icon: '☕' },
    { id: 'honey', name: 'العسل الطبيعي', icon: '🍯' },
    { id: 'spices', name: 'التوابل', icon: '🌶️' },
    { id: 'gold', name: 'الذهب والمجوهرات', icon: '💍' },
    { id: 'silver', name: 'الفضيات', icon: '🥈' },
    { id: 'clothing', name: 'الملابس', icon: '👕' },
    { id: 'accessories', name: 'الإكسسوارات', icon: '👜' },
    { id: 'cosmetics', name: 'أدوات التجميل', icon: '💄' },
    { id: 'electronics', name: 'الأجهزة الإلكترونية', icon: '📱' },
    { id: 'smartphones', name: 'الهواتف الذكية', icon: '📲' },
    { id: 'hardware', name: 'الخردوات والأدوات', icon: '🔧' },
    { id: 'home', name: 'مستلزمات المنزل', icon: '🏠' },
    { id: 'agriculture', name: 'المستلزمات الزراعية', icon: '🌾' },
    { id: 'others', name: 'أخرى', icon: '📦' }
];

async function verifyUser(accessToken) {
    try {
        const res = await fetch(BIGISH_YER_URL + '/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken: accessToken })
        });
        if (!res.ok) return null;
        const data = await res.json();
        return data.success ? data.user : null;
    } catch (e) {
        return null;
    }
}

// ============================================
// Health & Rates
// ============================================
app.get('/api/health', (req, res) => {
    res.json({
        service: 'gav-the-incense-route',
        status: 'ONLINE',
        timestamp: new Date().toISOString(),
        stats: {
            products: db.products.length,
            orders: db.orders.length,
            festivals: db.festivals.length,
            categories: CATEGORIES.length
        }
    });
});

app.get('/api/rates', (req, res) => {
    res.json({ success: true, rates: RATES });
});

app.get('/api/categories', (req, res) => {
    res.json({ success: true, categories: CATEGORIES, count: CATEGORIES.length });
});

// ============================================
// Products
// ============================================
app.get('/api/products', (req, res) => {
    const category = req.query.category;
    const merchantId = req.query.merchantId;
    let filtered = db.products.slice();
    if (category) filtered = filtered.filter(p => p.category === category);
    if (merchantId) filtered = filtered.filter(p => p.merchantId === merchantId);
    res.json({ success: true, products: filtered, count: filtered.length });
});

app.get('/api/products/:id', (req, res) => {
    const product = db.products.find(p => p.id === req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product: product });
});

app.post('/api/products', async (req, res) => {
    const accessToken = req.body.accessToken;
    const product = req.body.product;
    if (!accessToken || !product) {
        return res.status(400).json({ error: 'accessToken and product required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const newProduct = {
        id: 'prod_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        merchantId: user.uid,
        merchantName: user.username,
        name: product.name,
        description: product.description || '',
        category: product.category || 'incense',
        priceUSD: parseFloat(product.priceUSD) || 0,
        pricePi: parseFloat(product.pricePi) || 0,
        priceYER: parseFloat(product.priceYER) || 0,
        referenceValue: {
            source: product.referenceSource || 'dex',
            piRatio: parseFloat(product.referencePiRatio) || 50
        },
        stock: parseInt(product.stock) || 1,
        createdAt: new Date().toISOString(),
        status: 'ACTIVE'
    };

    db.products.push(newProduct);
    res.json({ success: true, product: newProduct });
});

app.delete('/api/products/:id', async (req, res) => {
    const accessToken = req.body.accessToken;
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
// Checkout
// ============================================
app.post('/api/checkout', async (req, res) => {
    const accessToken = req.body.accessToken;
    const productId = req.body.productId;
    const piAmount = req.body.piAmount;
    const yerAmount = req.body.yerAmount;
    const quantity = req.body.quantity;

    if (!accessToken || !productId) {
        return res.status(400).json({ error: 'accessToken and productId required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const product = db.products.find(p => p.id === productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const qty = parseInt(quantity) || 1;
    const pi = parseFloat(piAmount) || (product.pricePi * qty);
    const yer = parseFloat(yerAmount) || (product.priceYER * qty);

    const order = {
        id: 'ord_' + Date.now(),
        userId: user.uid,
        username: user.username,
        productId: productId,
        productName: product.name,
        merchantId: product.merchantId,
        quantity: qty,
        piAmount: pi,
        yerAmount: yer,
        transactionId: 'TEST-' + Date.now(),
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };
    db.orders.push(order);

    res.json({
        success: true,
        order: order,
        payment: { transactionId: order.transactionId, status: 'PENDING', testnetMode: true }
    });
});

app.get('/api/orders/user/:uid', (req, res) => {
    const uid = req.params.uid;
    const orders = db.orders.filter(o => o.userId === uid || o.merchantId === uid);
    res.json({ success: true, orders: orders });
});

// ============================================
// Converter
// ============================================
app.post('/api/converter', (req, res) => {
    const productUSD = parseFloat(req.body.productUSD);
    const referenceSource = req.body.referenceSource;

    if (!productUSD || productUSD <= 0) {
        return res.status(400).json({ error: 'productUSD required' });
    }

    let piAmount = 0;
    let yerAmount = 0;
    let mode = '';

    if (referenceSource === 'gcvalue') {
        const capitalUSD = productUSD * 0.85;
        const profitUSD = productUSD * 0.15;
        piAmount = profitUSD / RATES.piGcvUsd;
        yerAmount = capitalUSD / RATES.yerAmmUsd;
        mode = 'GCV';
    } else if (referenceSource === 'dex') {
        piAmount = (productUSD * 0.50) / RATES.piAmmUsd;
        yerAmount = (productUSD * 0.50) / RATES.yerAmmUsd;
        mode = 'AMM/DEX';
    } else {
        return res.status(400).json({ error: 'Invalid referenceSource' });
    }

    res.json({
        success: true,
        mode: mode,
        original: { productUSD: productUSD },
        split: {
            piAmount: parseFloat(piAmount.toFixed(10)),
            yerAmount: parseFloat(yerAmount.toFixed(4)),
            piPercentage: referenceSource === 'gcvalue' ? 15 : 50,
            yerPercentage: referenceSource === 'gcvalue' ? 85 : 50
        },
        rates: RATES
    });
});

// ============================================
// Merchant Stats
// ============================================
app.get('/api/merchant/stats/:uid', (req, res) => {
    const uid = req.params.uid;
    const myProducts = db.products.filter(p => p.merchantId === uid);
    const myOrders = db.orders.filter(o => o.merchantId === uid);
    const totalPi = myOrders.reduce((sum, o) => sum + o.piAmount, 0);
    const totalYER = myOrders.reduce((sum, o) => sum + o.yerAmount, 0);

    res.json({
        success: true,
        stats: {
            totalProducts: myProducts.length,
            totalOrders: myOrders.length,
            totalPiEarned: parseFloat(totalPi.toFixed(4)),
            totalYerEarned: parseFloat(totalYER.toFixed(4))
        }
    });
});

// ============================================
// FESTIVALS
// ============================================

app.post('/api/festivals', async (req, res) => {
    const accessToken = req.body.accessToken;
    const festival = req.body.festival;
    if (!accessToken || !festival) {
        return res.status(400).json({ error: 'accessToken and festival required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const newFestival = {
        id: 'fest_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        creatorId: user.uid,
        creatorName: user.username,
        title: festival.title || 'مهرجان مقايضة',
        description: festival.description || '',
        location: festival.location || '',
        country: festival.country || '',
        region: festival.region || '',
        startDate: festival.startDate || new Date().toISOString(),
        endDate: festival.endDate || new Date(Date.now() + 7 * 86400000).toISOString(),
        editors: [user.uid],
        editorNames: [user.username],
        maxEditors: 5,
        products: [],
        exchanges: [],
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };

    db.festivals.push(newFestival);
    res.json({ success: true, festival: newFestival });
});

app.get('/api/festivals', (req, res) => {
    let filtered = db.festivals.filter(f => f.status !== 'PENDING');
    if (req.query.status) filtered = filtered.filter(f => f.status === req.query.status);
    if (req.query.country) filtered = filtered.filter(f => f.country === req.query.country);
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, festivals: filtered, count: filtered.length });
});

app.get('/api/festivals/my/:uid', (req, res) => {
    const uid = req.params.uid;
    const myFestivals = db.festivals.filter(f =>
        f.creatorId === uid || f.editors.indexOf(uid) !== -1
    );
    res.json({ success: true, festivals: myFestivals });
});

app.get('/api/festivals/log/all', (req, res) => {
    const log = db.festivals
        .filter(f => f.status === 'APPROVED' || f.status === 'ACTIVE' || f.status === 'ENDED')
        .map(function(f) {
            const exchanges = f.exchanges || [];
            const totalTransactions = exchanges.length;
            const totalPiValue = exchanges.reduce((sum, e) => sum + (e.piAmount || 0), 0);
            const totalUSDValue = exchanges.reduce((sum, e) => sum + (e.usdValue || 0), 0);

            const categoriesSold = {};
            exchanges.forEach(function(e) {
                const cat = e.category || 'others';
                categoriesSold[cat] = (categoriesSold[cat] || 0) + 1;
            });

            return {
                id: f.id,
                title: f.title,
                location: f.location,
                country: f.country,
                region: f.region,
                status: f.status,
                creatorName: f.creatorName,
                editorsCount: f.editors.length - 1,
                productsOffered: f.products.length,
                summary: {
                    totalTransactions: totalTransactions,
                    totalPiValue: parseFloat(totalPiValue.toFixed(10)),
                    totalUSDValue: parseFloat(totalUSDValue.toFixed(2)),
                    categoriesSold: categoriesSold
                },
                startDate: f.startDate,
                endDate: f.endDate,
                createdAt: f.createdAt
            };
        })
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
        success: true,
        totalFestivals: log.length,
        grandTotalTransactions: log.reduce((sum, f) => sum + f.summary.totalTransactions, 0),
        grandTotalPiValue: parseFloat(log.reduce((sum, f) => sum + f.summary.totalPiValue, 0).toFixed(10)),
        grandTotalUSDValue: parseFloat(log.reduce((sum, f) => sum + f.summary.totalUSDValue, 0).toFixed(2)),
        festivals: log
    });
});

app.get('/api/festivals/:id', (req, res) => {
    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    const exchanges = festival.exchanges || [];
    const summary = {
        totalTransactions: exchanges.length,
        totalPiValue: parseFloat(exchanges.reduce((sum, e) => sum + (e.piAmount || 0), 0).toFixed(10)),
        totalUSDValue: parseFloat(exchanges.reduce((sum, e) => sum + (e.usdValue || 0), 0).toFixed(2))
    };

    res.json({ success: true, festival: festival, summary: summary });
});

app.put('/api/festivals/:id', async (req, res) => {
    const accessToken = req.body.accessToken;
    const updates = req.body.updates;
    if (!accessToken || !updates) {
        return res.status(400).json({ error: 'accessToken and updates required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });
    if (festival.editors.indexOf(user.uid) === -1) {
        return res.status(403).json({ error: 'Not an editor' });
    }

    const allowed = ['title', 'description', 'location', 'country', 'region', 'startDate', 'endDate'];
    allowed.forEach(function(key) {
        if (updates[key] !== undefined) festival[key] = updates[key];
    });

    festival.updatedAt = new Date().toISOString();
    res.json({ success: true, festival: festival });
});

app.post('/api/festivals/:id/add-editor', async (req, res) => {
    const accessToken = req.body.accessToken;
    const editorUid = req.body.editorUid;
    const editorName = req.body.editorName;
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
    if (festival.editors.length >= 6) {
        return res.status(400).json({ error: 'الحد الأقصى 5 محررين' });
    }
    if (festival.editors.indexOf(editorUid) !== -1) {
        return res.status(400).json({ error: 'Editor already added' });
    }

    festival.editors.push(editorUid);
    festival.editorNames.push(editorName || ('User-' + editorUid.slice(0, 6)));
    res.json({ success: true, festival: festival });
});

app.post('/api/festivals/:id/approve', (req, res) => {
    if (req.body.adminKey !== 'ae-admin-2026') {
        return res.status(403).json({ error: 'Invalid admin key' });
    }

    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    festival.status = 'APPROVED';
    festival.approvedAt = new Date().toISOString();
    res.json({ success: true, festival: festival });
});

app.post('/api/festivals/:id/products', async (req, res) => {
    const accessToken = req.body.accessToken;
    const product = req.body.product;
    if (!accessToken || !product) {
        return res.status(400).json({ error: 'accessToken and product required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });
    if (festival.status !== 'APPROVED' && festival.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'المهرجان غير مفعّل' });
    }

    const newOffer = {
        id: 'offer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        sellerId: user.uid,
        sellerName: user.username,
        name: product.name,
        description: product.description || '',
        category: product.category || 'others',
        pricePi: parseFloat(product.pricePi) || 0,
        quantity: parseInt(product.quantity) || 1,
        status: 'AVAILABLE',
        createdAt: new Date().toISOString()
    };

    festival.products.push(newOffer);
    res.json({ success: true, offer: newOffer });
});

app.post('/api/festivals/:id/exchange', async (req, res) => {
    const accessToken = req.body.accessToken;
    const offerId = req.body.offerId;
    const piAmount = parseFloat(req.body.piAmount);
    if (!accessToken || !offerId || !piAmount) {
        return res.status(400).json({ error: 'accessToken, offerId, piAmount required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(f => f.id === req.params.id);
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    const offer = festival.products.find(p => p.id === offerId);
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.status !== 'AVAILABLE') {
        return res.status(400).json({ error: 'العرض غير متاح' });
    }

    const exchange = {
        id: 'exc_' + Date.now(),
        festivalId: festival.id,
        offerId: offerId,
        buyerId: user.uid,
        buyerName: user.username,
        sellerId: offer.sellerId,
        sellerName: offer.sellerName,
        productName: offer.name,
        category: offer.category,
        piAmount: piAmount,
        usdValue: parseFloat((piAmount * 0.63).toFixed(2)),
        status: 'COMPLETED',
        timestamp: new Date().toISOString()
    };

    if (!festival.exchanges) festival.exchanges = [];
    festival.exchanges.push(exchange);

    offer.status = 'SOLD';
    offer.soldAt = new Date().toISOString();
    offer.buyerId = user.uid;

    res.json({ success: true, exchange: exchange });
});

app.delete('/api/festivals/:id/products/:offerId', async (req, res) =>