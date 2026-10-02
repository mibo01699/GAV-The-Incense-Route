// Incomplete payment handler — input validation paths only.
// Network-dependent paths require PI_API_KEY and real Pi tokens.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import incompleteHandler from '../api/payment/incomplete.js';

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

test('incomplete rejects non-POST with 405', async () => {
  const res = makeRes();
  await incompleteHandler({ method: 'GET' }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.error, 'METHOD_NOT_ALLOWED');
});

test('incomplete rejects missing paymentId with 400', async () => {
  const res = makeRes();
  await incompleteHandler(
    { method: 'POST', body: { accessToken: 'x' } },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'MISSING_PAYMENT_ID');
});

test('incomplete rejects missing accessToken with 400', async () => {
  const res = makeRes();
  await incompleteHandler(
    { method: 'POST', body: { paymentId: 'abc' } },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'MISSING_TOKEN');
});

test('incomplete rejects invalid JSON with 400', async () => {
  const res = makeRes();
  await incompleteHandler(
    { method: 'POST', body: '{bad' },
    res
  );
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'INVALID_JSON');
});