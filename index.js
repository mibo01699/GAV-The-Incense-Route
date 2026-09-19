const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const BIGISH_YER_URL = process.env.BIGISH_YER_URL || 'https://bigish-yer.vercel.app';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const RATES = {
    piGcvUsd: 314159,
    piAmmUsd: 0.63,
    yerAmmUsd: 0.01,
    priceCapPercent: 15
};

const db = { products: [], orders: [], festivals: [] };

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
    { id: 'medicines', name: 'الأدوية', icon: '💊' },
    { id: 'supplements', name: 'المكملات الغذائية', icon: '🧴' },
    { id: 'sanitary', name: 'الأدوات الصحية', icon: '🚿' },
    { id: 'constructionTools', name: 'أدوات البناء', icon: '🔨' },
    { id: 'constructionMaterials', name: 'مواد البناء', icon: '🧱' },
    { id: 'electricalTools', name: 'أدوات الكهرباء', icon: '⚡' },
    { id: 'plumbingTools', name: 'أدوات السباكة', icon: '🔩' },
    { id: 'tiles', name: 'البلاط', icon: '🟫' },
    { id: 'ceramics', name: 'السيراميك', icon: '🔲' },
    { id: 'vehicles', name: 'المركبات', icon: '🚗' },
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

app.get('/api/health', function(req, res) {
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

app.get('/api/rates', function(req, res) {
    res.json({ success: true, rates: RATES });
});

app.get('/api/categories', function(req, res) {
    res.json({ success: true, categories: CATEGORIES, count: CATEGORIES.length });
});

app.get('/api/products', function(req, res) {
    let filtered = db.products.slice();
    if (req.query.category) {
        filtered = filtered.filter(function(p) { return p.category === req.query.category; });
    }
    if (req.query.merchantId) {
        filtered = filtered.filter(function(p) { return p.merchantId === req.query.merchantId; });
    }
    res.json({ success: true, products: filtered, count: filtered.length });
});

app.get('/api/products/:id', function(req, res) {
    const product = db.products.find(function(p) { return p.id === req.params.id; });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true, product: product });
});

app.post('/api/products', async function(req, res) {
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

app.delete('/api/products/:id', async function(req, res) {
    const accessToken = req.body.accessToken;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const index = db.products.findIndex(function(p) { return p.id === req.params.id; });
    if (index === -1) return res.status(404).json({ error: 'Product not found' });
    if (db.products[index].merchantId !== user.uid) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    db.products.splice(index, 1);
    res.json({ success: true });
});

app.post('/api/checkout', async function(req, res) {
    const accessToken = req.body.accessToken;
    const productId = req.body.productId;
    if (!accessToken || !productId) {
        return res.status(400).json({ error: 'accessToken and productId required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const product = db.products.find(function(p) { return p.id === productId; });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const qty = parseInt(req.body.quantity) || 1;
    const pi = parseFloat(req.body.piAmount) || (product.pricePi * qty);
    const yer = parseFloat(req.body.yerAmount) || (product.priceYER * qty);

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
        payment: {
            transactionId: order.transactionId,
            status: 'PENDING',
            testnetMode: true
        }
    });
});
app.get('/api/orders/user/:uid', function(req, res) {
    const uid = req.params.uid;
    const orders = db.orders.filter(function(o) {
        return o.userId === uid || o.merchantId === uid;
    });
    res.json({ success: true, orders: orders });
});

app.post('/api/converter', function(req, res) {
    const productUSD = parseFloat(req.body.productUSD);
    const referenceSource = req.body.referenceSource;
    if (!productUSD || productUSD <= 0) {
        return res.status(400).json({ error: 'productUSD required' });
    }

    let piAmount = 0;
    let yerAmount = 0;
    let mode = '';

    if (referenceSource === 'gcvalue') {
        piAmount = (productUSD * 0.15) / RATES.piGcvUsd;
        yerAmount = (productUSD * 0.85) / RATES.yerAmmUsd;
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

app.get('/api/merchant/stats/:uid', function(req, res) {
    const uid = req.params.uid;
    const myProducts = db.products.filter(function(p) { return p.merchantId === uid; });
    const myOrders = db.orders.filter(function(o) { return o.merchantId === uid; });
    const totalPi = myOrders.reduce(function(sum, o) { return sum + o.piAmount; }, 0);
    const totalYER = myOrders.reduce(function(sum, o) { return sum + o.yerAmount; }, 0);

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

app.post('/api/festivals', async function(req, res) {
    const accessToken = req.body.accessToken;
    const festival = req.body.festival;
    if (!accessToken || !festival) {
        return res.status(400).json({ error: 'accessToken and festival required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const newFestival = {
        id: 'fest_' + Date.now(),
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
        products: [],
        exchanges: [],
        status: 'PENDING',
        createdAt: new Date().toISOString()
    };

    db.festivals.push(newFestival);
    res.json({ success: true, festival: newFestival });
});

app.get('/api/festivals', function(req, res) {
    let filtered = db.festivals.filter(function(f) { return f.status !== 'PENDING'; });
    filtered.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
    res.json({ success: true, festivals: filtered, count: filtered.length });
});

app.get('/api/festivals/log/all', function(req, res) {
    const log = db.festivals
        .filter(function(f) { return f.status !== 'PENDING'; })
        .map(function(f) {
            const exchanges = f.exchanges || [];
            const totalPiValue = exchanges.reduce(function(sum, e) { return sum + (e.piAmount || 0); }, 0);
            const totalUSDValue = exchanges.reduce(function(sum, e) { return sum + (e.usdValue || 0); }, 0);
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
                editorsCount: f.editors ? f.editors.length - 1 : 0,
                productsOffered: f.products ? f.products.length : 0,
                summary: {
                    totalTransactions: exchanges.length,
                    totalPiValue: parseFloat(totalPiValue.toFixed(10)),
                    totalUSDValue: parseFloat(totalUSDValue.toFixed(2)),
                    categoriesSold: categoriesSold
                },
                startDate: f.startDate,
                endDate: f.endDate,
                createdAt: f.createdAt
            };
        });

    res.json({
        success: true,
        totalFestivals: log.length,
        grandTotalTransactions: log.reduce(function(sum, f) { return sum + f.summary.totalTransactions; }, 0),
        grandTotalPiValue: parseFloat(log.reduce(function(sum, f) { return sum + f.summary.totalPiValue; }, 0).toFixed(10)),
        grandTotalUSDValue: parseFloat(log.reduce(function(sum, f) { return sum + f.summary.totalUSDValue; }, 0).toFixed(2)),
        festivals: log
    });
});

app.get('/api/festivals/my/:uid', function(req, res) {
    const uid = req.params.uid;
    const myFestivals = db.festivals.filter(function(f) {
        return f.creatorId === uid || (f.editors && f.editors.indexOf(uid) !== -1);
    });
    res.json({ success: true, festivals: myFestivals });
});

app.get('/api/festivals/:id', function(req, res) {
    const festival = db.festivals.find(function(f) { return f.id === req.params.id; });
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    const exchanges = festival.exchanges || [];
    const summary = {
        totalTransactions: exchanges.length,
        totalPiValue: parseFloat(exchanges.reduce(function(sum, e) { return sum + (e.piAmount || 0); }, 0).toFixed(10)),
        totalUSDValue: parseFloat(exchanges.reduce(function(sum, e) { return sum + (e.usdValue || 0); }, 0).toFixed(2))
    };

    res.json({ success: true, festival: festival, summary: summary });
});

app.post('/api/festivals/:id/approve', function(req, res) {
    if (req.body.adminKey !== 'ae-admin-2026') {
        return res.status(403).json({ error: 'Invalid admin key' });
    }

    const festival = db.festivals.find(function(f) { return f.id === req.params.id; });
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    festival.status = 'APPROVED';
    festival.approvedAt = new Date().toISOString();
    res.json({ success: true, festival: festival });
});

app.post('/api/festivals/:id/products', async function(req, res) {
    const accessToken = req.body.accessToken;
    const product = req.body.product;
    if (!accessToken || !product) {
        return res.status(400).json({ error: 'accessToken and product required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(function(f) { return f.id === req.params.id; });
    if (!festival) return res.status(404).json({ error: 'Festival not found' });
    if (festival.status !== 'APPROVED' && festival.status !== 'ACTIVE') {
        return res.status(400).json({ error: 'المهرجان غير مفعّل' });
    }

    const newOffer = {
        id: 'offer_' + Date.now(),
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

app.post('/api/festivals/:id/exchange', async function(req, res) {
    const accessToken = req.body.accessToken;
    const offerId = req.body.offerId;
    const piAmount = parseFloat(req.body.piAmount);
    if (!accessToken || !offerId || !piAmount) {
        return res.status(400).json({ error: 'accessToken, offerId, piAmount required' });
    }

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(function(f) { return f.id === req.params.id; });
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    const offer = festival.products.find(function(p) { return p.id === offerId; });
    if (!offer) return res.status(404).json({ error: 'Offer not found' });
    if (offer.status !== 'AVAILABLE') {
        return res.status(400).json({ error: 'العرض غير متاح' });
    }

    const exchange = {
        id: 'exc_' + Date.now(),
        buyerId: user.uid,
        buyerName: user.username,
        sellerId: offer.sellerId,
        sellerName: offer.sellerName,
        productName: offer.name,
        category: offer.category,
        piAmount: piAmount,
        usdValue: parseFloat((piAmount * RATES.piAmmUsd).toFixed(2)),
        status: 'COMPLETED',
        timestamp: new Date().toISOString()
    };

    if (!festival.exchanges) festival.exchanges = [];
    festival.exchanges.push(exchange);

    offer.status = 'SOLD';
    offer.soldAt = new Date().toISOString();

    res.json({ success: true, exchange: exchange });
});

app.delete('/api/festivals/:id/products/:offerId', async function(req, res) {
    const accessToken = req.body.accessToken;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    const user = await verifyUser(accessToken);
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const festival = db.festivals.find(function(f) { return f.id === req.params.id; });
    if (!festival) return res.status(404).json({ error: 'Festival not found' });

    const index = festival.products.findIndex(function(p) { return p.id === req.params.offerId; });
    if (index === -1) return res.status(404).json({ error: 'Offer not found' });

    const offer = festival.products[index];
    if (offer.sellerId !== user.uid && festival.editors.indexOf(user.uid) === -1) {
        return res.status(403).json({ error: 'Not authorized' });
    }

    festival.products.splice(index, 1);
    res.json({ success: true });
});

app.get('/api', function(req, res) {
    res.json({
        message: 'GAV API',
        version: '3.0.0',
        features: {
            priceCap: '15%',
            barterFestivals: 'enabled'
        },
        categories: CATEGORIES.length,
        products: db.products.length,
        festivals: db.festivals.length
    });
});

app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(function(req, res) {
    res.status(404).json({ error: 'Not Found' });
});

if (require.main === module) {
    app.listen(PORT, function() {
        console.log('GAV v3.0.0 running on port ' + PORT);
    });
}

module.exports = app;
