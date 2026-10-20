// UI: three modes (de, uk, us). Pure maths in calc.js, figures in config.js, texts in i18n.js.
// UK and US trips live in localStorage on this device only; the German log is never stored (see the warning).
import { commuteAllowance, businessTripAllowance, ukClaim, ukRelief, ukRates, ukTaxYear, ukTaxYearLabel, usClaim, toCSV, selfTest } from './calc.js';
import { DE_YEARS, DE_COMMUTE_CAP, DE_BUSINESS, SOURCES, LINK_BASE } from './config.js';
import { TEXT } from './i18n.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const STORE = 'hmsk-mileage-v1';
const MODES = ['de', 'uk', 'us'];

let lang = pickLang();
let data = load();
let mode = pickMode();
const editing = { uk: null, us: null };

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q === 'de' || q === 'en') return q;
  try { const s = localStorage.getItem(STORE + '-lang'); if (s === 'de' || s === 'en') return s; } catch {}
  return (navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en';
}
function pickMode() {
  const h = location.hash.slice(1);
  if (MODES.includes(h)) return h;
  if (MODES.includes(data.mode)) return data.mode;
  return lang === 'de' ? 'de' : 'uk';
}
const t = () => TEXT[lang];

// ---------- storage ----------
function load() {
  const empty = { mode: null, exported: false, uk: { trips: [], paid: {} }, us: { trips: [] },
    de: { year: DE_YEARS[0], km: 25, days: 220, how: 'car', btKm: 120, btVehicle: 'car' } };
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (!s || typeof s !== 'object') return empty;
    return {
      mode: s.mode, exported: !!s.exported,
      uk: { trips: Array.isArray(s.uk?.trips) ? s.uk.trips.map(cleanTrip).filter(Boolean) : [], paid: s.uk?.paid && typeof s.uk.paid === 'object' ? s.uk.paid : {} },
      us: { trips: Array.isArray(s.us?.trips) ? s.us.trips.map(cleanTrip).filter(Boolean) : [] },
      de: { ...empty.de, ...(s.de && typeof s.de === 'object' ? s.de : {}) },
    };
  } catch { return empty; }
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch {}
}
function cleanTrip(x) {
  if (!x || typeof x !== 'object' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !(Number(x.miles) > 0)) return null;
  const s = v => String(v ?? '').slice(0, 120);
  return {
    id: s(x.id) || uid(), date: x.date, miles: Math.round(Number(x.miles) * 10) / 10, from: s(x.from), to: s(x.to), purpose: s(x.purpose),
    vehicle: ['car', 'moto', 'bike'].includes(x.vehicle) ? x.vehicle : 'car',
    passengers: Math.min(8, Math.max(0, Math.floor(Number(x.passengers) || 0))),
    category: ['business', 'medical', 'charity'].includes(x.category) ? x.category : 'business',
    extras: Math.max(0, Math.round((Number(x.extras) || 0) * 100) / 100),
  };
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ---------- formatting ----------
const locale = () => (lang === 'de' ? 'de-DE' : 'en-GB');
const money = (v, cur) => new Intl.NumberFormat(cur === 'USD' && lang === 'en' ? 'en-US' : locale(), { style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const eur = v => money(v, 'EUR'), gbp = v => money(v, 'GBP'), usd = v => money(v, 'USD');
const num = (v, d = 0) => new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const miles = v => num(v, Number.isInteger(v) ? 0 : 1);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => new Intl.DateTimeFormat(locale(), { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(d + 'T12:00:00'));
// US log in English: ISO dates (dd/mm vs mm/dd is ambiguous there).
const dateFor = m => (m === 'us' && lang === 'en' ? d => d : fmtDate);
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

// ---------- static texts ----------
function applyTexts() {
  const T = t();
  document.documentElement.lang = lang;
  document.title = T.docTitle;
  for (const el of $$('[data-t]')) {
    const v = T[el.dataset.t];
    if (typeof v === 'string') el.textContent = v;
  }
  $('#langBtn').setAttribute('aria-label', T.langSwitchLabel);
  const de = lang === 'de';
  const page = de ? '/de/tools/mileage/' : '/tools/mileage/';
  const contact = (de ? '/de/newsletter/' : '/subscribe/') + '?topic=mileage';
  $('#lnkHome').href = $('#lnkHome2').href = LINK_BASE + page;
  $('#lnkImprint').href = LINK_BASE + (de ? '/impressum/' : '/imprint/');
  $('#lnkPrivacy').href = LINK_BASE + (de ? '/datenschutz/' : '/privacy/');
  $('#lnkUpdates').href = LINK_BASE + contact;
  for (const a of $$('[data-role=nudgeLink]')) a.href = LINK_BASE + contact;
  $('#facts').innerHTML = T.facts.map(f => `<li>${esc(f)}</li>`).join('');
  $('#sources').innerHTML = T.src.map(([label, key]) => `<li><a href="${esc(SOURCES[key])}" rel="noopener" target="_blank">${esc(label)}</a></li>`).join('');
  const st = selfTest();
  const el = $('#selftest');
  el.textContent = st.failed.length ? T.selftestFail(st.failed.map(f => f.name).join('; ')) : T.selftest(st.passed, st.total);
  el.classList.toggle('bad', st.failed.length > 0);
  if (st.failed.length) console.error('mileage self-test failed', st.failed);
}

// ---------- tabs ----------
function setMode(m) {
  mode = m;
  data.mode = m; save();
  for (const b of $$('[role=tab]')) {
    const on = b.dataset.mode === m;
    b.setAttribute('aria-selected', on ? 'true' : 'false');
    b.tabIndex = on ? 0 : -1;
  }
  for (const p of MODES) $('#panel-' + p).hidden = p !== m;
  $('#cmdMode').textContent = m;
  if (location.hash.slice(1) !== m) history.replaceState(null, '', location.pathname + location.search + '#' + m);
}
function initTabs() {
  const tabs = $$('[role=tab]');
  for (const b of tabs) {
    b.addEventListener('click', () => setMode(b.dataset.mode));
    b.addEventListener('keydown', ev => {
      const i = tabs.indexOf(b);
      const j = ev.key === 'ArrowRight' ? (i + 1) % tabs.length : ev.key === 'ArrowLeft' ? (i + tabs.length - 1) % tabs.length : -1;
      if (j < 0) return;
      ev.preventDefault(); tabs[j].focus(); setMode(tabs[j].dataset.mode);
    });
  }
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (MODES.includes(h)) setMode(h); });
}

// ---------- Germany ----------
function initDe() {
  $('#cmYear').innerHTML = DE_YEARS.map(y => `<option value="${y}">${y}</option>`).join('');
  const d = data.de;
  if (!DE_YEARS.includes(Number(d.year))) d.year = DE_YEARS[0];
  $('#cmYear').value = d.year; $('#cmKm').value = d.km; $('#cmDays').value = d.days; $('#cmMode').value = d.how === 'other' ? 'other' : 'car';
  $('#btKm').value = d.btKm; $('#btVehicle').value = d.btVehicle in DE_BUSINESS ? d.btVehicle : 'car';
  $('#bkYear').value = new Date().getFullYear(); $('#bkPages').value = 12;
  for (const id of ['cmYear', 'cmKm', 'cmDays', 'cmMode', 'btKm', 'btVehicle']) $('#' + id).addEventListener('input', renderDe);
  $('#bookPrint').addEventListener('click', printBook);
  for (const f of ['#formBook', '#formCommute', '#formTrip']) $(f).addEventListener('submit', ev => ev.preventDefault());
}
function renderDe() {
  const T = t();
  const d = data.de;
  d.year = Number($('#cmYear').value); d.km = $('#cmKm').value; d.days = $('#cmDays').value; d.how = $('#cmMode').value;
  d.btKm = $('#btKm').value; d.btVehicle = $('#btVehicle').value;
  save();
  const c = commuteAllowance({ year: d.year, km: d.km, days: d.days, ownCar: d.how === 'car' });
  $('#cmTotal').textContent = eur(c.total);
  $('#cmLine').textContent = T.cmLine(c.fullKm, eur(c.perDay), c.days, eur(c.raw), d.year) + (c.capped ? T.cmCapped(eur(DE_COMMUTE_CAP)) : '');
  const b = businessTripAllowance({ km: d.btKm, vehicle: d.btVehicle });
  if (b.rate === null) { $('#btTotal').textContent = '–'; $('#btLine').textContent = T.btBikeLine; }
  else { $('#btTotal').textContent = eur(b.total); $('#btLine').textContent = T.btLine(num(Number(d.btKm) || 0, 1).replace(/[.,]0$/, ''), eur(b.rate), eur(b.total)); }
}

// The printed Fahrtenbuch: always German, landscape A4, 20 numbered rows per page, carry-over line, page x of n.
const ROWS = 20;
function printBook() {
  const name = $('#bkName').value.trim(), plate = $('#bkPlate').value.trim(), car = $('#bkCar').value.trim();
  const year = $('#bkYear').value.trim();
  const pages = Math.min(60, Math.max(1, Math.floor(Number($('#bkPages').value) || 1)));
  const en = lang === 'en';
  const line = v => (v ? `<b>${esc(v)}</b>` : '<span class="blank"></span>');
  const sub = s => (en ? `<small>${esc(s)}</small>` : '');
  const head = (p) => `
    <div class="pb-head">
      <div class="pb-title">Fahrtenbuch ${year ? esc(year) : ''}</div>
      <div>Fahrer/Halter: ${line(name)}</div><div>Kennzeichen: ${line(plate)}</div><div>Fahrzeug: ${line(car)}</div>
      <div class="pb-no">Seite ${p} von ${pages}</div>
    </div>`;
  const th = `<thead><tr>
      <th class="c-nr">Nr.</th><th class="c-date">Datum${sub('Date')}</th>
      <th class="c-km">km-Stand Beginn${sub('Odometer start')}</th><th class="c-km">km-Stand Ende${sub('Odometer end')}</th>
      <th class="c-km">gefahrene km${sub('km driven')}</th><th class="c-art">Art*${sub('Type')}</th>
      <th class="c-ziel">Reiseziel (Ort, Straße, Nr.)${sub('Destination, address')}</th><th class="c-zweck">Reisezweck${sub('Purpose')}</th>
      <th class="c-kunde">Kunde / Geschäftspartner${sub('Customer visited')}</th><th class="c-route">Route bei Umweg${sub('Route if detour')}</th>
      <th class="c-sig">Kürzel${sub('Initials')}</th></tr></thead>`;
  let html = '';
  const guide = $('#bkGuide').checked;
  if (guide) {
    html += `<section class="pb-page pb-guide">${head(0).replace(`Seite 0 von ${pages}`, 'Hinweise')}
      <h2>So führen Sie dieses Fahrtenbuch richtig</h2>
      <ol>
        <li><b>Zeitnah und von Hand</b> eintragen, mit Kugelschreiber, direkt nach jeder Fahrt. Nicht nachträglich aus Kalender oder Notizen erstellen.</li>
        <li><b>Lückenlos:</b> jede Fahrt in einer Zeile, fortlaufend nummeriert. Der km-Stand am Beginn einer Fahrt ist der km-Stand am Ende der vorigen.</li>
        <li><b>Dienstliche Fahrten (D):</b> Datum, km-Stand zu Beginn und Ende, Reiseziel mit Adresse, Reisezweck und aufgesuchter Kunde oder Geschäftspartner. Bei einem Umweg die Route.</li>
        <li><b>Privatfahrten (P):</b> nur die gefahrenen Kilometer (km-Stand Beginn und Ende).</li>
        <li><b>Wohnung und erste Tätigkeitsstätte (W):</b> ein kurzer Vermerk reicht, plus die Kilometer.</li>
        <li><b>Fehler</b> nicht unkenntlich machen: einmal durchstreichen, Korrektur daneben, Kürzel. Kein Tipp-Ex, keine losen Blätter austauschen.</li>
        <li><b>Seiten zusammenhalten:</b> heften oder binden, Seitenzahlen nicht ändern. Am Seitenende die Summen bilden und auf die nächste Seite übertragen.</li>
        <li><b>Aufbewahren</b> mit den Steuerunterlagen.</li>
      </ol>
      <p class="pb-src">Grundlage: R 8.1 Abs. 9 Nr. 2 LStR; BFH, Urteil vom 16.11.2005, VI R 64/04. Ein elektronisch geführtes Fahrtenbuch wird nur anerkannt, wenn nachträgliche Änderungen technisch ausgeschlossen oder dokumentiert sind. Dieses Formular ist eine Vorlage, keine Steuerberatung.</p>
      <p class="pb-legend">* Art: <b>D</b> = dienstlich, <b>P</b> = privat, <b>W</b> = Wohnung und erste Tätigkeitsstätte</p>
    </section>`;
  }
  for (let p = 1; p <= pages; p++) {
    let rows = `<tr class="pb-carry"><td></td><td colspan="3">Übertrag von Seite ${p - 1 || '–'}</td><td></td><td></td><td colspan="5">km gesamt: D ____________ P ____________ W ____________</td></tr>`;
    for (let i = 1; i <= ROWS; i++) {
      rows += `<tr><td class="c-nr">${(p - 1) * ROWS + i}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
    }
    rows += `<tr class="pb-sum"><td></td><td colspan="3">Summe Seite ${p}</td><td></td><td></td><td colspan="5">km gesamt: D ____________ P ____________ W ____________</td></tr>`;
    html += `<section class="pb-page">${head(p)}<table class="pb">${th}<tbody>${rows}</tbody></table>
      <p class="pb-foot">* Art: D = dienstlich, P = privat, W = Wohnung und erste Tätigkeitsstätte. Zeitnah von Hand eintragen, nicht radieren. Vorlage: hmsk.life/de/tools/mileage</p></section>`;
  }
  doPrint('book', html, 'A4 landscape');
}

function doPrint(kind, html, size) {
  const area = $('#printArea');
  area.innerHTML = html;
  let st = $('#pageSize');
  if (!st) { st = document.createElement('style'); st.id = 'pageSize'; document.head.appendChild(st); }
  st.textContent = `@page { size: ${size}; margin: 10mm; }`;
  document.body.dataset.print = kind;
  const done = () => { document.body.dataset.print = ''; area.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  window.print();
  setTimeout(() => { if (!window.matchMedia('print').matches) done(); }, 1000);
}

// ---------- UK / US log ----------
const panel = m => $('#panel-' + m);
function initLog(m) {
  const p = panel(m);
  p.appendChild($('#logTpl').content.cloneNode(true));
  p.dataset.mode = m;
  for (const el of $$('[name]', p)) el.id = `${m}-${el.name}`;
  for (const l of $$('label[data-f]', p)) l.htmlFor = `${m}-${l.dataset.f}`;
  for (const el of $$(m === 'uk' ? '.us-only' : '.uk-only', p)) el.remove();
  const f = $('form', p);
  f.elements.date.value = today();
  f.addEventListener('submit', ev => { ev.preventDefault(); submitTrip(m); });
  $('[data-role=cancel]', p).addEventListener('click', () => resetForm(m));
  $('[data-role=csv]', p).addEventListener('click', () => exportCsv(m));
  $('[data-role=pdf]', p).addEventListener('click', () => printLog(m));
  $('[data-role=clear]', p).addEventListener('click', () => {
    if (!data[m].trips.length || !confirm(t().confirmClear)) return;
    data[m].trips = []; save(); resetForm(m); renderLog(m);
  });
  $('[data-role=import]', p).addEventListener('change', ev => importCsv(m, ev.target));
  $('[data-role=trips] tbody', p).addEventListener('click', ev => {
    const b = ev.target.closest('button[data-act]');
    if (!b) return;
    const id = b.closest('tr').dataset.id;
    if (b.dataset.act === 'del') {
      if (!confirm(t().confirmDelete)) return;
      data[m].trips = data[m].trips.filter(x => x.id !== id); save();
      if (editing[m] === id) resetForm(m);
      renderLog(m);
    } else startEdit(m, id);
  });
  if (m === 'uk') $('[data-role=relief]', p).addEventListener('input', ev => {
    if (!ev.target.matches('input[data-ty]')) return;
    data.uk.paid[ev.target.dataset.ty] = ev.target.value; save(); renderRelief();
  });
}
function submitTrip(m) {
  const T = t();
  const f = $('form', panel(m));
  const err = $('[data-role=err]', panel(m));
  const e = f.elements;
  const raw = { id: editing[m] || uid(), date: e.date.value, miles: e.miles.value, from: e.from.value.trim(), to: e.to.value.trim(), purpose: e.purpose.value.trim() };
  if (m === 'uk') Object.assign(raw, { vehicle: e.vehicle.value, passengers: e.passengers.value });
  else Object.assign(raw, { category: e.category.value, extras: e.extras.value });
  err.hidden = true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) { err.textContent = T.errDate; err.hidden = false; e.date.focus(); return; }
  if (!(Number(raw.miles) > 0)) { err.textContent = T.errMiles; err.hidden = false; e.miles.focus(); return; }
  const trip = cleanTrip(raw);
  const list = data[m].trips;
  const i = list.findIndex(x => x.id === trip.id);
  if (i >= 0) list[i] = trip; else list.push(trip);
  save();
  resetForm(m, trip);
  renderLog(m);
}
function resetForm(m, last) {
  const p = panel(m), f = $('form', p), T = t();
  editing[m] = null;
  const keepDate = last ? last.date : today();
  f.reset();
  f.elements.date.value = keepDate;
  if (last) { // keep vehicle / category for the next trip: logs are usually the same car
    if (m === 'uk') f.elements.vehicle.value = last.vehicle; else f.elements.category.value = last.category;
  }
  $('legend', f).textContent = T.addLegend;
  $('button[type=submit]', f).textContent = T.addTrip;
  $('[data-role=cancel]', p).hidden = true;
  $('[data-role=err]', p).hidden = true;
}
function startEdit(m, id) {
  const tr = data[m].trips.find(x => x.id === id);
  if (!tr) return;
  const p = panel(m), f = $('form', p), T = t();
  editing[m] = id;
  for (const k of ['date', 'miles', 'from', 'to', 'purpose', 'vehicle', 'passengers', 'category', 'extras']) if (f.elements[k]) f.elements[k].value = tr[k];
  $('legend', f).textContent = T.addLegendEdit;
  $('button[type=submit]', f).textContent = T.saveTrip;
  $('[data-role=cancel]', p).hidden = false;
  f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  f.elements.miles.focus({ preventScroll: true });
}

function sortedTrips(m) {
  return data[m].trips.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
function renderLog(m) {
  const T = t(), p = panel(m);
  const trips = sortedTrips(m);
  const cur = m === 'uk' ? gbp : usd;
  const claim = m === 'uk' ? ukClaim(trips) : usClaim(trips.map(x => ({ ...x, purpose: x.category })));
  $('[data-role=termTitle]', p).textContent = m === 'uk' ? T.ukTitle : T.usTitle;
  $('[data-role=totalLbl]', p).textContent = m === 'uk' ? T.ukTotalLbl : T.usTotalLbl;
  $('[data-role=total]', p).textContent = cur(claim.total);
  $('[data-role=totalLine]', p).textContent = m === 'uk' ? T.ukTotalLine(trips.length, claim.years.length) : T.usTotalLine(trips.length);
  $('[data-role=summary] tbody', p).innerHTML = m === 'uk' ? ukSummaryRows(claim) : usSummaryRows(claim);
  $('[data-role=rateNote]', p).textContent = m === 'uk' ? T.ukNote : (claim.unknown.length ? T.usUnknown(claim.unknown.length) + ' ' : '') + T.usNote;
  $('[data-role=thKind]', p).textContent = m === 'uk' ? T.thVehicle : T.thCategory;
  $('[data-role=tripsTitle]', p).textContent = T.tripsTitle(trips.length);
  $('[data-role=empty]', p).hidden = trips.length > 0;
  $('[data-role=trips]', p).hidden = trips.length === 0;
  $('[data-role=trips] tbody', p).innerHTML = trips.map(x => {
    const amt = claim.perTrip.get(x.id);
    const kind = m === 'uk' ? T.ukVeh[x.vehicle] + (x.vehicle === 'car' && x.passengers ? ` +${x.passengers}` : '') : T.usCat[x.category];
    const route = [x.from, x.to].filter(Boolean).join(' → ');
    return `<tr data-id="${esc(x.id)}"><td class="d">${dateFor(m)(x.date)}</td><td>${esc(route)}</td><td>${esc(x.purpose)}</td><td>${esc(kind)}</td>
      <td class="n">${miles(x.miles)}</td><td class="n">${amt === undefined ? '–' : cur(amt)}</td>
      <td class="act"><button type="button" class="ib" data-act="edit">${esc(T.edit)}</button><button type="button" class="ib" data-act="del">${esc(T.del)}</button></td></tr>`;
  }).join('');
  $('[data-role=nudge]', p).hidden = !data.exported;
  if (m === 'uk') renderRelief(claim);
}
function ukSummaryRows(claim) {
  const T = t();
  return claim.years.map(y => {
    const r = [];
    const R = ukRates(y.taxYear);
    r.push(`<tr class="yr"><td>${esc(T.ukYear(y.label))}${y.known ? '' : ' *'}</td><td class="n">${gbp(y.amount)}</td></tr>`);
    if (y.carHigh) r.push(`<tr class="sub"><td>${esc(T.ukRow.carHigh(miles(y.carHigh), R.car[0]))}</td><td class="n">${gbp(y.carHigh * R.car[0] / 100)}</td></tr>`);
    if (y.carLow) r.push(`<tr class="sub"><td>${esc(T.ukRow.carLow(miles(y.carLow), R.car[1]))}</td><td class="n">${gbp(y.carLow * R.car[1] / 100)}</td></tr>`);
    if (y.motoMiles) r.push(`<tr class="sub"><td>${esc(T.ukRow.moto(miles(y.motoMiles), R.moto))}</td><td class="n">${gbp(y.motoMiles * R.moto / 100)}</td></tr>`);
    if (y.bikeMiles) r.push(`<tr class="sub"><td>${esc(T.ukRow.bike(miles(y.bikeMiles), R.bike))}</td><td class="n">${gbp(y.bikeMiles * R.bike / 100)}</td></tr>`);
    if (y.passengerMiles) r.push(`<tr class="sub"><td>${esc(T.ukRow.pax(miles(y.passengerMiles), R.passenger))}</td><td class="n">${gbp(y.passengerMiles * R.passenger / 100)}</td></tr>`);
    if (!y.known) r.push(`<tr class="sub"><td colspan="2">* ${esc(T.ukUnknown)}</td></tr>`);
    return r.join('');
  }).join('');
}
function usSummaryRows(claim) {
  const T = t();
  const years = [...new Set(claim.rows.map(g => g.year))];
  return years.map(y => {
    const rows = claim.rows.filter(g => g.year === y);
    const extras = rows.reduce((s, g) => s + g.extras, 0);
    return `<tr class="yr"><td>${esc(T.usYear(y))}</td><td class="n">${usd(claim.byYear[y])}</td></tr>` +
      rows.map(g => `<tr class="sub"><td>${esc(T.usRow(T.usCat[g.purpose], dateFor('us')(g.from), dateFor('us')(g.to), miles(g.miles), String(g.rate).replace('.', lang === 'de' ? ',' : '.')))}</td><td class="n">${usd(g.mileage)}</td></tr>`).join('') +
      (extras ? `<tr class="sub"><td>${esc(T.usExtras)}</td><td class="n">${usd(extras)}</td></tr>` : '');
  }).join('');
}
function renderRelief(claim) {
  const T = t();
  claim = claim || ukClaim(data.uk.trips);
  const box = $('#panel-uk [data-role=relief]');
  if (!claim.years.length) { box.innerHTML = ''; return; }
  const focus = document.activeElement?.dataset?.ty;
  box.innerHTML = claim.years.map(y => {
    const paid = data.uk.paid[y.taxYear] ?? '';
    const r = ukRelief(y.amount, paid);
    const msg = paid === '' ? '' : r.relief ? T.ukRelief(gbp(r.relief)) : r.taxable ? T.ukTaxable(gbp(r.taxable)) : T.ukEven;
    return `<div class="paid"><label for="paid-${y.taxYear}">${esc(T.ukPaidLbl(y.label))}</label>
      <div class="money"><input id="paid-${y.taxYear}" data-ty="${y.taxYear}" type="number" inputmode="decimal" min="0" step="0.01" value="${esc(paid)}"><span>£</span></div>
      <p class="calcline">${esc(msg)}</p></div>`;
  }).join('');
  if (focus) { const el = box.querySelector(`[data-ty="${focus}"]`); if (el) { el.focus(); const v = el.value; el.value = ''; el.value = v; } }
}

// ---------- export / import ----------
function csvFor(m) {
  const T = t();
  const trips = sortedTrips(m).reverse();
  if (m === 'uk') {
    const c = ukClaim(trips);
    return toCSV(T.csvHeader.uk, trips.map(x => [x.date, ukTaxYearLabel(ukTaxYear(x.date)), x.from, x.to, x.purpose, x.vehicle, x.passengers, x.miles, (c.perTrip.get(x.id) ?? 0).toFixed(2)]));
  }
  const c = usClaim(trips.map(x => ({ ...x, purpose: x.category })));
  return toCSV(T.csvHeader.us, trips.map(x => [x.date, x.from, x.to, x.purpose, x.category, x.miles, x.extras.toFixed(2), (c.perTrip.get(x.id) ?? 0).toFixed(2)]));
}
function exportCsv(m) {
  const blob = new Blob(['﻿' + csvFor(m)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mileage-${m}-${today()}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  markExported(m);
}
function markExported(m) {
  data.exported = true; save();
  $('[data-role=nudge]', panel(m)).hidden = false;
}
function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  text = text.replace(/^﻿/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}
function importCsv(m, input) {
  const file = input.files && input.files[0];
  if (!file) return;
  file.text().then(text => {
    const rows = parseCsv(text);
    const head = (rows.shift() || []).map(h => h.trim().toLowerCase());
    const col = k => head.indexOf(k);
    const unq = s => (typeof s === 'string' && s.startsWith("'") ? s.slice(1) : s);
    let n = 0;
    for (const r of rows) {
      const get = k => (col(k) >= 0 ? unq(r[col(k)]) : undefined);
      const trip = cleanTrip({ date: get('date'), miles: get('miles'), from: get('from'), to: get('to'), purpose: get('purpose'),
        vehicle: get('vehicle'), passengers: get('passengers'), category: get('category'), extras: get('parking_tolls_usd') });
      if (!trip) continue;
      const dup = data[m].trips.some(x => x.date === trip.date && x.miles === trip.miles && x.from === trip.from && x.to === trip.to && x.purpose === trip.purpose);
      if (!dup) { data[m].trips.push(trip); n++; }
    }
    save(); renderLog(m);
    alert(n ? t().importDone(n) : t().importNone);
  }).finally(() => { input.value = ''; });
}
function printLog(m) {
  const T = t();
  const p = panel(m);
  const trips = sortedTrips(m).reverse();
  const cur = m === 'uk' ? gbp : usd;
  const claim = m === 'uk' ? ukClaim(trips) : usClaim(trips.map(x => ({ ...x, purpose: x.category })));
  const body = trips.map(x => `<tr><td>${dateFor(m)(x.date)}</td><td>${esc([x.from, x.to].filter(Boolean).join(' → '))}</td><td>${esc(x.purpose)}</td>
    <td>${esc(m === 'uk' ? T.ukVeh[x.vehicle] + (x.vehicle === 'car' && x.passengers ? ` +${x.passengers}` : '') : T.usCat[x.category])}</td>
    <td class="n">${miles(x.miles)}</td><td class="n">${claim.perTrip.has(x.id) ? cur(claim.perTrip.get(x.id)) : '–'}</td></tr>`).join('');
  const html = `<section class="pl">
    <h1>${esc(T.printLogTitle[m])}</h1>
    <p class="pl-total">${esc($('[data-role=totalLbl]', p).textContent)}: <b>${cur(claim.total)}</b></p>
    <table class="pl-sum"><tbody>${m === 'uk' ? ukSummaryRows(claim) : usSummaryRows(claim)}</tbody></table>
    <table class="pl-trips"><thead><tr><th>${esc(T.thDate)}</th><th>${esc(T.thRoute)}</th><th>${esc(T.thPurpose)}</th><th>${esc(m === 'uk' ? T.thVehicle : T.thCategory)}</th><th class="n">${esc(T.thMiles)}</th><th class="n">${esc(T.thAmount)}</th></tr></thead><tbody>${body}</tbody></table>
    <p class="pl-note">${esc(m === 'uk' ? T.ukNote : T.usNote)}</p>
    <p class="pl-note">${esc(T.printed(fmtDate(today())))}</p></section>`;
  doPrint('log', html, 'A4 portrait');
  markExported(m);
}

// ---------- language ----------
function setLang(l) {
  lang = l;
  try { localStorage.setItem(STORE + '-lang', l); } catch {}
  applyTexts();
  for (const m of ['uk', 'us']) { if (!editing[m]) resetFormTexts(m); renderLog(m); }
  renderDe();
}
function resetFormTexts(m) {
  const f = $('form', panel(m)), T = t();
  $('legend', f).textContent = T.addLegend;
  $('button[type=submit]', f).textContent = T.addTrip;
}

// ---------- start ----------
initTabs();
initDe();
initLog('uk');
initLog('us');
$('#langBtn').addEventListener('click', () => setLang(lang === 'de' ? 'en' : 'de'));
applyTexts();
resetFormTexts('uk'); resetFormTexts('us');
renderDe();
renderLog('uk');
renderLog('us');
setMode(mode);
