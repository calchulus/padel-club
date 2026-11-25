# Padel Club archetype

A 3-court padel club simulator (Tycoonify-style), focused on Bangkok (focus 1), Shenzhen (focus 2) and Kuala Lumpur (third), with other cities as expansion profiles.

| File | What it is |
| --- | --- |
| `padel-club-tycoon.html` | Built single-file simulator (open in a browser) |
| `engine.js` | Monthly simulation: hourly demand by weekday/weekend, weather and roof, competition, entry-level track, memberships and prepaid float, build cost and financing. Also: ways to get courts (rent, build, convert, buy, owner-funded), nine conversion site types (`SITETYPES`: pitches, futsal and badminton halls, warehouses, malls, tennis courts, schools, movable courts with teardown and rebuild costs), the guild model (`simGuild`) and the 60-month multi-site planner (`runNetwork`) |
| `locations.js` | City profiles (prices, climate normals, office/visitor traffic, competition) and sample candidate sites |
| `page.html` + `build.py` | Page source; `python3 build.py` inlines `locations.js` and `engine.js` into `padel-club-tycoon.html` |
| `bangkok_accessible_family_club.json` | Archetype export in the Tycoonify preset schema (`schema_version` 1.1.0, type B) with a `location` block |
| `NON-RENTAL-PLAN.md` | The Non-Rental Income Plan mapped into the model: every stream, its levers, its formula, and measured output against the plan's own estimate |
| `IMPROVEMENTS.md` | Open work, ordered by value |
| `AUDIT.md` | Evidence-backed test audit (P1/P2 fixed and verified) |
| `tests/` | 307 assertions, no npm: `node tests/engine.test.js` (model) and `python3 tests/browser_test.py` (page). See `tests/README.md` |

Model outputs are estimates calibrated toward published benchmarks, not forecasts. Shenzhen prices and the competitor growth rates are assumptions.

## How the page is organised

Two accordion layers over one scroll, so the first read is a digest rather than 28 stacked topics:

1. **Categories** (7) — Overview · Optimizations · Demand & pricing · Revenue & customers · Costs & capital · Growth & portfolio · Model & data. Each collapses to a numbered card carrying live figures (break-even, EBITDA, fill rates, upfront cost…). Only Overview and Optimizations start open. A sticky chip bar jumps between them.
2. **Topics** (14) — inside a category, each section collapses to its title plus a two-line clamped summary. Charts redraw when a panel is revealed, since they measure their container.

**Optimizations** is a playbook catalogue: all 41 operating modules grouped into Kids & pipeline, Members & prepaid cash, Programming & yield, B2B & brand, Shop & hospitality, Automation & cost. Each card shows 3-year ΔEBITDA, setup cost, simple payback, effort and prepaid-cash delta, with a one-tap switch. Sort by value, payback, cost, effort or cash; filter to what is not yet running. ΔEBITDA and prepaid cash are simulated per module; **setup cost = modelled capex + an editorial launch estimate, and effort is editorial** — neither is a model input.

**Levers** live in a rail (a collapsible drawer on mobile) with a concept search: "debt" finds *Share of upfront spend borrowed*, "staffing" finds smart access. Matching groups auto-expand.

**Non-rental income** has its own section under Revenue & customers: the plan's eight launch checks (each marked as a simulated output or an assumption), a per-stream year-1/2/3 table, and the measured Δ EBITDA against every stream switched off. Racket hire, pro shop, café concession and the sponsor rate card default on; passes, parties, team days, school PE, own-run café and the prepaid products default off. The `Non-rental income plan` preset switches the whole playbook on. See `NON-RENTAL-PLAN.md`.

**Scenarios** round-trip in full: `overrides` in the exported archetype carries every changed lever plus the network plan and site list. "Copy scenario link" puts the same state in a `#s=` URL hash (~950 chars) that restores in a fresh browser; the import box accepts either form.

## Test

```sh
node tests/engine.test.js                  # model, Node only, ~2s
python3 build.py && python3 -m http.server 8899 &
python3 tests/browser_test.py --local      # page, needs Playwright + Chromium
```

No npm and no test framework. The engine suite runs in CI before every deploy; the browser
suite defaults to the live site. `tests/README.md` lists the page's testing traps — read it
before debugging a browser failure.

## Run locally

```sh
python3 build.py
python3 -m http.server 8899
# open http://localhost:8899/padel-club-tycoon.html
```

The built HTML is self-contained (only Google Fonts is fetched remotely) and is not committed — `build.py` and the Pages workflow both regenerate it from `page.html`, `locations.js` and `engine.js`.

## Deploy

Live at **https://calchulus.github.io/padel-club/**. Every push to `main` runs `.github/workflows/deploy.yml`, which builds with `build.py` and publishes the result as `index.html` via GitHub Pages (source: GitHub Actions). No base-path configuration is needed — the page has no router and no relative asset URLs.
