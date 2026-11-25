#!/usr/bin/env python3
"""Browser tests for the built page. Requires Playwright + headless Chromium.

    python3 tests/browser_test.py              # against the live site
    python3 tests/browser_test.py --local      # against localhost:8899 (run build.py + http.server first)
    python3 tests/browser_test.py --url URL

---------------------------------------------------------------------------------------------
TRAPS ON THIS PAGE — every one of these cost a false result before it was understood.
Keep them in mind before "fixing" a failure that looks like a product bug.

1. `P`, `R`, `PRESETS`, `MODS`, `CATS` are top-level `let`/`const` lexicals. They are NOT
   reachable from page.evaluate(). Function declarations (`sim`, `run`, `scenarioURL`) ARE.
   Drive state through the DOM: sliders (`#lv_<id>` + an `input` event), preset buttons,
   city/roof buttons, catalogue buttons.

2. `document.body.textContent` INCLUDES the inline <script> source, which contains the
   literal strings "NaN", "Infinity" and "undefined". A naive scan always reports false
   positives. Always filter out SCRIPT/STYLE nodes — see visible_text() below.

3. `inner_text()` returns '' for anything inside a closed <details>. Use textContent,
   or you will invent a bug that does not exist.

4. Controls sit behind TWO accordion layers. Open `#cat-<id>` (category), then
   `el.closest('details.sub').open = True` (topic), before clicking. Pre-redesign tests
   time out with "element is not visible" otherwise.

5. The export textarea is `#json`; the IMPORT textarea is `#imp`. Setting the wrong one
   silently imports nothing.

6. Exported `overrides` is `{v, cur, p}` — the changed levers live one level down in `.p`.

7. `input#month` is min 1 max 36. Playwright fill() above 36 throws "Malformed value".

8. Charts measure their container, so a closed panel renders at width 0. Open the panel
   before asserting anything about a chart.
---------------------------------------------------------------------------------------------
"""
import argparse
import asyncio
import json
import sys

from playwright.async_api import async_playwright

LIVE = "https://calchulus.github.io/padel-club/"
LOCAL = "http://localhost:8899/padel-club-tycoon.html"

NEW_MODULES = [
    "Racket hire", "Pro shop", "Café & drinks", "Run the café ourselves",
    "Full sponsor rate card", "Off-peak unlimited pass", "Starter pass",
    "Birthday parties", "Company team days", "Highlight clips", "School PE contracts",
    "Hotel & visitor packs", "Class packs", "Company wallets", "Gift cards",
    "Family wallets", "Referral credit", "District sports vouchers",
]
TOGGLE_KEYS = [
    "racketOn", "retailOn", "cafeOn", "cafeOwn", "sponsorCardOn", "passOn",
    "starterPassOn", "partyOn", "teamOn", "clipsOn", "peOn", "packsOn",
    "classPackOn", "familyWalletOn", "bizWalletOn", "giftOn", "referralOn", "voucherOn",
]

passed = 0
failed = []


def ok(name, cond, detail=""):
    global passed
    if cond:
        passed += 1
    else:
        failed.append(f"{name} — {detail}" if detail else name)


class Page:
    def __init__(self, pg):
        self.pg = pg

    async def visible_text(self):
        # Trap 2: exclude SCRIPT/STYLE or the engine source trips the NaN scan.
        return await self.pg.evaluate(
            "[...document.body.childNodes]"
            ".filter(n=>n.nodeName!=='SCRIPT'&&n.nodeName!=='STYLE')"
            ".map(n=>n.textContent||'').join(' ')"
        )

    async def bad_tokens(self):
        t = await self.visible_text()
        return [w for w in ("NaN", "Infinity", "undefined") if w in t]

    async def text(self, sel):
        # Trap 3: textContent, not inner_text.
        return (await self.pg.evaluate(
            f"(document.querySelector('{sel}')||{{}}).textContent||''")).strip()

    async def open_cat(self, cid):
        await self.pg.evaluate(f"document.getElementById('cat-{cid}').open=true")
        await self.pg.wait_for_timeout(140)

    async def open_sub(self, sel):
        # Trap 4: both layers.
        await self.pg.evaluate(
            f"()=>{{const e=document.querySelector('{sel}');"
            "const d=e.closest('details.sub'); if(d) d.open=true;}")
        await self.pg.wait_for_timeout(140)

    async def set_lever(self, lid, val):
        await self.pg.evaluate(
            f"()=>{{const e=document.getElementById('lv_{lid}');"
            f"e.value={json.dumps(str(val))};"
            "e.dispatchEvent(new Event('input',{bubbles:true}));}")
        await self.pg.wait_for_timeout(280)

    async def preset(self, name):
        await self.pg.evaluate(
            f"document.querySelector('#presets button[data-p={json.dumps(name)}]').click()")
        await self.pg.wait_for_timeout(420)

    async def city(self, cid):
        await self.pg.evaluate(
            f"document.querySelector('[data-c={json.dumps(cid)}]').click()")
        await self.pg.wait_for_timeout(320)


async def run(url):
    async with async_playwright() as pw:
        browser = await pw.chromium.launch()
        pg = await browser.new_page(viewport={"width": 1440, "height": 1000})
        errors = []
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text)
              if m.type == "error" and "ERR_FAILED" not in m.text else None)

        # Block remote fonts: proves the page degrades cleanly, and removes a network flake.
        async def kill(route):
            await route.abort()
        await pg.route("**fonts.googleapis.com**", kill)
        await pg.route("**fonts.gstatic.com**", kill)

        await pg.goto(url, wait_until="load")
        await pg.wait_for_timeout(800)
        p = Page(pg)
        for cid in ("revenue", "actions", "model", "capital"):
            await p.open_cat(cid)

        print(f"\nTarget: {url}")

        print("\n1. Preset sweep")
        names = await pg.evaluate("[...document.querySelectorAll('#presets button')].map(b=>b.dataset.p)")
        ok("9 presets", len(names) == 9, str(len(names)))
        ok("plan preset present", "Non-rental income plan" in names)
        for name in names:
            await p.preset(name)
            bad = await p.bad_tokens()
            cards = await pg.evaluate("document.querySelectorAll('#nrKpis .kpi').length")
            ok(f"preset {name} clean", not bad, str(bad))
            ok(f"preset {name} has 8 checks", cards == 8, str(cards))

        print("\n2. City x roof sweep, full plan")
        await p.preset("Non-rental income plan")
        cities = await pg.evaluate("[...document.querySelectorAll('#cities button')].map(b=>b.dataset.c)")
        roofs = await pg.evaluate("[...document.querySelectorAll('#roofs button')].map(b=>b.dataset.r)")
        for c in cities:
            await p.city(c)
            for r in roofs:
                await pg.evaluate(f"document.querySelector('[data-r={json.dumps(r)}]').click()")
                await pg.wait_for_timeout(220)
                bad = await p.bad_tokens()
                ok(f"{c}/{r} clean", not bad, str(bad))
        print(f"  {len(cities)} cities x {len(roofs)} roofs")
        await p.city("bangkok")

        print("\n3. Non-rental section content")
        await p.preset("Non-rental income plan")
        lede = await p.text("#nrLede")
        ok("lede reports measured delta", "EBITDA" in lede and "$" in lede, lede[:80])
        rows = await pg.evaluate(
            "[...document.querySelectorAll('#nrTable tr')].map(r=>r.children[0].textContent)")
        ok("table has the measured delta row",
           any("Measured Δ EBITDA" in r for r in rows), str(rows[-3:]))
        ok("table has team days", any("Company team days" in r for r in rows))
        ok("table has starter pass", any("Starter pass" in r for r in rows))
        kpi_txt = await p.text("#nrKpis")
        ok("checks label assumptions", "assumption" in kpi_txt)
        ok("breakage check shows a band", "3%" in kpi_txt and "8%" in kpi_txt)
        ok("spend target shown in local money", "฿120" in kpi_txt, kpi_txt[:120])

        print("\n4. Optimizations catalogue")
        await p.open_cat("actions")
        await pg.wait_for_timeout(400)
        cards = await pg.evaluate(
            "[...document.querySelectorAll('#optList details.opt')].map(d=>d.querySelector('.on-l').textContent)")
        ok("41 modules", len(cards) == 41, str(len(cards)))
        missing = [m for m in NEW_MODULES if m not in cards]
        ok("all new modules present", not missing, str(missing))
        groups = await pg.evaluate(
            "[...document.querySelectorAll('#optList .optgrp h3')].map(h=>h.textContent)")
        ok("Shop & hospitality group exists",
           any("Shop & hospitality" in g for g in groups), str(groups))

        print("\n5. Lever search finds the new concepts")
        for q, expect_min in (("custody", 1), ("gift", 1), ("cafe", 3),
                              ("rate card", 1), ("nonrental", 5), ("voucher", 1)):
            await pg.evaluate(
                f"()=>{{const i=document.getElementById('lvfind');i.value={json.dumps(q)};"
                "i.dispatchEvent(new Event('input',{bubbles:true}));}")
            await pg.wait_for_timeout(160)
            cnt = await p.text("#lvcount")
            n = int("".join(ch for ch in cnt.split(" ")[0] if ch.isdigit()) or 0)
            ok(f"search {q!r} finds >= {expect_min}", n >= expect_min, cnt)
        await pg.evaluate(
            "()=>{const i=document.getElementById('lvfind');i.value='';"
            "i.dispatchEvent(new Event('input',{bubbles:true}));}")

        print("\n6. Prepaid custody, surfaced in the UI")
        await p.city("shenzhen")
        note = await p.text("#nrNote")
        ok("Shenzhen note says ring-fenced", "ring-fenced" in note, note[:100])
        ok("Shenzhen note states the extra owner cash", "extra owner cash" in note)
        ok("Shenzhen note mentions the ¥5,000 cap", "5,000" in note)
        locked = await p.text("#sum-capital")
        await p.set_lever("custody", 0)
        free = await p.text("#sum-capital")
        ok("free float changes the capital digest", locked != free, f"{locked} | {free}")
        ok("free-float note says spendable", "spendable" in await p.text("#nrNote"))
        await p.set_lever("custody", -1)
        await p.city("bangkok")

        print("\n7. Public money never cheapens the build")
        before = await p.text("#sum-capital")
        await p.set_lever("govRentSub", 40)
        after = await p.text("#sum-capital")
        ok("operating support leaves 'Upfront' unchanged",
           before.split("Owner")[0] == after.split("Owner")[0], f"{before} | {after}")
        ok("note states no grant pays for the build",
           "No grant" in await p.text("#nrNote"))
        await p.set_lever("govRentSub", 0)

        print("\n8. Module toggles through the catalogue")
        for k in TOGGLE_KEYS:
            state = await pg.evaluate(
                f"()=>{{const b=document.querySelector('#optList button[data-opt=\"{k}\"]');"
                "if(!b)return null;b.click();return b.textContent;}")
            await pg.wait_for_timeout(190)
            ok(f"toggle button {k} exists", state is not None)
            bad = await p.bad_tokens()
            ok(f"toggle {k} clean", not bad, str(bad))

        print("\n9. Scenario round-trip (export -> import in a fresh browser)")
        await p.preset("Non-rental income plan")
        await p.set_lever("passPrice", 95)
        await p.set_lever("custody", 1)
        await p.set_lever("govRentSub", 30)
        snap = ("({pp:document.getElementById('o_passPrice').textContent,"
                "cu:document.getElementById('o_custody').textContent,"
                "gg:document.getElementById('o_govRentSub').textContent,"
                "find:document.getElementById('finding').textContent,"
                "nr:document.getElementById('nrLede').textContent})")
        before = await pg.evaluate(snap)
        exported = await pg.evaluate("document.getElementById('json').value")  # Trap 5
        j = json.loads(exported)
        ov = j.get("overrides", {}).get("p", {})  # Trap 6
        ok("export carries an overrides.p block", isinstance(ov, dict) and len(ov) > 20, str(len(ov)))
        carried = [k for k in ("passPrice", "custody", "govRentSub", "starterPassOn", "teamOn", "peOn")
                   if k in ov]
        ok("new levers are serialised", len(carried) == 6, str(carried))

        pg2 = await browser.new_page(viewport={"width": 1440, "height": 1000})
        pg2.on("pageerror", lambda e: errors.append("import-page: " + str(e)))
        await pg2.route("**fonts.googleapis.com**", kill)
        await pg2.route("**fonts.gstatic.com**", kill)
        await pg2.goto(url, wait_until="load")
        await pg2.wait_for_timeout(700)
        p2 = Page(pg2)
        await p2.open_cat("model")
        await p2.open_sub("#imp")
        await pg2.evaluate(
            "(txt)=>{document.getElementById('imp').value=txt;"
            "document.getElementById('impGo').click();}", exported)
        await pg2.wait_for_timeout(800)
        after = await pg2.evaluate(snap)
        ok("import restores every figure identically", before == after,
           str({k: (before[k], after[k]) for k in before if before[k] != after[k]}))
        await pg2.close()

        print("\n10. Scenario URL restores in a fresh browser")
        link = await pg.evaluate("scenarioURL()")  # function declaration: reachable
        ok("scenario URL produced", link.startswith("http") and "#s=" in link, str(len(link)))
        pg3 = await browser.new_page()
        pg3.on("pageerror", lambda e: errors.append("url-page: " + str(e)))
        await pg3.route("**fonts.googleapis.com**", kill)
        await pg3.route("**fonts.gstatic.com**", kill)
        await pg3.goto(link, wait_until="load")
        await pg3.wait_for_timeout(900)
        got = await pg3.evaluate(
            "({pp:document.getElementById('o_passPrice').textContent,"
            "cu:document.getElementById('o_custody').textContent,"
            "gg:document.getElementById('o_govRentSub').textContent})")
        ok("URL restores the levers",
           all(got[k] == before[k] for k in got), f"{got} vs {before}")
        await pg3.close()

        print("\n11. Calibration is idempotent (AUDIT P1 #1 regression)")
        await p.preset("Accessible family club")
        await p.open_cat("model")
        await p.open_sub("#calApply")
        await pg.evaluate("document.getElementById('calSample').click()")
        await pg.wait_for_timeout(300)
        scales = []
        for i in range(6):
            await pg.evaluate("document.getElementById('calApply').click()")
            await pg.wait_for_timeout(650)
            scales.append(await p.text("#o_demandScale"))
        ok("repeated fits on identical data do not drift",
           len(set(scales[1:])) == 1, str(scales))
        print(f"  demandScale across 6 identical fits: {scales}")

        print("\n12. Mobile")
        await pg.set_viewport_size({"width": 390, "height": 844})
        await pg.wait_for_timeout(500)
        ov = await pg.evaluate(
            "document.documentElement.scrollWidth-document.documentElement.clientWidth")
        ok("no horizontal overflow at 390px", ov <= 0, str(ov))
        await p.open_cat("revenue")
        await pg.wait_for_timeout(400)
        cols = await pg.evaluate(
            "getComputedStyle(document.getElementById('nrKpis')).gridTemplateColumns")
        ok("scorecard is 2 columns on mobile", len(cols.split()) == 2, cols)

        print("\n13. Drag performance")
        await pg.set_viewport_size({"width": 1440, "height": 1000})
        await pg.wait_for_timeout(400)
        t = await pg.evaluate(
            "async()=>{const e=document.getElementById('lv_racketTake');const t0=performance.now();"
            "for(let v=0;v<=40;v++){e.value=String(v);e.dispatchEvent(new Event('input',{bubbles:true}));}"
            "await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));"
            "return Math.round(performance.now()-t0);}")
        ok("41-step drag under 250ms", t < 250, f"{t}ms")
        print(f"  41-step drag: {t}ms")

        ok("no page errors", not errors, str(errors[:4]))
        await browser.close()

    print("\n" + "=" * 52)
    print(f"{passed} passed, {len(failed)} failed")
    if failed:
        print("\nFailures:")
        for f in failed:
            print("  ✗ " + f)
        sys.exit(1)
    print("browser: all green")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--local", action="store_true", help="test the local build instead of the live site")
    ap.add_argument("--url", help="explicit URL")
    a = ap.parse_args()
    asyncio.run(run(a.url or (LOCAL if a.local else LIVE)))