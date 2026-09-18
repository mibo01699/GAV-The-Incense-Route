const express = require('express');
const router = express.Router();

const BIGISH_YER_URL = process.env.BIGISH_YER_URL || 'https://bigish-yer.vercel.app';

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

function setupFestivalRoutes(db) {

    // ============================================
    // إنشاء مهرجان
    // ============================================
    router.post('/', async (req, res) => {
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
            exchanges: [],      // سجل الصفقات المكتملة
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        db.festivals.push(newFestival);
        res.json({ success: true, festival: newFestival });
    });

    // ============================================
    // قائمة المهرجانات المعتمدة
    // ============================================
    router.get('/', (req, res) => {
        let filtered = db.festivals.filter(f => f.status !== 'PENDING');
        if (req.query.status) filtered = filtered.filter(f => f.status === req.query.status);
        if (req.query.country) filtered = filtered.filter(f => f.country === req.query.country);
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, festivals: filtered, count: filtered.length });
    });

    // ============================================
    // مهرجاناتي
    // ============================================
    router.get('/my/:uid', (req, res) => {
        const uid = req.params.uid;
        const myFestivals = db.festivals.filter(f =>
            f.creatorId === uid || f.editors.indexOf(uid) !== -1
        );
        res.json({ success: true, festivals: myFestivals });
    });

    // ============================================
    // سجل المهرجانات (Log - ملخص لكل مهرجان)
    // ============================================
    router.get('/log/all', (req, res) => {
        const log = db.festivals
            .filter(f => f.status === 'APPROVED' || f.status === 'ACTIVE' || f.status === 'ENDED')
            .map(f => {
                const exchanges = f.exchanges || [];
                const totalTransactions = exchanges.length;
                const totalPiValue = exchanges.reduce((sum, e) => sum + (e.piAmount || 0), 0);
                const totalUSDValue = exchanges.reduce((sum, e) => sum + (e.usdValue || 0), 0);

                // تجميع الفئات المباعة
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

    // ============================================
    // تفاصيل مهرجان (مع السجل)
    // ============================================
    router.get('/:id', (req, res) => {
        const festival = db.festivals.find(f => f.id === req.params.id);
        if (!festival) return res.status(404).json({ error: 'Festival not found' });

        // إضافة ملخص
        const exchanges = festival.exchanges || [];
        const summary = {
            totalTransactions: exchanges.length,
            totalPiValue: parseFloat(exchanges.reduce((sum, e) => sum + (e.piAmount || 0), 0).toFixed(10)),
            totalUSDValue: parseFloat(exchanges.reduce((sum, e) => sum + (e.usdValue || 0), 0).toFixed(2))
        };

        res.json({ success: true, festival: festival, summary: summary });
    });

    // ============================================
    // تعديل مهرجان
    // ============================================
    router.put('/:id', async (req, res) => {
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

    // ============================================
    // إضافة محرر (حتى 5)
    // ============================================
    router.post('/:id/add-editor', async (req, res) => {
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

    // ============================================
    // الموافقة (Admin)
    // ============================================
    router.post('/:id/approve', (req, res) => {
        if (req.body.adminKey !== 'ae-admin-2026') {
            return res.status(403).json({ error: 'Invalid admin key' });
        }

        const festival = db.festivals.find(f => f.id === req.params.id);
        if (!festival) return res.status(404).json({ error: 'Festival not found' });

        festival.status = 'APPROVED';
        festival.approvedAt = new Date().toISOString();
        res.json({ success: true, festival: festival });
    });

    // ============================================
    // إضافة عرض منتج (حرية كاملة في التسعير)
    // ============================================
    router.post('/:id/products', async (req, res) => {
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

    // ============================================
    // تنفيذ مقايضة (Exchange)
    // ============================================
    router.post('/:id/exchange', async (req, res) => {
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

        // تسجيل المقايضة
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
            usdValue: parseFloat((piAmount * 0.63).toFixed(2)),  // قيمة تقديرية بـ AMM
            status: 'COMPLETED',
            timestamp: new Date().toISOString()
        };

        if (!festival.exchanges) festival.exchanges = [];
        festival.exchanges.push(exchange);

        // تحديث حالة العرض
        offer.status = 'SOLD';
        offer.soldAt = new Date().toISOString();
        offer.buyerId = user.uid;

        res.json({ success: true, exchange: exchange });
    });

    // ============================================
    // حذف عرض
    // ============================================
    router.delete('/:id/products/:offerId', async (req, res) => {
        const accessToken = req.body.accessToken;
        if (!accessToken) return res.status(400).json({ error: 'accessToken required' });

        const user = await verifyUser(accessToken);
        if (!user) return res.status(401).json({ error: 'Invalid token' });

        const festival = db.festivals.find(f => f.id === req.params.id);
        if (!festival) return res.status(404).json({ error: 'Festival not found' });

        const index = festival.products.findIndex(p => p.id === req.params.offerId);
        if (index === -1) return res.status(404).json({ error: 'Offer not found' });

        const offer = festival.products[index];
        if (offer.sellerId !== user.uid && festival.editors.indexOf(user.uid) === -1) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        festival.products.splice(index, 1);
        res.json({ success: true });
    });

    return router;
}

module.exports = setupFestivalRoutes;