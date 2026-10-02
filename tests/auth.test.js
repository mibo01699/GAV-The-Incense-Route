// Basic auth handler tests — no network calls.
// Covers input validation paths only.
// Valid-token path requires Pi Platform API and is tested manually in Pi Browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import verifyHandler from '../api/auth/verify.js';

function makeRes() {
  return {
    statusCode: 200,
    body: null,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test('auth/verify rejects non-POST with 405', async () => {
  const res = makeRes();
  await verifyHandler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.ok, false);
  assert.equal(res.body.error, 'METHOD_NOT_ALLOWED');
});

test('auth/verify rejects missing token with 400', async () => {
  const res = makeRes();
  await verifyHandler({ method: 'POST', body: {} }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'MISSING_TOKEN');
});

test('auth/verify rejects empty token with 400', async () => {
  const res = makeRes();
  await verifyHandler(
    { method: 'POST', body: { accessToken: '   ' } },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'MISSING_TOKEN');
});

test('auth/verify rejects non-string token with 400', async () => {
  const res = makeRes();
  await verifyHandler(
    { method: 'POST', body: { accessToken: 12345 } },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'MISSING_TOKEN');
});

test('auth/verify rejects too-long token with 400', async () => {
  const res = makeRes();
  await verifyHandler(
    { method: 'POST', body: { accessToken: 'a'.repeat(5000) } },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'TOKEN_TOO_LONG');
});

test('auth/verify rejects invalid JSON with 400', async () => {
  const res = makeRes();
  await verifyHandler(
    { method: 'POST', body: '{not-json' },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_JSON');
});