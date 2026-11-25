#!/usr/bin/env node
/* Engine-level tests. No browser, no npm, no dependencies — just `node tests/engine.test.js`.
 *
 * These cover the model itself. UI behaviour (accordions, lever sync, scenario round-trip,
 * calibration idempotency) lives in tests/browser_test.py, because it only exists in the page.
 *
 * Uses require(), which works because engine.js and locations.js both carry a CommonJS
 * export guard that is inert in the browser build.
 */
const path = require('path');
const root = path.join(__dirname, '..');
const { sim, DEF, NRCAPEX, cityP } = require(path.join(root, 'engine.js'));
const { LOCS, ROOFS } = require(path.join(root, 'locations.js'));

// Mirrors NRPLAN / NROFF in page.html. The browser test asserts the page's preset still
// produces the same headline, so drift between the two shows up as a failure there.
const NRPLAN = { racketOn:1, retailOn:1, cafeOn:1, sponsorCardOn:1, passOn:1, starterPassOn:1,
  partyOn:1, teamOn:1, clipsOn:1, peOn:1, packsOn:1, classPackOn:1, familyWalletOn:1,
  bizWalletOn:1, giftOn:1, referralOn:1 };
const NROFF = { racketOn:0, retailOn:0, cafeOn:0, cafeOwn:0, sponsorCardOn:0, passOn:0,
  starterPassOn:0, partyOn:0, teamOn:0, clipsOn:0, peOn:0, packsOn:0, classPackOn:0,
  familyWalletOn:0, bizWalletOn:0, giftOn:0, referralOn:0, voucherOn:0, sponsorTaxBreak:0, sportsRelief:0 };

const base = (id = 'bangkok', roof = 'covered') => Object.assign({}, DEF, cityP(id, roof), { courts: 3 });
const plan = (id = 'bangkok', roof = 'covered') => Object.assign(base(id, roof), NRPLAN);

let pass = 0, fail = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { pass++; } else { fail++; failures.push(name + (detail ? ' — ' + detail : '')); }
}
function group(name, fn) { console.log('\n' + name); fn(); }

// Walk every numeric field reachable from a result, ignoring the slot grid (large, checked separately).
function nonFinite(obj, skip = new Set(['slots', 'p', 'out'])) {
  const bad = [];
  (function walk(o, path) {
    if (o == null) return;
    for (const k of Object.keys(o)) {
      if (skip.has(k)) continue;
      const v = o[k];
      if (typeof v === 'number') { if (!Number.isFinite(v)) bad.push(path + k + '=' + v); }
      else if (typeof v === 'object') walk(v, path + k + '.');
    }
  })(obj, '');
  return bad;
}

group('1. Numeric robustness — every city x roof, defaults and full plan', () => {
  const cities = Object.keys(LOCS), roofs = Object.keys(ROOFS);
  let combos = 0;
  for (const c of cities) for (const r of roofs) for (const mk of [base, plan]) {
    const res = sim(mk(c, r));
    const bad = nonFinite({ years: res.years, fin: res.fin, nrYears: res.nrYears, kpis: res.kpis,
      capex: res.capex, peakFloat: res.peakFloat, minCash: res.minCash });
    ok(`${c}/${r}/${mk === plan ? 'plan' : 'default'} finite`, bad.length === 0, bad.join(', '));
    combos++;
  }
  console.log(`  ${combos} combinations`);
});

group('2. Revenue and cost identities hold every month', () => {
  const res = sim(plan());
  let revBad = 0, costBad = 0, ebitdaBad = 0;
  for (const m of res.out.slice(1)) {
    const rs = Object.values(m.rev).reduce((a, b) => a + b, 0);
    const cs = Object.values(m.cost).reduce((a, b) => a + b, 0);
    if (Math.abs(rs - m.revenue) > 1e-6) revBad++;
    if (Math.abs(cs - m.opex) > 1e-6) costBad++;
    if (Math.abs(m.revenue - m.opex - m.ebitda) > 1e-6) ebitdaBad++;
  }
  ok('sum(rev) === revenue', revBad === 0, revBad + ' months differ');
  ok('sum(cost) === opex', costBad === 0, costBad + ' months differ');
  ok('revenue - opex === ebitda', ebitdaBad === 0, ebitdaBad + ' months differ');
});

group('3. Streams off means zero — no leakage into the totals', () => {
  const off = sim(Object.assign(plan(), NROFF));
  const n = off.nrYears[2];
  for (const k of ['racket','retail','cafe','sponsorCard','team','pass','starterPass','parties','clips','pe','packs','biz','gift','vouchers'])
    ok(`${k} is zero when off`, Math.abs(n[k] || 0) < 1e-9, String(n[k]));
  ok('no off-peak displacement when the pass is off', Math.abs(n.displaced) < 1e-9, String(n.displaced));
  ok('no non-rental fit-out capex when off', off.fin.capexNR === 0, String(off.fin.capexNR));
});

group('4. Every module toggle runs and stays finite', () => {
  const keys = Object.keys(NRPLAN).concat(['cafeOwn','voucherOn']);
  for (const k of keys) {
    const on = sim(Object.assign(plan(), { [k]: 1 }));
    const off = sim(Object.assign(plan(), { [k]: 0 }));
    const bad = nonFinite({ a: on.years, b: off.years });
    ok(`toggle ${k}`, bad.length === 0, bad.join(', '));
  }
});

group('5. Prepaid custody', () => {
  ok('Shenzhen defaults to ring-fenced', sim(base('shenzhen')).custody === 1);
  ok('Bangkok defaults to free', sim(base('bangkok')).custody === 0);
  ok('KL defaults to free', sim(base('kualalumpur')).custody === 0);
  ok('override forces ring-fenced in Bangkok', sim(Object.assign(base('bangkok'), { custody: 1 })).custody === 1);
  ok('override forces free in Shenzhen', sim(Object.assign(base('shenzhen'), { custody: 0 })).custody === 0);

  const p = plan('shenzhen');
  const locked = sim(Object.assign({}, p, { custody: 1 }));
  const free = sim(Object.assign({}, p, { custody: 0 }));
  ok('ring-fenced float is reported but not spendable',
    locked.peakFloat > 0 && locked.peakFreeFloat === 0,
    `float ${locked.peakFloat}, free ${locked.peakFreeFloat}`);
  ok('free float is spendable', free.peakFreeFloat > 0);
  ok('custody raises the owner cash requirement', locked.minCash < free.minCash,
    `${locked.minCash} vs ${free.minCash}`);
  ok('custody does not change the build cost', locked.capex === free.capex);
  ok('custody does not change recognised revenue',
    Math.abs(locked.years[2].revenue - free.years[2].revenue) < 1e-6);
});

group('6. Public money never reduces the build (the plan is explicit about this)', () => {
  for (const extra of [{ govRentSub: 50 }, { voucherOn: 1, voucherValue: 25 },
                       { sponsorTaxBreak: 30 }, { sportsRelief: 20 },
                       { govRentSub: 50, voucherOn: 1, sponsorTaxBreak: 30, sportsRelief: 20 }]) {
    const r = sim(Object.assign(plan(), extra));
    ok(`capex unchanged by ${Object.keys(extra).join('+')}`, r.capex === r.fin.capexGross,
      `${r.capex} vs ${r.fin.capexGross}`);
  }
  const a = sim(plan()), b = sim(Object.assign(plan(), { govRentSub: 30 }));
  ok('operating support helps year 1', b.years[0].ebitda > a.years[0].ebitda);
  ok('operating support expires after month 24',
    Math.abs(b.years[2].ebitda - a.years[2].ebitda) < 1e-6,
    `${b.years[2].ebitda} vs ${a.years[2].ebitda}`);
});

group('7. Capacity is real — programmed hours displace casual demand', () => {
  const without = sim(Object.assign(plan(), { peOn: 0 }));
  const with_ = sim(plan());
  const peSlots = with_.out[24].slots.reduce((a, s) => a + (s.pe || 0), 0);
  ok('school PE occupies slots on the grid', peSlots > 0, String(peSlots));
  ok('school PE reduces casual off-peak served', with_.out[24].offServed < without.out[24].offServed,
    `${with_.out[24].offServed} vs ${without.out[24].offServed}`);
  ok('school PE carries a coaching cost', with_.out[24].cost.coaches > without.out[24].cost.coaches);

  const spOff = sim(Object.assign(plan(), { starterPassOn: 0 }));
  ok('starter pass carries a coaching cost', with_.out[24].cost.coaches > spOff.out[24].cost.coaches);

  for (const c of Object.keys(LOCS)) {
    const r = sim(plan(c));
    const over = r.out[24].slots.filter(s =>
      (s.kids + s.starter + s.social + s.corp + s.pe + s.coach + s.rent) > s.cap + 1e-6);
    ok(`${c}: no slot over capacity`, over.length === 0, over.length + ' slots');
  }
});

group('8. Off-peak pass cannibalisation', () => {
  const r = sim(plan());
  for (const m of r.out.slice(1)) {
    ok(`m${m.m}: displacement never exceeds off-peak rental revenue`,
      m.passDisplaced <= m.rev.courtOff + m.passDisplaced + 1e-6 && m.passDisplaced >= 0);
  }
  const empty = sim(Object.assign(plan(), { priceOff: 200, passCannibal: 0 }));
  const full = sim(Object.assign(plan(), { passCannibal: 100 }));
  ok('higher base cannibalisation displaces more',
    full.nrYears[2].displaced > sim(Object.assign(plan(), { passCannibal: 0 })).nrYears[2].displaced);
  ok('displacement is bounded by the off-peak revenue available',
    full.nrYears[2].displaced <= full.years[2].rev.courtOff + full.nrYears[2].displaced + 1e-6);
});

group('9. Cafe: own-run carries goods AND staff', () => {
  const conc = sim(plan()), own = sim(Object.assign(plan(), { cafeOwn: 1 }));
  ok('own-run takes the full takings', own.nrYears[2].cafe > conc.nrYears[2].cafe);
  ok('own-run adds staff cost', own.years[2].cost.staff > conc.years[2].cost.staff);
  ok('own-run adds fit-out capex', own.fin.capexNR > conc.fin.capexNR);
  // Documents the finding rather than pinning a number: at default footfall the concession wins.
  console.log(`  concession Y3 EBITDA ${Math.round(conc.years[2].ebitda)} vs own-run ${Math.round(own.years[2].ebitda)}`);
});

group('10. The eight launch checks', () => {
  const r = sim(plan());
  ok('exactly 8 checks', r.kpis.length === 8, String(r.kpis.length));
  ok('every check has a finite value and a target',
    r.kpis.every(k => Number.isFinite(k.v) && Number.isFinite(k.target)));
  ok('every check is marked model or input',
    r.kpis.every(k => k.src === 'model' || k.src === 'input'));
  ok('three checks are assumptions', r.kpis.filter(k => k.src === 'input').length === 3);

  const brk = r.kpis.find(k => k.id === 'breakage');
  ok('breakage is a band, not a floor', brk.band === true && brk.max === 0.08);
  ok('breakage 5% passes the band', sim(Object.assign(plan(), { breakage: 5 })).kpis.find(k => k.id === 'breakage').pass);
  ok('breakage 1% fails the band (too low)', !sim(Object.assign(plan(), { breakage: 1 })).kpis.find(k => k.id === 'breakage').pass);
  ok('breakage 20% fails the band (too high)', !sim(Object.assign(plan(), { breakage: 20 })).kpis.find(k => k.id === 'breakage').pass);

  // Spend target is city-specific local money converted at the city FX rate, not a flat dollar figure.
  const bkk = sim(plan('bangkok')).kpis.find(k => k.id === 'spend');
  const sz = sim(plan('shenzhen')).kpis.find(k => k.id === 'spend');
  const kl = sim(plan('kualalumpur')).kpis.find(k => k.id === 'spend');
  ok('Bangkok spend target is ฿120 in USD', Math.abs(bkk.target - 120 / LOCS.bangkok.fx) < 1e-9);
  ok('Shenzhen spend target is ¥25 in USD', Math.abs(sz.target - 25 / LOCS.shenzhen.fx) < 1e-9);
  ok('KL spend target is RM15 in USD', Math.abs(kl.target - 15 / LOCS.kualalumpur.fx) < 1e-9);
  ok('float check reads month 12, not month 24',
    r.kpis.find(k => k.id === 'float12').v === r.out[12].float);
});

group('11. Sponsor renewals decay the deal count', () => {
  const loyal = sim(Object.assign(plan(), { sponsorRenew: 100 }));
  const leaky = sim(Object.assign(plan(), { sponsorRenew: 50 }));
  ok('lower renewal rate earns less sponsorship by year 3',
    leaky.years[2].rev.sponsorship < loyal.years[2].rev.sponsorship,
    `${Math.round(leaky.years[2].rev.sponsorship)} vs ${Math.round(loyal.years[2].rev.sponsorship)}`);
});

group('12. Add-on index scales take-up by city', () => {
  const b = sim(plan('bangkok')), s = sim(plan('shenzhen')), k = sim(plan('kualalumpur'));
  ok('Bangkok index 1.00', b.addonIdx === 1);
  ok('Shenzhen index 0.90', s.addonIdx === 0.9);
  ok('KL index 0.80', k.addonIdx === 0.8);
  ok('racket hire scales with the index', s.nrYears[2].racket < b.nrYears[2].racket);
});

group('13. Non-rental fit-out capex matches the declared module costs', () => {
  const r = sim(plan());
  const expect = (NRCAPEX.racket + NRCAPEX.retail + NRCAPEX.party + NRCAPEX.team + NRCAPEX.pe + NRCAPEX.packs) * r.p.costIdx;
  ok('capexNR equals the sum of switched-on module costs', Math.abs(r.fin.capexNR - expect) < 1e-6,
    `${r.fin.capexNR} vs ${expect}`);
  ok('concession cafe adds no fit-out', !Object.prototype.hasOwnProperty.call(NRCAPEX, 'cafeConcession'));
});

console.log(`\n${'='.repeat(52)}\n${pass} passed, ${fail} failed`);
if (fail) { console.log('\nFailures:'); failures.forEach(f => console.log('  ✗ ' + f)); process.exit(1); }
console.log('engine: all green');