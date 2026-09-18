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

    // إنشاء مهرجان
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
            status: 'PENDING',
            createdAt: new Date().toISOString()
        };

        db.festivals.push(newFestival);
        res.json({ success: true, festival: newFestival });
    });

    // قائمة المهرجانات المعتمدة
    router.get('/', (req, res) => {
        let filtered = db.festivals.filter(f => f.status !== 'PENDING');
        if (req.query.status) filtered = filtered.filter(f => f.status === req.query.status);
        if (req.query.country) filtered = filtered.filter(f => f.country === req.query.country);
        filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        res.json({ success: true, festivals: filtered, count: filtered.length });
    });

    // مهرجاناتي
    router.get('/my/:uid', (req, res) => {
        const uid = req.params.uid;
        const myFestivals = db.festivals.filter(f =>
            f.creatorId === uid || f.editors.indexOf(uid) !== -1
        );
        res.json({ success: true, festivals: myFestivals });
    });

    // تفاصيل مهرجان
    router.get('/:id', (req, res) => {
        const festival = db.festivals.find(f => f.id === req.params.id);
        if (!festival) return res.status(404).json({ error: 'Festival not found' });
        res.json({ success: true, festival: festival });
    });

    // تعديل مهرجان
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

    // إضافة محرر (حتى 5)
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

    // الموافقة (Admin)
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

    // إضافة عرض منتج في المهرجان (حرية كاملة في التسعير)
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

    // حذف عرض
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