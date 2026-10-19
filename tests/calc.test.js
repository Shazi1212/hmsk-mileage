import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CASES, selfTest, ukClaim, usClaim, commuteAllowance, businessTripAllowance, toCSV, ukRates } from '../public/calc.js';

// Every case of the in-app self-test, one node test each (values computed by hand from the official rates).
for (const [name, fn, want] of CASES) test(name, () => assert.equal(fn(), want));

test('self-test reports all passed', () => {
  const r = selfTest();
  assert.equal(r.passed, r.total);
});

test('DE: bicycle has no flat rate', () => {
  assert.equal(businessTripAllowance({ km: 10, vehicle: 'bike' }).total, null);
});

test('DE: unknown year throws', () => {
  assert.throws(() => commuteAllowance({ year: 2019, km: 10, days: 10 }));
});

test('UK: tax years are kept apart and each gets its own 10,000-mile threshold', () => {
  const r = ukClaim([
    { id: 1, date: '2026-04-05', miles: 10000, vehicle: 'car' },
    { id: 2, date: '2026-04-06', miles: 10000, vehicle: 'car' },
  ]);
  assert.equal(r.years.length, 2);
  assert.equal(r.years.find(y => y.taxYear === 2025).amount, 4500);
  assert.equal(r.years.find(y => y.taxYear === 2026).amount, 5500);
});

test('UK: future tax year is flagged as not yet published', () => {
  assert.equal(ukRates(2027).known, false);
  assert.equal(ukRates(2026).known, true);
  assert.equal(ukRates(2015).car[0], 45);
});

test('UK: passengers count only for cars and vans', () => {
  assert.equal(ukClaim([{ id: 1, date: '2026-05-01', miles: 10, vehicle: 'moto', passengers: 3 }]).total, 2.4);
});

test('US: dates without a published rate are reported, not priced', () => {
  const r = usClaim([{ id: 'x', date: '2027-01-02', miles: 10, purpose: 'business' }]);
  assert.deepEqual(r.unknown, ['x']);
  assert.equal(r.total, 0);
});

test('CSV escapes quotes, commas and formula starts', () => {
  assert.equal(toCSV(['a', 'b'], [['x, "y"', '=SUM(A1)'], [-5, '']]), 'a,b\r\n"x, ""y""",\'=SUM(A1)\r\n-5,\r\n');
});
