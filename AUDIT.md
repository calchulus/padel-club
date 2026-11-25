# Padel Club Tycoon — test audit (2026-11-24)

> **Status update, 2026-11-24:** all P1 items (1–3) and all P2 items (4–8) are **fixed and verified**.
> The page was also restructured into two accordion layers with an optimizations playbook.
> Verified after the changes: calibration stable at 0.53× across 6 identical fits; city switch keeps
> courts/baseOpex; sponsor label matches state; price inversion warns and clears; 41-step slider drag
> 1,583 ms → 1 ms and a full render 26 sims/63 ms → 2 sims/15 ms; scenario link and export/import
> round-trip in a fresh browser; 8 presets + 30 city/roof combos clean; 0 console errors.
> Mobile scroll length 20,329 px → 7,401 px. P3 items (9–15) remain open.
>
> **Update, 2026-11-25 — non-rental income plan integrated.** 16 revenue streams (was 11), 41 catalogue
> modules (was 23), 178 levers (was 133), 9 presets (was 8), plus the plan's eight launch checks.
> Re-verified after the change: 9 presets and 10 cities × 3 roofs clean (no NaN/Infinity/undefined in
> rendered text); all 18 new module toggles clean; 45 levers round-trip through export/import and a
> 955-char `#s=` URL in a fresh browser; 41-step slider drag 21 ms / 4 sims; 0 page errors;
> no horizontal overflow at 390 px. **The open-items list now lives in `IMPROVEMENTS.md`**, which
> supersedes the P3 list below and adds the gaps this work exposed (no committed tests, preset JSON
> drift, city-invariant volume streams, unenforced compliance caps).

Black-box tested against the live site https://calchulus.github.io/padel-club/ with headless Chromium (Playwright), driving the real UI.

## Coverage

| Sweep | Result |
| --- | --- |
| 8 presets × full render | no NaN / Infinity / undefined |
| 10 cities × 3 roofs = 30 combos | no NaN / Infinity / undefined |
| 20 levers pushed to their bounds | no NaN / Infinity / undefined |
| Viewports 375 / 390 / 768 / 1024 / 1440 | no page-level horizontal overflow at any width |
| Console + page errors across all of the above | 0 |
| Google Fonts blocked | page renders, falls back to `system-ui`, 0 errors |
| Calibration: sample / valid / garbage input | all handled, garbage rejected with a message |
| Copy JSON → clipboard | valid JSON, matches textarea, `meta.schema_version` 1.1.0 |
| Network planner add / reset | 11 → 12 → 11 rows, no errors |
| Persistence across reload | lever edits retained |
| Labels / accessible names | 0 unlabelled inputs, 0 unnamed buttons, `:focus-visible` present |

The model is numerically robust. Everything below is behaviour, fidelity or ergonomics — not crashes.

---

## P1 — correctness

### 1. Repeated calibration on identical data drifts demand downward

Clicking "Fit model to this data" repeatedly on the **same** sample CSV:

| Click | demandScale | reported fit |
| --- | --- | --- |
| (start) | 0.75× | — |
| 1 | 0.66× | ×0.88 |
| 2 | 0.61× | ×0.93 |
| 3 | 0.58× | ×0.96 |
| 4 | 0.57× | ×0.98 |
| 5 | 0.56× | ×0.98 |
| 6 | 0.55× | ×0.99 |

Fitting is not idempotent: the same evidence produces a ~27% weaker business after six clicks. The ratio converges toward 1 but never reaches it, so every click erodes demand a little more.

Cause (`page.html`, `calApply`): the fit measures observed occupancy against `sim({...P, calib:null})` — a model with the hourly **shape calibration removed** — but then applies the resulting scale to a model that **keeps** the new shape. The measured model and the run model differ, so each fit over-corrects.

Fix: fit against the same configuration that will be run (keep `calib` in the base sim, or solve scale and shape jointly to a fixed point), and stop when `|sc - 1| < 0.01`. Also surface "already fitted — no change" instead of silently re-scaling.

### 2. Switching city silently discards courts and running cost

Set courts 6 and base running cost $150k, then click any city chip → courts **3**, baseOpex **$100k**.

Cause: `cityParams()` hardcodes `baseOpex:100000, courts:3`, and the city handler `Object.assign(P, cityParams(...))` overwrites them. This contradicts the section's own framing ("Same club and levers in each city") and quietly invalidates a scenario the user built.

Fix: drop `courts` and `baseOpex` from the city overwrite (keep them user-owned), or show a "reset club size to city default?" confirmation. Note the comparison table already builds its own per-city base, so it does not need the live `P` mutated this way.

### 3. Off-peak price can exceed peak price

Peak 20 / off-peak 70 is accepted with no warning, and the model happily runs it. There is no cross-lever guard. Either clamp `priceOff <= pricePeak` or flag it in the advice list.

---

## P2 — fidelity and friction

### 4. State/label desync when a dependent slider is clamped

Set sponsored courts 3, then reduce courts to 2: state clamps to 2 (confirmed — after reload the label reads 2), but the on-screen output still reads **3** until a reload. `P.sponsorCourts` is clamped in the `courts` handler without refreshing `#o_sponsorCourts`. Same pattern risks `demandScale`, which calibration can push outside its 0.3–1.5 slider range.

Fix: one `syncLever(id)` helper that writes state, slider value, max and output together; call it wherever a lever is changed programmatically.

### 5. Every slider tick runs 26 full simulations (~40–63 ms)

Instrumented `sim()`: **26 calls for a single `input` event**, 63 ms on an M-series desktop; a 41-step drag took 1,583 ms (~39 ms/tick, ≈26 fps ceiling). On a mid-range phone this will be visibly laggy.

The cost is the comparison sections recomputing on every tick: `compare()` alone is 10 cities × (base + 2 alternate roofs + no-entry variant) ≈ 33 sims, plus upsell, capex-mode and site-type tables.

Fix, in order of payoff:
1. `requestAnimationFrame`-coalesce or debounce (~120 ms) the full `run()`; update the dragged lever's own output immediately so the UI still feels instant.
2. Split `run()` into "headline + booking sheet" (cheap, every tick) and "comparison tables" (deferred / idle / on-expand).
3. Memoise `sim()` on a hash of its input object — the roof/city sweeps re-evaluate many identical configurations.

### 6. Export is lossy: 6 levers out of ~130 controls

`levers[]` in the exported archetype is a hardcoded list of 6 (price, off-peak, ad spend, membership fee, kids fee, automation tier). The other ~83 sliders and ~40 toggles never leave the page, and there is **no import** — the bundled `bangkok_accessible_family_club.json` cannot be loaded back in.

Fix: emit the full `P` diff against `DEF` in an `overrides`/`state` block (round-trippable), keep the 6-lever list as the player-facing subset, and add a "Load archetype JSON" input. That also gives scenario sharing for free.

### 7. No shareable scenario URL

All state lives in `localStorage['padelTycoon3']` (2.2 KB); the URL never changes. A configured scenario cannot be sent to anyone, and two scenarios cannot be compared side by side.

Fix: encode the diff-from-defaults into the hash (`#s=<base64>`), read it on load, add a "Copy link to this scenario" button. Cheap, and the highest-leverage feature for a tool meant to persuade investors or partners.

### 8. 9 of 12 lever groups are collapsed, with no signposting

89 range inputs exist; only the first three groups are open. Nothing indicates where a lever lives, and there is no search. Finding "Contingency on site works" means opening five `<details>` in turn.

Fix: a filter box above the rail that matches lever labels and auto-expands matching groups, plus a count badge per group. Optionally sticky group headers.

---

## P3 — polish

9. **No print stylesheet** (`@media print` rules: 0). A model like this gets printed or PDF'd for a deck; today it prints as a long dark-blue page. Add print rules: white background, expanded details, hidden rail, tables unscrolled.
10. **No meta description, favicon, or Open Graph tags.** Links shared into Slack/Lark/WeChat show a bare URL. Add description + `og:title`/`og:description`/`og:image` and an inline SVG favicon (data URI keeps the single-file property).
11. **Wide tables on mobile.** No page overflow, but the city table is 1,365 px inside a 338 px scroll container (4×). It works, yet there is no affordance showing it scrolls. Add an edge-fade/shadow and a "swipe →" hint; consider pinning the first column.
12. **Slider hit area 28 px** on mobile — under the 44 px guideline. Increase thumb/track padding at narrow widths.
13. **Fonts are remote.** Blocking `fonts.googleapis.com` degrades gracefully to `system-ui` with zero errors, so this is cosmetic only — but in Shenzhen without a proxy the intended Archivo typography never loads. Inline a woff2 subset as a data URI, or accept the fallback deliberately.
14. **Dead branch in `fmtLv`:** `u==='f%1'` is tested twice; the second is unreachable. Harmless, worth deleting.
15. **One heading-level jump** in the document outline (h1 → h3 without an intervening h2 in the hero region). Minor a11y nit.

---

## Suggested order

1. Calibration idempotency (#1) — it changes the numbers the tool exists to produce.
2. City-switch data loss (#2) and clamped-label sync (#4) — small, contained fixes.
3. Perf coalescing (#5.1) — one wrapper around `run()`, immediate feel improvement.
4. Scenario URL + full-fidelity export/import (#6, #7) — one shared serialisation helper serves both.
5. Print + meta/OG (#9, #10) — makes it presentable outside the browser.
