# What to improve next

Open work, ordered by what it is worth. Everything here is **not done**. Measured against the working tree on
25 Nov 2026 unless stated. Items 1–8 of `AUDIT.md` (P1 correctness, P2 fidelity) are fixed and verified;
this file supersedes the old P3 list and adds what the non-rental work exposed.

## A. Correctness and trust — do these first

### A1. There are no tests in the repo
`tests/` does not exist. Every verification so far — the 30-combo city/roof sweep, the preset sweep, the
scenario round-trip, the drag timing — ran from throwaway scripts in `/tmp` that were deleted. The next person
to touch `engine.js` has no safety net, and the numbers in `AUDIT.md` cannot be re-checked.

**Fix:** commit a `tests/` directory with the Playwright scripts and a Node engine-level test. The engine is
requireable (`require('./locations.js')`), so most assertions need no browser: finite outputs across
10 cities × 3 roofs, module toggles, calibration idempotency, custody on/off, round-trip of `pDiff`.
Add `npm test`-free runner (`python3 tests/run.py` or `node tests/engine.test.js`) to keep the no-npm property.

Traps to encode in the tests, learned the hard way:
- `P`, `R`, `PRESETS`, `MODS` are top-level lexicals and **not reachable from `page.evaluate`**. Drive the DOM.
- `document.body.textContent` **includes the inline `<script>` source**, so a naive NaN/undefined scan always
  reports false positives. Filter out `SCRIPT`/`STYLE` nodes.
- `inner_text()` returns `''` inside a closed `<details>` — use `textContent`.
- Controls sit behind two accordion layers: open `#cat-<id>`, then `el.closest('details.sub').open = true`.
- The export's `overrides` is `{v, cur, p}` — the levers are one level down in `.p`.
- The import box is `#imp`, not `#json` (that is the export).

### A2. The bundled preset JSON has drifted from the export format
`bangkok_accessible_family_club.json` has 15 keys and **no `overrides` block**; the page now exports 16 keys
with `overrides.p` carrying ~45 levers. The shipped example cannot round-trip through the import box, and it
predates every non-rental lever.

**Fix:** regenerate it from the current export, and add a test that loads the bundled file and asserts the
headline figures match a fresh run of the same preset.

### A3. Three of the eight launch checks are assumptions, not outputs
`Members paying yearly`, `Credit never used` and `Sponsor renewals` echo the lever the user set. They are
labelled "assumption" on the card, which is honest, but they cannot fail for an interesting reason.

**Fix:** model sponsor renewal as an outcome (brand, hours delivered on the named court, report quality)
rather than a constant; model breakage as a function of credit validity and visit frequency. Both are
genuinely modelable and both are in the plan's KPI table.

### A4. Non-court spend per visit misses its target by 60%
Bangkok: $1.46 against ฿120 ($3.64). This is the plan's own check and the club fails it hardest. Either the
default `cafeSpend` / `retailSpend` / `racketTake` are too conservative, or the ฿120 target assumes an own-run
café the model says is unprofitable.

**Fix:** reconcile against the plan's assumptions and pick one — raise the spend defaults, or footnote the
target as achievable only with own-run hospitality. Do not leave a headline check permanently red without
explaining why.

## B. Fidelity — the model could be more honest

### B1. Volume streams do not scale by city
Parties, team days, PE contracts, company wallets and gift cards take a count and a price the user sets, so
they return identical dollars in Bangkok, Shenzhen and KL. Only their *price* should be city-neutral; the
number a club can actually sell should follow market size and office intensity.

**Fix:** scale achievable counts by `market`, `office` and `addonIdx`, with the lever as a ceiling rather
than a fixed count.

### B2. Compliance rules are described, not enforced
The Shenzhen ¥5,000 / 12-month cap, the 7-day refund window and 12-month credit expiry appear in the section
note but nothing checks them. A user can set a founding price of ¥6,400 and the model will not blink.

**Fix:** a compliance panel that flags any prepaid product over the local cap or term, driven by the city.
Cheap, and it turns the plan's legal warning into something the tool actually catches.

### B3. Wallet top-up tiers are collapsed
The plan specifies +5% / +10% / +12% at three top-up sizes; the model has one `walletBonus`. The mix matters
because the large tier is the one that bumps the Shenzhen cap.

### B4. Rollout sequencing is not modelled
Every stream runs from month 1. The plan stages them over 12 months, and the staging changes year-1 cash and
break-even. A `startMonth` per module would make the plan's rollout table a real scenario.

### B5. Curriculum licensing and cross-site sponsorship are absent
The plan lists both as year-2 upside. The network planner exists (`runNetwork`) but does not price a
city-wide naming deal across sites, which the plan calls "the deal a bank or developer actually wants".

## C. Presentation — measured, still open

| # | Gap | Measured now |
| --- | --- | --- |
| C1 | No print stylesheet | `@media print` rules: **0**. Prints as a long dark-blue page. |
| C2 | No meta description, OG tags or favicon | all **0**. Links into Slack/Lark/WeChat show a bare URL. |
| C3 | Small tap targets | ~57 controls under 44 px; slider hit area 28 px on mobile. |
| C4 | Accordion open state is not remembered | reload collapses everything back to the default two. |
| C5 | Closed panels still render their charts | SVGs in closed panels draw at full width — wasted work, not a visible bug. |
| C6 | Wide tables have no scroll affordance | city table ~1,365 px inside a 338 px container on mobile; no edge fade or hint. |
| C7 | Fonts are remote | 2 remote refs. Blocking them degrades cleanly to `system-ui`, but in Shenzhen without a proxy the intended typography never loads. Inline a woff2 subset. |
| C8 | Sticky stack height on mobile | ~97 px of sticky chrome before content. |
| C9 | Scenario hash only written on button click | editing levers leaves the URL stale; `#s=` is not live. |

C1 and C2 are the highest value per line of code: this tool gets pasted into decks and chats.

## D. Nice to have

- **D1.** A "compare two scenarios side by side" view. The serialisation already supports it; only the UI is
  missing. Highest-leverage feature for persuading a partner.
- **D2.** Per-stream sparklines in the non-rental table, so seasonality (camps, Songkran, typhoon months) is
  visible without opening the chart.
- **D3.** Export the non-rental table as CSV for a spreadsheet.
- **D4.** A one-page PDF summary built from the print stylesheet (depends on C1).
- **D5.** Sensitivity tornado on the eight launch checks — which lever moves each check most.

## Suggested order

1. **A1 tests** — everything else is riskier without them.
2. **A2 preset JSON** + **C1/C2 print and meta** — small, contained, immediately visible.
3. **A4 / A3** — make the scorecard's red cards either go green or explain themselves.
4. **B1 / B2** — city-scaled volumes and the compliance panel.
5. **C3 / C4** — mobile ergonomics.
6. **D1** — side-by-side scenarios.