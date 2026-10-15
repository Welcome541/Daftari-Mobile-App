#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const speech = require('../app/src/main/assets/www/lib/voice-ar.js');

const amounts = [
  ['خمسين', 50],
  ['تلاتة وأربعين', 43],       // Egyptian
  ['خمستاشر', 15],             // Egyptian / colloquial
  ['ثنين وخمسين', 52],          // Gulf / Yemeni
  ['تلتعش', 13],                // Levantine
  ['تلتاشر', 13],               // Egyptian / Levantine
  ['خمسطاش', 15],               // Maghrebi / Levantine
  ['تمنتاشر', 18],               // Egyptian
  ['حدعش', 11],                  // Levantine
  ['طناش', 12],                  // Iraqi / Levantine
  ['تلاتين', 30],                // Egyptian
  ['تمانين', 80],                // Levantine / Maghrebi
  ['تمانتين', 80],              // Gulf / Levantine
  ['جوج وثلاثين', 32],          // Maghrebi
  ['تمنية وخمسين', 58],         // Maghrebi
  ['أربعطاش', 14],              // Maghrebi
  ['مئة وعشرين', 120],
  ['ألف وخمسين', 1050],
  ['خمسمية', 500],
  ['one hundred twenty', 120],
  ['٥٠', 50],
  ['۵۰', 50],
  ['٥٠٫٥', 50.5],
  ['50.75', 50.75]
];

for (const [text, expected] of amounts) {
  assert.equal(speech.parseAmount(text).amt, expected, `amount parsing: ${text}`);
}

const customers = [
  { id: 'c1', name: 'أبو خالد', archived: false },
  { id: 'c2', name: 'سعيد', archived: false },
  { id: 'c3', name: 'خالد سعيد', archived: false }
];

function parse(text, options = {}) {
  return speech.parseRecord(text, { customers, ...options });
}

const accepted = [
  ['دين أبو خالد رز خمسين ريال', 'c1', 50, 'رز'],
  ['سداد أبو خالد ٥٠ رز', 'c1', 50, 'رز'],
  ['دين أبو خالد اشتريت رز بخمسين ريال', 'c1', 50, 'رز'],
  ['دين ابو خاليد رز خمسين', 'c1', 50, 'رز'], // one-character ASR error in a registered name
  ['دين أبو خالد 5 علب رز بسعر 200 ريال', 'c1', 200, 'علب رز'],
  ['دين أبو خالد منتج دواء خمسين', 'c1', 50, 'دواء'],
  ['payment سعيد rice fifty riyals', 'c2', 50, 'rice'],
  ['دين سعيد ثنين وخمسين رز', 'c2', 52, 'رز']
];

for (const [text, customerId, amount, note] of accepted) {
  const result = parse(text);
  assert.equal(result.inScope, true, `in-scope phrase accepted: ${text}`);
  assert.equal(result.customerId, customerId, `customer match: ${text}`);
  assert.equal(result.amount, amount, `amount retained: ${text}`);
  assert.equal(result.note, note, `product note: ${text}`);
}

const rejected = [
  'السلام عليكم يا أبو خالد كيف الجو خمسين',
  'دين أبو خالد خمسين',
  'دين شخص غير مسجل رز خمسين',
  'دين أبو خالد جوال خمسين',
  'دين أبو خالد اشتريت الطقس جميل خمسين',
  'دين أبو خالد منتج رز والطقس جميل خمسين'
];
for (const text of rejected) {
  assert.equal(parse(text).inScope, false, `out-of-scope phrase rejected: ${text}`);
}

assert.equal(parse('دين أبو خالد منتج جوال خمسين').inScope, true, 'an explicit product cue permits a custom product name');
assert.equal(speech.parseRecord('دين أبو خالد روبيان خمسين', { customers, knownProducts: ['روبيان'] }).inScope, true, 'a previously saved item can become part of the recognized vocabulary');
assert.equal(speech.parseRecord('دين أبو خالد قلم خمسين', { customers, knownProducts: ['قلم'] }).note, 'قلم', 'a known custom product is returned as the item note');
assert.equal(speech.parseRecord('دين أبو خاليد روبيان خمسين', { customers, knownProducts: ['روبيان'] }).customerId, 'c1', 'a slightly misheard name maps to the unique registered customer');
assert.equal(parse('رز 50', { personal: true }).inScope, true, 'personal account may identify a product without a customer');
assert.equal(parse('50', { personal: true }).inScope, false, 'amount alone is insufficient without a product');
assert.equal(parse('دين أبو خالد رز خمسين', { contextCustomer: customers[1] }).customerId, 'c1', 'spoken customer name takes precedence over context');
assert.equal(speech.parseRecord('رز خمسين', { customers, contextCustomer: customers[0] }).customerId, 'c1', 'selected customer can be omitted from speech');
assert.equal(speech.kindFromText('سداد أبو خالد رز خمسين'), 'pay');
assert.equal(speech.kindFromText('دين أبو خالد رز خمسين'), 'debt');
assert.equal(speech.kindFromText('أبو خالد رز خمسين'), null, 'external text needs an explicit transaction kind');

console.log(`voice-ar: ${amounts.length + accepted.length + rejected.length + 7} assertions passed`);
