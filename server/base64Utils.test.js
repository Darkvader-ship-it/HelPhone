import { test } from 'node:test';
import assert from 'node:assert/strict';
import { 
  normalizeBase64, 
  extractBase64DataParallelized, 
  calculateRemainderWithBackoff 
} from './base64Utils.js';

test('calculateRemainderWithBackoff should return correct modulo 4', () => {
  assert.equal(calculateRemainderWithBackoff(0), 0);
  assert.equal(calculateRemainderWithBackoff(1), 1);
  assert.equal(calculateRemainderWithBackoff(2), 2);
  assert.equal(calculateRemainderWithBackoff(3), 3);
  assert.equal(calculateRemainderWithBackoff(4), 0);
  assert.equal(calculateRemainderWithBackoff(10), 2);
});

test('extractBase64DataParallelized should extract data URI base64', () => {
  const data = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(extractBase64DataParallelized(data), 'iVBORw0KGgo=');
});

test('extractBase64DataParallelized should handle plain string', () => {
  assert.equal(extractBase64DataParallelized('iVBORw0KGgo='), 'iVBORw0KGgo=');
});

test('normalizeBase64 should pad string correctly', () => {
  // Length 11 -> needs 1 pad (remainder 3)
  assert.equal(normalizeBase64('iVBORw0KGgo'), 'iVBORw0KGgo=');
});

test('normalizeBase64 should replace - with + and _ with /', () => {
  assert.equal(normalizeBase64('a-b_cd'), 'a+b/cd==');
});

test('normalizeBase64 should throw on invalid length', () => {
  assert.throws(() => normalizeBase64('a'), /invalid base64 length/);
  assert.throws(() => normalizeBase64('abcde'), /invalid base64 length/);
});

test('normalizeBase64 should throw on non-string input', () => {
  assert.throws(() => normalizeBase64(123), /bytecode must be a string/);
  assert.throws(() => normalizeBase64(null), /bytecode must be a string/);
});
