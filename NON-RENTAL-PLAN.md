# Non-Rental Income Plan — now in the model

Source: `Padel Club Non-Rental Income Plan.pdf` (25 Nov 2026, 12 pages).

The plan's last checklist item was *"Add the new streams to the simulator so these estimates become model outputs."*
That is done. Every stream below is computed from traffic the engine already simulates — `visits`, `sessions`,
`players`, `members`, `K` (academy kids) and `B` (brand) — not from a fixed annual estimate. Switching a stream
off re-runs the 36 months and the difference is measured, not asserted.

Where the plan gave a static estimate, this document shows both: the plan's number and what the model now
produces. They are close, which is the point of the exercise.

## What changed

| | Before | Now |
| --- | --- | --- |
| Revenue streams in the engine | 11 | 16 (5 new grouped streams, 14 itemised in the plan table) |
| Operating modules in the catalogue | 23 | 41 |
| Levers | 133 | 178 |
| Presets | 8 | 9 (`Non-rental income plan`) |
| Plan launch checks scored | 0 | 8 |

New page section: **Revenue & customers → Non-rental income plan** — the eight launch checks, a per-stream
year-1/2/3 table, and the measured Δ EBITDA against every stream switched off.

## Defaults

Per the decision taken when this was built: the cheap, low-capex streams default **on**
(racket hire, pro shop, café concession, sponsor rate card); everything with real setup, staffing or
cannibalisation risk defaults **off** (off-peak pass, starter pass, own-run café, parties, team days, clips,
school PE, packs, prepaid products). `Bare rental` switches all of them off, so it still means rentals only.
The `Non-rental income plan` preset turns the whole playbook on.

## The streams

Prices are USD levers at the Bangkok reference. **Take-up** scales by a per-city add-on index
(`addonIdx`: Bangkok 1.00, Shenzhen 0.90, Kuala Lumpur 0.80) — the plan's "Shenzhen ~10% below Bangkok,
KL ~20% below". Year-3 figures below are the `Non-rental income plan` preset, 3 covered courts.

| Stream | Levers | How the model computes it | Plan estimate (BKK) | Model Y3 BKK / SZ / KL |
| --- | --- | --- | --- | --- |
| Sponsor rate card | `sponsorCardOn`, `sponsorCardValue`, `sponsorTaxBreak`, `sponsorRenew` | `value × addonIdx × (0.6 + B/100) / 12`, only once brand ≥ 30 signs the first deal; deals renew annually at `sponsorRenew` | ~$26K extra | $29.5K / $26.4K / $23.8K |
| Company team days | `teamOn`, `teamDays`, `teamPrice`, `teamCost` | `days × price`; 2 court-hours each booked into weekend off-peak; delivery cost as a share | ~$15K profit | $21.6K gross, all cities |
| Racket hire | `racketOn`, `racketPrice`, `racketTake` | `visits × take% × price × addonIdx`; 25% of income is racket wear | ~$16K | $21.1K / $17.0K / $14.9K |
| Off-peak unlimited pass | `passOn`, `passPrice`, `passShare`, `passHrs`, `passCannibal` | `members × share% × price`, **less** displaced paid off-peak (see below) | ~$13K extra | $40.1K gross less $15K displaced |
| Starter pass | `starterPassOn`, `starterPassPrice`, `starterPassShare` | `casual players × share% × price`; 4 coached sessions a month consume real coach hours and daytime courts | ฿990/mo tier | $30.5K / $30.4K / $27.7K |
| Pro shop / retail | `retailOn`, `retailSpend`, `retailMargin` | `visits × spend × addonIdx`, cost = `(1 − margin)` | ~$13K profit | $46.9K gross → ~$16K margin |
| Birthday parties | `partyOn`, `parties`, `partyPrice`, `partyCost` | `parties × price`; 12 guests each added to visits and audience | ~$12K profit | $18.7K gross → ~$13K |
| Café | `cafeOn`, `cafeOwn`, `cafeSpend`, `cafeConcession`, `cafeOwnMargin` | concession: `visits × spend × 12%`, no cost. Own-run: full takings, `(1 − margin)` cost **plus staff** | ~$9K | $11.3K concession |
| Replay clips | `clipsOn`, `clipPrice`, `clipTake` | `sessions × take% × price × addonIdx`, requires replay cameras | ~$6K | $6.6K / $4.9K / $4.4K |
| School PE contracts | `peOn`, `peSchools`, `peHours`, `peHourly` | `schools × hours × 4.33 × rate`; **booked into the weekday 09:00–14:00 grid**, so it displaces casual off-peak; coach cost applied | ~$4K | $14.0K gross, less coaching |
| Hotel & visitor packs | `packsOn`, `packs`, `packPrice` | `packs × price × (0.3 + tourist × 2) × addonIdx` — worth far more in Bangkok than Shenzhen | ~$4K combined | $4.6K / $2.1K / $2.3K |
| Class packs | `classPackOn`, `classPackDisc` | coaching hours × 1.12, lesson revenue × (1 − discount) | included above | margin trade for volume |
| Company wallets | `bizWalletOn`, `bizWallets`, `bizWalletValue` | recognised `wallets × value / 12`; half the annual credit held as float | — | $9.0K + $4.5K float |
| Gift cards | `giftOn`, `gifts`, `giftValue` | 85% recognised on sale, 30% of a month's sales held as float, breakage on the balance | — | $12.2K + float |
| Family wallets | `familyWalletOn`, `familyTopup`, `familyShare` | no new income — shifts cash timing, adds breakage, cuts member churn 0.3pp | — | float only |
| Referral credit | `referralOn`, `referralCredit` | acquisition × 1.08; credit to **both** sides costed against the prior month's new players | — | acquisition |
| District sports vouchers | `voucherOn`, `voucherValue` | `starters × voucher` (the state pays the first-visit discount), acquisition × 1.05 | — | Shenzhen upside |

### Two behaviours worth knowing

**Off-peak pass cannibalisation is fill-aware.** A pass holder only costs you money if they would otherwise
have paid. The model uses `cannibalisation = base% + off-peak fill × 0.3`, capped at 1. At 70% off-peak fill
almost every pass holder displaces a paying booking; at 20% fill most are incremental. This is why the plan's
"~$13K extra" and the model's gross $40K are not in conflict — the model shows the $15K you give away.

**Own-run café loses to a concession at this footfall.** Bangkok, year 3: concession **$544,794** EBITDA vs
own-run **$528,150** — own-run is **$16,643 worse**. $89K of takings at a 22% margin does not cover the staff.
The plan says "start with a concession"; the model now agrees, and shows the crossover if you raise
`cafeSpend` or `cafeOwnMargin`.

## Measured result

`Non-rental income plan` preset vs the same club with every new stream off:

| | Bangkok | Shenzhen | Kuala Lumpur |
| --- | --- | --- | --- |
| Year-3 revenue | $1.18M | $1.03M | $0.99M |
| Year-3 EBITDA | $545K | $393K | $429K |
| **Δ EBITDA from the plan** | **+$125K** | **+$117K** | **+$120K** |
| Plan's own estimate | ~$120K | ~$110K | ~$100K |
| Non-rental fit-out capex | $7.2K | $10.3K | $6.7K |
| Customer float at month 12 | $78K | $72K | $71K |
| Peak customer float | $151K | $151K | $145K |
| Launch checks met | 5 / 8 | 5 / 8 | 5 / 8 |

Δ EBITDA is a full re-run, so it carries goods, café staff, party and team-day delivery, PE and starter-pass
coaching, and the variable and overhead costs that follow the extra revenue. The two memo rows in the page's
table (displacement, goods) are **not** the whole cost — the measured row is.

## Prepaid money and the law

`custody` is a three-state lever: **auto** (default), **free to spend**, **ring-fenced**.
Auto resolves from the city: Shenzhen is ring-fenced, Bangkok and KL are not.

When ring-fenced, customer float is still reported as a liability but is excluded from cash flow and from the
opening balance — it cannot fund the build or the running costs. Measured in Shenzhen: the lowest cash balance
falls from **$65K to $22K**, i.e. **$43K more owner cash**. The plan estimates ~$100K; the difference is that
the plan compares against total upfront need while the model reports the cash trough, and the model's
presale is smaller. Both point the same way: **plan Shenzhen's build without customer money.**

The page also states the Shenzhen draft cap (¥5,000 and 12 months per prepayment) and that custody exempts
you from it — which is why custody is the default there, not a penalty.

Not modelled, and deliberately so: the 7-day refund window, the ¥5,000 per-payment cap enforcement, and
12-month credit expiry. These are compliance checks, not economics; they are in `IMPROVEMENTS.md`.

## Public money

The plan is explicit: *"We found no grant in any of the three cities that pays to build a private padel club…
none of it pays for the build."* The model respects that — **no lever reduces capex.** Public support is
modelled only where the plan found it:

- `govRentSub` — district venue funds (e.g. Longgang) that back *operating* venues, register-first,
  fund-afterwards. Applied to running cost for the first 24 months only.
- `voucherOn` / `voucherValue` — Nanshan / Pingshan consumer sports vouchers; the state pays the first-visit
  discount, so it buys trial without cutting your price.
- `sponsorTaxBreak` — Thai double deduction through 2027 for donations via the national association;
  modelled as an uplift on what the rate card can charge, not as income to the club.
- `sportsRelief` — Malaysia's RM1,000 personal relief on sports fees; modelled as an uplift on coaching demand.

## The eight launch checks

From the plan's "Checks before launch" table. Each card is marked **assumption** where the value is an input
the plan sets rather than a simulated output — those are things to verify in the real world, not results.

| Check | Target | Source | Bangkok now |
| --- | --- | --- | --- |
| Non-rental share of revenue | ≥ 55% | model | 70% ✅ |
| Members as a share of regular players | ≥ 30% | model | 27% — short 3pp |
| Members paying yearly | ≥ 40% | assumption | 40% ✅ |
| Court revenue paid from wallets | ≥ 30% | model | 42% ✅ |
| Customers' money held, month 12 | ≥ $80K | model | $78.2K — short $1.8K |
| Non-court spend per visit | ฿120 / ¥25 / RM15 | model | $1.46 vs $3.64 — short $2.18 |
| Credit never used | 3–8% band | assumption | 5% ✅ |
| Sponsor renewals | ≥ 80% | assumption | 80% ✅ |

The spend-per-visit target is city-specific and stored per city (`spendTarget` in `locations.js`), converted
at the city's FX rate — ฿120 is $3.64, not a flat dollar figure.

**The honest gap:** non-court spend per visit is the check the club fails hardest, at 40% of target. The
plan's ฿120 assumes a café spend the model's concession default does not reach. Raising `cafeSpend`,
`retailSpend` or `racketTake` closes it; that is the first thing to test.

## Rollout

The plan's sequencing is not enforced by the model (every stream runs from month 1). To reproduce it, use the
catalogue's "not switched on yet" filter and switch modules on in this order:

1. **Before opening** — founding presale, gift cards, guild sign-ups, first sponsor talks.
2. **Months 1–3** — starter pass, Family, yearly plans, wallets, class packs, racket hire, café concession, retail.
3. **Months 4–6** — full sponsor card, company wallets, team days, birthday parties.
4. **Months 6–12** — off-peak unlimited (once off-peak demand is measured), clips, school PE, visitor packs.
5. **Year 2** — city-wide sponsorship across sites; license the curriculum.

## Caveats

- The model already runs above published revenue per court. Treat these as a **ranking of what to try first**,
  not a forecast — the plan says the same.
- Parties, team days, PE contracts, company wallets and gift cards are **operational choices**, so their
  volume is a lever you set, not a demand output. They do not scale by city automatically; set the price and
  count per city.
- Wallet top-up tiers (+5% / +10% / +12%) are collapsed into the single existing `walletBonus` lever.
- Curriculum licensing and the guild are out of scope here; the guild has its own model (`simGuild`).