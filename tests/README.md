# Tests

No npm, no framework, no test runner dependency — consistent with the rest of the repo.

```sh
# 1. Engine tests — Node only, no browser, ~2 seconds
node tests/engine.test.js

# 2. Browser tests — needs Playwright + headless Chromium
python3 build.py
python3 -m http.server 8899 &
python3 tests/browser_test.py --local      # local build
python3 tests/browser_test.py              # live site (default)
python3 tests/browser_test.py --url https://…/index.html
```

Both exit non-zero on failure and print every failing assertion.

| Suite | Assertions | Covers |
| --- | --- | --- |
| `engine.test.js` | 188 | The model: numeric robustness, revenue/cost identities, stream isolation, custody, public money, capacity, cannibalisation, the eight launch checks |
| `browser_test.py` | 119 | The page: presets, city/roof sweep, catalogue, lever search, scenario round-trip, calibration idempotency, mobile, drag performance |

## What each suite is for

**`engine.test.js`** uses `require()`, which works because `engine.js` and `locations.js`
both carry a CommonJS export guard that is inert in the browser build. It builds scenarios
with the engine's own `cityP(id, roof)` rather than a hand-rolled base, so it exercises the
real path. Most model questions can be answered here in seconds without launching a browser.

Notable guards:
- **Public money never reduces capex.** The plan is explicit that no grant in these three
  cities pays to build a private club. A test asserts `capex === capexGross` under every
  combination of support levers, so a future "launch grant" cannot slip back in.
- **Operating support expires.** `govRentSub` must help year 1 and leave year 3 untouched.
- **Capacity is real.** School PE and the starter pass must occupy slots and reduce casual
  off-peak served; no slot may exceed capacity in any city.
- **Streams off means zero.** Every new stream must be exactly 0 when switched off — no
  leakage into the totals.
- **The breakage check is a band**, so 1% and 20% must both fail, not just 1%.
- **Spend targets are city-specific local money** converted at the city FX rate.

**`browser_test.py`** covers what only exists in the page. Read the trap list at the top of
the file before debugging a failure — all eight cost a false result before they were
understood. The two that bite hardest:

- `P`, `R`, `PRESETS` are top-level lexicals and **not reachable from `page.evaluate()`**.
  Drive the DOM.
- `document.body.textContent` **includes the inline `<script>` source**, which literally
  contains "NaN", "Infinity" and "undefined". Filter SCRIPT/STYLE nodes or every scan fails.

It also guards the **calibration idempotency regression** (AUDIT P1 #1): six identical fits
must produce the same `demandScale`. Before the fix this drifted 0.75× → 0.55×.

## Keeping the two in sync

`NRPLAN` / `NROFF` are duplicated in `engine.test.js` because the page's `PRESETS` is not
reachable from Node. The browser suite asserts the page's plan preset renders the same
headline figures, so drift between the two surfaces as a browser failure.

## Adding a test

Engine: add a `group('N. …', () => { … })` block using `ok(name, cond, detail)`.
Browser: add a numbered section using the `Page` helpers (`open_cat`, `open_sub`,
`set_lever`, `preset`, `city`, `bad_tokens`) rather than raw selectors, so the accordion
and textContent traps stay handled in one place.