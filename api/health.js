// api/health.js
'use strict';

module.exports = async function handler(req, res) {
    // التحقق من أن الطلب هو GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    }

    // إرجاع حالة الصحة
    return res.status(200).json({
        ok: true,
        status: 'UP',
        service: 'GAV-The-Incense-Route',
        environment: 'testnet',
        timestamp: new Date().toISOString()
    });
};