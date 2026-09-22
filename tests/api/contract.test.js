/* ============================================================
   GAV – Tests: Frontend ↔ Backend API Contract
   Path:  tests/api/contract.test.js
   ============================================================ */

'use strict';

process.env.PI_API_KEY = process.env.PI_API_KEY || 'test-key-contract';

const request = require('supertest');
const app = require('../../api/index');

describe('API Contract — all endpoints exist', function () {

    const contract = [
        { method: 'post',   path: '/api/v1/auth/verify',           body: {}, expect: [400, 500] },
        { method: 'get',    path: '/api/v1/pricing/reference',                 expect: [200] },
        { method: 'get',    path: '/api/v1/products',                          expect: [200] },
        { method: 'get',    path: '/api/v1/products/fake-id',                  expect: [404] },
        { method: 'post',   path: '/api/v1/products',           body: {},     expect: [401] },
        { method: 'put',    path: '/api/v1/products/x',         body: {},     expect: [401] },
        { method: 'delete', path: '/api/v1/products/x',                        expect: [401] },
        { method: 'get',    path: '/api/v1/merchants/me',                      expect: [401] },
        { method: 'post',   path: '/api/v1/pos/invoice',        body: {},     expect: [401] },
        { method: 'get',    path: '/api/v1/orders',                            expect: [401] },
        { method: 'get',    path: '/api/v1/orders/x',                          expect: [401] },
        { method: 'get',    path: '/api/v1/invoices',                          expect: [401] },
        { method: 'get',    path: '/api/v1/payments',                          expect: [401] },
        { method: 'post',   path: '/api/v1/payments/create',    body: {},     expect: [401] },
        { method: 'post',   path: '/api/v1/payments/approve',   body: {},     expect: [401] },
        { method: 'post',   path: '/api/v1/payments/complete',  body: {},     expect: [401] },
        { method: 'post',   path: '/api/v1/payments/reconcile', body: {},     expect: [401] },
        { method: 'get',    path: '/api/v1/supply-chain',                      expect: [200] },
        { method: 'get',    path: '/api/v1/barter/festivals',                  expect: [200] },
        { method: 'post',   path: '/api/v1/barter/festivals/x/offers', body:{}, expect: [401] },
        { method: 'post',   path: '/api/v1/barter/festivals/x/leave', body:{}, expect: [401] },
        { method: 'get',    path: '/api/v1/audit',                             expect: [401] }
    ];

    contract.forEach(function (c) {
        test(c.method.toUpperCase() + ' ' + c.path + ' → JSON status in expected range', async function () {
            let req = request(app)[c.method](c.path);
            if (c.body) req = req.send(c.body);
            const res = await req;

            expect(c.expect).toContain(res.status);
            expect(res.headers['content-type']).toMatch(/json/);
        });
    });

});

describe('API Contract — response shapes', function () {

    test('GET /api/v1/products returns {ok, products: []}', async function () {
        const res = await request(app).get('/api/v1/products');
        expect(res.body.ok).toBe(true);
        expect(Array.isArray(res.body.products)).toBe(true);
    });

    test('GET /api/v1/barter/festivals returns {ok, festivals: []}', async function () {
        const res = await request(app).get('/api/v1/barter/festivals');
        expect(res.body.ok).toBe(true);
        expect(Array.isArray(res.body.festivals)).toBe(true);
    });

    test('GET /api/v1/pricing/reference has NOT GCV disclaimer', async function () {
        const res = await request(app).get('/api/v1/pricing/reference');
        expect(res.body.ok).toBe(true);
        expect(res.body.disclaimer).toMatch(/NOT GCV/);
    });

    test('Unknown route returns 404 JSON with NOT_FOUND code', async function () {
        const res = await request(app).get('/api/v1/nonexistent');
        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
        expect(res.body.code).toBe('NOT_FOUND');
    });

});

describe('API Contract — prefix normalization', function () {

    test('works with /api/v1 prefix', async function () {
        const res = await request(app).get('/api/v1/products');
        expect(res.status).toBe(200);
    });

    test('works with /api prefix', async function () {
        const res = await request(app).get('/api/products');
        expect(res.status).toBe(200);
    });

    test('works without any prefix', async function () {
        const res = await request(app).get('/products');
        expect(res.status).toBe(200);
    });

    test('health works on all three prefixes', async function () {
        const r1 = await request(app).get('/health');
        const r2 = await request(app).get('/api/health');
        const r3 = await request(app).get('/api/v1/health');
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(r3.status).toBe(200);
    });

});