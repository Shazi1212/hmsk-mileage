// All legal and statutory figures used by the tool, in one place.
// Every value has a source. Checked 2026-10-19. Update when HMRC, the IRS or the German law changes a rate.

export const CHECKED = '2026-10-19';

// Links in the top strip. '' = same host (hosted on hmsk.life). Self-hosted copies point to hmsk.life.
export const LINK_BASE = 'https://hmsk.life';

export const SOURCES = {
  estg9: 'https://www.gesetze-im-internet.de/estg/__9.html',
  estg4: 'https://www.gesetze-im-internet.de/estg/__4.html',
  brkg5: 'https://www.gesetze-im-internet.de/brkg_2005/__5.html',
  lstr81: 'https://lsth.bundesfinanzministerium.de/',
  bfh6404: 'https://lexetius.com/2005,3467',
  hmrcAmap: 'https://www.gov.uk/government/publications/rates-and-allowances-travel-mileage-and-fuel-allowances/travel-mileage-and-fuel-rates-and-allowances',
  hmrcSimplified: 'https://www.gov.uk/simpler-income-tax-simplified-expenses/vehicles',
  hmrcMar: 'https://www.gov.uk/tax-relief-for-employees/vehicles-you-use-for-work',
  irsRates: 'https://www.irs.gov/tax-professionals/standard-mileage-rates',
  irs2026: 'https://www.irs.gov/newsroom/irs-sets-2026-business-standard-mileage-rate-at-725-cents-per-mile-up-25-cents',
};

// ---------- Germany ----------
// Entfernungspauschale, § 9 Abs. 1 Satz 3 Nr. 4 EStG: per full km of the one-way distance, per working day.
// 2022 to 2025: 0.30 EUR for km 1 to 20, 0.38 EUR from km 21. From 2026: 0.38 EUR from the first km.
// Cap 4,500 EUR per year, except when you drive your own (or a provided) car. Source: SOURCES.estg9
export const DE_COMMUTE = {
  2025: { rate1: 0.30, rate2: 0.38, splitKm: 20 },
  2026: { rate1: 0.38, rate2: 0.38, splitKm: 20 },
};
export const DE_COMMUTE_CAP = 4500;
export const DE_YEARS = [2026, 2025];

// Beruflich veranlasste Fahrten (Dienstreise), § 9 Abs. 1 Satz 3 Nr. 4a EStG with § 5 BRKG:
// car 0.30 EUR per km driven, other motor vehicles (motorbike, moped, e-scooter) 0.20 EUR. Bicycles: no flat rate.
export const DE_BUSINESS = { car: 0.30, motor: 0.20, bike: null };

// ---------- United Kingdom ----------
// Approved mileage allowance payments (AMAP), pence per business mile, per tax year (6 April to 5 April).
// Cars and vans: first 10,000 business miles in the tax year, then each mile over. Passenger: per fellow employee.
// 45p/25p unchanged from 2011-12 to 2025-26; 55p/25p from 2026-27. Source: SOURCES.hmrcAmap (GOV.UK, updated 21 May 2026)
export const UK_THRESHOLD = 10000;
export const UK_FIRST_RATED_YEAR = 2011; // tax year 2011-12
export const UK_RATES = {
  2011: { car: [45, 25], moto: 24, bike: 20, passenger: 5 }, // applies 2011-12 up to 2025-26
  2026: { car: [55, 25], moto: 24, bike: 20, passenger: 5 },
};
export const UK_LATEST = 2026; // newest tax year with published rates (2026-27)

// ---------- United States ----------
// IRS optional standard mileage rates, cents per mile. Business rate changed mid-2026 (IR-2026-29).
// Source: SOURCES.irsRates (2025: IR-2024-312; Jan to Jun 2026: Notice 2026-10, IR-2025-128; Jul to Dec 2026: IR-2026-29)
export const US_PERIODS = [
  { from: '2025-01-01', to: '2025-12-31', business: 70, medical: 21, charity: 14, ref: 'IR-2024-312' },
  { from: '2026-01-01', to: '2026-06-30', business: 72.5, medical: 20.5, charity: 14, ref: 'Notice 2026-10' },
  { from: '2026-07-01', to: '2026-12-31', business: 76, medical: 23.5, charity: 14, ref: 'IR-2026-29' },
];
