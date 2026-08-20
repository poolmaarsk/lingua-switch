import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRtl } from '../src/rtl.mjs';

test('flags known RTL languages', () => {
  assert.equal(isRtl('ar'), true);
  assert.equal(isRtl('he'), true);
  assert.equal(isRtl('fa'), true);
  assert.equal(isRtl('ur'), true);
});

test('does not flag LTR languages', () => {
  assert.equal(isRtl('en'), false);
  assert.equal(isRtl('sk'), false);
  assert.equal(isRtl('zh'), false);
});

test('matches on primary subtag for regional variants', () => {
  assert.equal(isRtl('ar-EG'), true);
  assert.equal(isRtl('he-IL'), true);
});

test('is case-insensitive', () => {
  assert.equal(isRtl('AR'), true);
});
