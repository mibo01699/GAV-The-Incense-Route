#!/usr/bin/env node
/**
 * GAV Smoke Test
 * Verifies that critical files exist and are non-empty.
 * Runs in CI and locally via: npm test
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const REQUIRED_FILES = [
  'public/index.html',
  'public/validation-key.txt',
  'public/create-offer.html',
  'public/privacy-policy.html',
  'public/terms-of-service.html',
  'api/auth/verify.js',
  'api/payment/approve.js',
  'api/payment/complete.js',
  'api/offers/create.js',
  'vercel.json',
  'package.json',
];

const OPTIONAL_FILES = [
  'api/_lib/validators.js',
];

let passed = 0;
let failed = 0;

function checkFile(relPath, required) {
  const fullPath = path.join(ROOT, relPath);
  const exists = fs.existsSync(fullPath);

  if (!exists) {
    if (required) {
      console.error(`✗ MISSING: ${relPath}`);
      failed++;
    } else {
      console.warn(`⚠ optional missing: ${relPath}`);
    }
    return;
  }

  const stats = fs.statSync(fullPath);
  if (stats.size === 0) {
    if (required) {
      console.error(`✗ EMPTY:   ${relPath}`);
      failed++;
    } else {
      console.warn(`⚠ optional empty: ${relPath}`);
    }
    return;
  }

  console.log(`✓ ${relPath} (${stats.size} bytes)`);
  passed++;
}

console.log('=== GAV Smoke Test ===\n');

console.log('Required files:');
REQUIRED_FILES.forEach((f) => checkFile(f, true));

if (OPTIONAL_FILES.length > 0) {
  console.log('\nOptional files:');
  OPTIONAL_FILES.forEach((f) => checkFile(f, false));
}

console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);

if (failed > 0) {
  process.exit(1);
}
process.exit(0);