// Pure calculations, no DOM. Money is computed in cents/pence and rounded once at the end.
import { DE_COMMUTE, DE_COMMUTE_CAP, DE_BUSINESS, UK_THRESHOLD, UK_RATES, UK_LATEST, UK_FIRST_RATED_YEAR, US_PERIODS } from './config.js';

const r2 = v => Math.round(v * 100 + Number.EPSILON * 100) / 100;
const isDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

// ---------- Germany ----------

// Entfernungspauschale for one year. km = one-way distance home to first workplace (only full km count).
export function commuteAllowance({ year, km, days, ownCar }) {
  const r = DE_COMMUTE[year];
  if (!r) throw new Error('year');
  const fullKm = Math.max(0, Math.floor(Number(km) || 0));
  const d = Math.max(0, Math.floor(Number(days) || 0));
  const lowKm = Math.min(fullKm, r.splitKm);
  const highKm = fullKm - lowKm;
  const perDayCents = Math.round(lowKm * r.rate1 * 100) + Math.round(highKm * r.rate2 * 100);
  const rawCents = perDayCents * d;
  const capped = !ownCar && rawCents > DE_COMMUTE_CAP * 100;
  return { fullKm, days: d, perDay: perDayCents / 100, raw: rawCents / 100, total: capped ? DE_COMMUTE_CAP : rawCents / 100, capped };
}

// Kilometerpauschale for business trips (Dienstreise / Auswärtstätigkeit): km actually driven.
export function businessTripAllowance({ km, vehicle }) {
  const rate = DE_BUSINESS[vehicle];
  if (rate === undefined) throw new Error('vehicle');
  if (rate === null) return { rate: null, total: null };
  const k = Math.max(0, Number(km) || 0);
  return { rate, total: r2(k * rate) };
}

// ---------- United Kingdom ----------

// Start year of the UK tax year (6 April to 5 April) a date falls in: '2026-04-05' -> 2025, '2026-04-06' -> 2026.
export function ukTaxYear(date) {
  const [y, m, d] = date.split('-').map(Number);
  return m > 4 || (m === 4 && d >= 6) ? y : y - 1;
}
export const ukTaxYearLabel = y => `${y}-${String((y + 1) % 100).padStart(2, '0')}`;

// Rates for a tax year, and whether they were published (false = newer than the latest known, or older than 2011-12).
export function ukRates(taxYear) {
  if (taxYear > UK_LATEST) return { ...UK_RATES[UK_LATEST], known: false };
  if (taxYear < UK_FIRST_RATED_YEAR) return { ...UK_RATES[UK_FIRST_RATED_YEAR], known: false };
  const key = Math.max(...Object.keys(UK_RATES).map(Number).filter(k => k <= taxYear));
  return { ...UK_RATES[key], known: true };
}

// trips: [{ id, date, miles, vehicle: 'car'|'moto'|'bike', passengers }]
// Returns per-trip amounts and per-tax-year totals. Cars and vans share one 10,000-mile threshold per tax year;
// a trip that crosses it is split.
export function ukClaim(trips) {
  const valid = trips.filter(t => isDate(t.date) && Number(t.miles) > 0)
    .slice().sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const years = new Map();
  const perTrip = new Map();
  for (const t of valid) {
    const ty = ukTaxYear(t.date);
    const rates = ukRates(ty);
    if (!years.has(ty)) years.set(ty, { taxYear: ty, label: ukTaxYearLabel(ty), known: rates.known, carMiles: 0, carHigh: 0, carLow: 0, motoMiles: 0, bikeMiles: 0, passengerMiles: 0, pence: 0, trips: 0 });
    const Y = years.get(ty);
    const miles = Number(t.miles);
    let pence = 0;
    if (t.vehicle === 'car') {
      const high = Math.max(0, Math.min(miles, UK_THRESHOLD - Y.carMiles));
      const low = miles - high;
      pence = high * rates.car[0] + low * rates.car[1];
      Y.carMiles += miles; Y.carHigh += high; Y.carLow += low;
      const pax = Math.max(0, Math.floor(Number(t.passengers) || 0));
      pence += pax * miles * rates.passenger;
      Y.passengerMiles += pax * miles;
    } else if (t.vehicle === 'moto') {
      pence = miles * rates.moto; Y.motoMiles += miles;
    } else if (t.vehicle === 'bike') {
      pence = miles * rates.bike; Y.bikeMiles += miles;
    } else continue;
    Y.pence += pence; Y.trips++;
    perTrip.set(t.id, Math.round(pence) / 100);
  }
  const out = [...years.values()].sort((a, b) => b.taxYear - a.taxYear)
    .map(Y => ({ ...Y, amount: Math.round(Y.pence) / 100 }));
  return { years: out, perTrip, total: r2(out.reduce((s, y) => s + y.amount, 0)) };
}

// Mileage Allowance Relief: approved amount minus what the employer paid. Positive = relief to claim, negative = taxable.
export function ukRelief(approved, paid) {
  const diff = r2((Number(approved) || 0) - (Number(paid) || 0));
  return { relief: Math.max(0, diff), taxable: Math.max(0, -diff) };
}

// ---------- United States ----------

export function usPeriod(date) {
  return US_PERIODS.find(p => date >= p.from && date <= p.to) || null;
}

// trips: [{ id, date, miles, purpose: 'business'|'medical'|'charity', extras }] extras = parking and tolls in USD.
// Sums miles per rate period and purpose, multiplies once, rounds to cents.
export function usClaim(trips) {
  const groups = new Map();
  const perTrip = new Map();
  const unknown = [];
  for (const t of trips) {
    if (!isDate(t.date) || !(Number(t.miles) > 0)) continue;
    const p = usPeriod(t.date);
    if (!p || !(t.purpose in { business: 1, medical: 1, charity: 1 })) { unknown.push(t.id); continue; }
    const key = p.from + '|' + t.purpose;
    if (!groups.has(key)) groups.set(key, { year: Number(p.from.slice(0, 4)), from: p.from, to: p.to, ref: p.ref, purpose: t.purpose, rate: p[t.purpose], miles: 0, extras: 0 });
    const g = groups.get(key);
    const miles = Number(t.miles);
    const extras = Math.max(0, Number(t.extras) || 0);
    g.miles += miles; g.extras += extras;
    perTrip.set(t.id, r2((miles * p[t.purpose]) / 100 + extras));
  }
  const rows = [...groups.values()].map(g => {
    g.miles = Math.round(g.miles * 10) / 10;
    g.mileage = Math.round(g.miles * g.rate) / 100;
    g.extras = r2(g.extras);
    g.amount = r2(g.mileage + g.extras);
    return g;
  }).sort((a, b) => (a.from < b.from ? 1 : a.from > b.from ? -1 : a.purpose.localeCompare(b.purpose)));
  const byYear = {};
  for (const g of rows) byYear[g.year] = r2((byYear[g.year] || 0) + g.amount);
  return { rows, byYear, perTrip, unknown, total: r2(rows.reduce((s, g) => s + g.amount, 0)) };
}

// ---------- CSV ----------
export function toCSV(header, rows) {
  const cell = v => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s; // no formula injection in spreadsheets
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
}

// ---------- self-test (also run in the browser and shown under "Sources") ----------
export const CASES = [
  ['DE 2026: 30 km, 220 days, car = 2,508.00', () => commuteAllowance({ year: 2026, km: 30, days: 220, ownCar: true }).total, 2508],
  ['DE 2025: 30 km, 220 days = 20x0.30 + 10x0.38 = 9.80/day, 2,156.00', () => commuteAllowance({ year: 2025, km: 30, days: 220, ownCar: true }).total, 2156],
  ['DE: 25.9 km counts as 25 full km (2026, 1 day = 9.50)', () => commuteAllowance({ year: 2026, km: 25.9, days: 1, ownCar: true }).total, 9.5],
  ['DE 2026: 70 km, 220 days, train = cap 4,500.00', () => commuteAllowance({ year: 2026, km: 70, days: 220, ownCar: false }).total, 4500],
  ['DE 2026: 70 km, 220 days, own car = 5,852.00 (no cap)', () => commuteAllowance({ year: 2026, km: 70, days: 220, ownCar: true }).total, 5852],
  ['DE business trip: 123 km by car = 36.90', () => businessTripAllowance({ km: 123, vehicle: 'car' }).total, 36.9],
  ['DE business trip: 123 km by motorbike = 24.60', () => businessTripAllowance({ km: 123, vehicle: 'motor' }).total, 24.6],
  ['UK tax year: 5 Apr 2026 is in 2025-26', () => ukTaxYear('2026-04-05'), 2025],
  ['UK tax year: 6 Apr 2026 is in 2026-27', () => ukTaxYear('2026-04-06'), 2026],
  ['UK 2026-27: 12,000 car miles = 10,000x55p + 2,000x25p = 6,000.00', () => ukClaim([{ id: 1, date: '2026-05-01', miles: 9000, vehicle: 'car' }, { id: 2, date: '2026-06-01', miles: 3000, vehicle: 'car' }]).total, 6000],
  ['UK 2025-26: 12,000 car miles = 10,000x45p + 2,000x25p = 5,000.00', () => ukClaim([{ id: 1, date: '2025-05-01', miles: 12000, vehicle: 'car' }]).total, 5000],
  ['UK: trip crossing 10,000 is split (1,000 mi from 9,500: 500x55p + 500x25p = 400.00)', () => ukClaim([{ id: 1, date: '2026-05-01', miles: 9500, vehicle: 'car' }, { id: 2, date: '2026-07-01', miles: 1000, vehicle: 'car' }]).perTrip.get(2), 400],
  ['UK: 100 mi motorbike 24.00 + 100 mi bike 20.00 = 44.00', () => ukClaim([{ id: 1, date: '2026-05-01', miles: 100, vehicle: 'moto' }, { id: 2, date: '2026-05-02', miles: 100, vehicle: 'bike' }]).total, 44],
  ['UK: 100 mi car with 2 passengers = 55.00 + 10.00 = 65.00', () => ukClaim([{ id: 1, date: '2026-05-01', miles: 100, vehicle: 'car', passengers: 2 }]).total, 65],
  ['UK relief: approved 6,000, employer paid 4,500 = relief 1,500.00', () => ukRelief(6000, 4500).relief, 1500],
  ['US: 100 business mi on 30 Jun 2026 = 72.50', () => usClaim([{ id: 1, date: '2026-06-30', miles: 100, purpose: 'business' }]).total, 72.5],
  ['US: 100 business mi on 1 Jul 2026 = 76.00', () => usClaim([{ id: 1, date: '2026-07-01', miles: 100, purpose: 'business' }]).total, 76],
  ['US: 100 medical mi on 1 Jul 2026 = 23.50, charity 100 mi = 14.00', () => usClaim([{ id: 1, date: '2026-07-01', miles: 100, purpose: 'medical' }, { id: 2, date: '2026-08-01', miles: 100, purpose: 'charity' }]).total, 37.5],
  ['US: 2025 business 33.3 mi = 23.31 plus 5.00 tolls = 28.31', () => usClaim([{ id: 1, date: '2025-03-03', miles: 33.3, purpose: 'business', extras: 5 }]).total, 28.31],
];

export function selfTest() {
  const failed = [];
  for (const [name, fn, want] of CASES) {
    let got;
    try { got = fn(); } catch (err) { got = 'error: ' + err.message; }
    if (got !== want) failed.push({ name, got, want });
  }
  return { total: CASES.length, passed: CASES.length - failed.length, failed };
}
