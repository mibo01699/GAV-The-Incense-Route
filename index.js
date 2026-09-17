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
// Database
// ============================================
const db = {
    products: [],
    orders: [],
    merchants: {},
    categories: [
        { id: 'incense', name: 'البخور والعطور', nameEn: 'Incense & Perfumes', icon: '🌿' },
        { id: 'textiles', name: 'المنسوجات', nameEn: 'Textiles', icon: '🧵' },
        { id: 'spices', name: 'التوابل', nameEn: 'Spices', icon: '🌶️' },
        { id: 'handicrafts', name: 'الحرف اليدوية', nameEn: 'Handicrafts', icon: '🏺' },
        { id: 'coffee', name: 'البن والقهوة', nameEn: 'Coffee', icon: '☕' },
        { id: 'honey', name: 'العسل الطبيعي', nameEn: 'Natural Honey', icon: '🍯' },
        { id: 'food', name: 'المواد الغذائية', nameEn: 'Food Products', icon: '🥫' },
        { id: 'vegetables', name: 'الخضروات والفواكه', nameEn: 'Vegetables & Fruits', icon: '🥬' },
        { id: 'hardware', name: 'الخردوات والأدوات', nameEn: 'Hardware & Tools', icon: '🔧' },
        { id: 'electronics', name: 'الأجهزة الإلكترونية', nameEn: 'Electronics', icon: '📱' },
        { id: 'clothing', name: 'الملابس', nameEn: 'Clothing', icon: '👕' },
        { id: 'home', name: 'مستلزمات المنزل', nameEn: 'Home Supplies', icon: '🏠' },
        { id: 'agriculture', name: 'المستلزمات الزراعية', nameEn: 'Agricultural Supplies', icon: '🌾' },
        { id: 'others', name: 'أخرى', nameEn: 'Others', icon: '📦' }
    ]
};

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
        stats: {
            products: db.products.length,
            orders: db.orders.length,
            merchants: Object.keys(db.merchants).length,
            categories: db.categories.length
        }
    });
});

// ============================================
// API: Categories
// ============================================
app.get('/api/categories', (req, res) => {
    res.json({ success: true, categories: db.categories });
});

// ============================================
// API: Products (Public)
// ============================================
app.get('/api/products', (req, res) => {
    const { category, merchantId, minPrice, maxPrice, search } = req.query;
    let filtered = [...db.products];

    if (category) filtered = filtered.filter(p => p.category === category);
    if (merchantId) filtered = filtered.filter(p => p.merchantId === merchantId);
    if (minPrice) filtered = filtered.filter(p => p.pricePi >= parseFloat(minPrice));
    if (maxPrice) filtered = filtered.filter(p => p.pricePi <= parseFloat(maxPrice));
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

// ============================================
// API: Products (Merchant only)
// ============================================
app.post('/api/products', async (req, res) => {
    const { accessToken, product } = req.body;
    if (!accessToken || !product) {
        return res.status(400).json({ error: 'accessToken and product required' });
    }

    try {
        const userResponse = await fetch(`${BIGISH_YER_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });

        if (!userResponse.ok) return res.status(401).json({ error: 'Invalid token' });
        const userData = await userResponse.json();

        const newProduct = {
            id: `prod_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            merchantId: userData.user.uid,
            merchantName: userData.user.username,
            name: product.name,
            description: product.description || '',
            category: product.category || 'incense',
            pricePi: parseFloat(product.pricePi) || 0,
            priceYER: parseFloat(product.priceYER) || 0,
            // ✅ القيمة المرجعية الجديدة
            referenceValue: {
                source: product.referenceSource || 'none',   // 'custom' | 'dex' | 'none'
                customValue: parseFloat(product.referenceCustomValue) || 0,
                piRatio: parseFloat(product.referencePiRatio) || 50,
                currency: product.referenceCurrency || 'USD',
                updatedAt: new Date().toISOString()
            },
            imageUrl: product.imageUrl || '',
            stock: parseInt(product.stock) || 1,
            createdAt: new Date().toISOString(),
            status: 'ACTIVE'
        };

        db.products.push(newProduct);
        res.json({ success: true, product: newProduct });
    } catch (error) {
        console.error('Product creation error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/products/:id', async (req, res) => {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

    try {
        const userResponse = await fetch(`${BIGISH_YER_URL}/api/auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accessToken })
        });
        if (!userResponse.ok) return res.status(401).json({ error: 'Invalid token' });
        const userData = await userResponse.json();

        const index = db.products.findIndex(p => p.id === req.params.id);
        if (index === -1) return res.status(404).json({ error: 'Product not found' });
        if (db.products[index].merchantId !== userData.user.uid) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        db.products.splice(index, 1);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ============================================
// API: Checkout
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

        const paymentData = await paymentResponse.json();

        if (!paymentData.success) {
            return res.status(400).json({
                error: 'Payment failed',
                details: paymentData.error
            });
        }

        const order = {
            id: `ord_${Date.now()}`,
            productId,
            productName: product.name,
            merchantId: product.merchantId,
            quantity: qty,
            piAmount: pi,
            yerAmount: yer,
            shippingInfo: shippingInfo || {},
            transactionId: paymentData.transactionId,
            status: 'PAID',
            createdAt: new Date().toISOString()
        };
        db.orders.push(order);

        res.json({
            success: true,
            order,
            payment: {
                transactionId: paymentData.transactionId,
                newPiBalance: paymentData.newPiBalance,
                newYerBalance: paymentData.newYerBalance
            }
        });
    } catch (error) {
        console.error('Checkout error:', error);
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

// ============================================
// API: Orders
// ============================================
app.get('/api/orders/user/:uid', (req, res) => {
    const { uid } = req.params;
    const orders = db.orders.filter(o => o.userId === uid || o.merchantId === uid);
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, orders });
});

// ============================================
// API: Smart Converter (مُحدّث مع القيمة المرجعية)
// ============================================
app.post('/api/converter', (req, res) => {
    const { totalPrice, currency, piRatio, referenceSource, referenceValue } = req.body;
    if (!totalPrice) return res.status(400).json({ error: 'totalPrice required' });

    const total = parseFloat(totalPrice);
    const ratio = parseFloat(piRatio) || 0.5;
    const piPart = total * ratio;
    const yerPart = total * (1 - ratio);

    res.json({
        success: true,
        original: { total, currency: currency || 'Pi' },
        split: {
            piAmount: parseFloat(piPart.toFixed(4)),
            yerAmount: parseFloat(yerPart.toFixed(4)),
            piPercentage: ratio * 100,
            yerPercentage: (1 - ratio) * 100
        },
        referenceValue: {
            source: referenceSource || 'none',
            value: parseFloat(referenceValue) || 0,
            currency: currency || 'USD'
        }
    });
});

// ============================================
// API: Merchant Stats
// ============================================
app.get('/api/merchant/stats/:uid', (req, res) => {
    const { uid } = req.params;
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
// Root & Serving
// ============================================
app.get('/api', (req, res) => {
    res.json({
        message: '🚀 GAV - The Incense Route API',
        version: '1.1.0',
        integrations: { bigishYer: BIGISH_YER_URL },
        endpoints: [
            '/api/health', '/api/categories', '/api/products', '/api/products/:id',
            '/api/checkout', '/api/orders/user/:uid', '/api/converter',
            '/api/merchant/stats/:uid'
        ]
    });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((req, res) => res.status(404).json({ error: 'Not Found' }));

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ GAV running on port ${PORT} (${NODE_ENV})`);
        console.log(`🔗 Connected to BIGISH-YER: ${BIGISH_YER_URL}`);
    });
}

module.exports = app;