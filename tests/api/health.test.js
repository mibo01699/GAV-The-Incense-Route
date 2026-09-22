/* ============================================================
   GAV – The Incense Route
   Tests: GET /api/health
   Path:  tests/api/health.test.js
   ============================================================ */

'use strict';

process.env.PI_API_KEY = process.env.PI_API_KEY || 'test-key-health';

const request = require('supertest');
const app = require('../../api/v1/index');

describe('GET /api/health', function () {

    test('returns 200 with UP status', async function () {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
        expect(res.body.status).toBe('UP');
    });

    test('identifies service name and environment', async function () {
        const res = await request(app).get('/api/health');
        expect(res.body.service).toBe('GAV-The-Incense-Route');
        expect(res.body.environment).toBe('testnet');
    });

    test('does NOT require authentication', async function () {
        const res = await request(app).get('/api/health');
        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);
    });

    test('responds with JSON content type', async function () {
        const res = await request(app).get('/api/health');
        expect(res.headers['content-type']).toMatch(/json/);
    });

    test('also works with /health (after normalization)', async function () {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('UP');
    });

    test('returns ISO timestamp', async function () {
        const res = await request(app).get('/api/health');
        expect(typeof res.body.timestamp).toBe('string');
        const d = new Date(res.body.timestamp);
        expect(isNaN(d.getTime())).toBe(false);
    });

});