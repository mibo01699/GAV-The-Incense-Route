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

app.get('/api', (req, res) => {
    res.json({
        message: '🚀 GAV API',
        version: '2.0.0',
        categories: CATEGORIES.length,
        products: db.products.length
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(function(req, res) {
    res.status(404).json({ error: 'Not Found' });
});

if (require.main === module) {
    app.listen(PORT, function() {
        console.log('✅ GAV v2.0.0 running on port ' + PORT);
    });
}

module.exports = app;