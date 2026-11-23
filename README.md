# Padel Club archetype

A 3-court padel club simulator (Tycoonify-style), focused on Bangkok (focus 1), Shenzhen (focus 2) and Kuala Lumpur (third), with other cities as expansion profiles.

| File | What it is |
| --- | --- |
| `padel-club-tycoon.html` | Built single-file simulator (open in a browser) |
| `engine.js` | Monthly simulation: hourly demand by weekday/weekend, weather and roof, competition, entry-level track, memberships and prepaid float, build cost and financing. Also: ways to get courts (rent, build, convert, buy, owner-funded), nine conversion site types (`SITETYPES`: pitches, futsal and badminton halls, warehouses, malls, tennis courts, schools, movable courts with teardown and rebuild costs), the guild model (`simGuild`) and the 60-month multi-site planner (`runNetwork`) |
| `locations.js` | City profiles (prices, climate normals, office/visitor traffic, competition) and sample candidate sites |
| `page.html` + `build.py` | Page source; `python3 build.py` inlines `locations.js` and `engine.js` into `padel-club-tycoon.html` |
| `bangkok_accessible_family_club.json` | Archetype export in the Tycoonify preset schema (`schema_version` 1.1.0, type B) with a `location` block |

Model outputs are estimates calibrated toward published benchmarks, not forecasts. Shenzhen prices and the competitor growth rates are assumptions.

## Run locally

```sh
python3 build.py
python3 -m http.server 8899
# open http://localhost:8899/padel-club-tycoon.html
```

The built HTML is self-contained (only Google Fonts is fetched remotely) and is not committed — `build.py` and the Pages workflow both regenerate it from `page.html`, `locations.js` and `engine.js`.

## Deploy

Live at **https://calchulus.github.io/padel-club/**. Every push to `main` runs `.github/workflows/deploy.yml`, which builds with `build.py` and publishes the result as `index.html` via GitHub Pages (source: GitHub Actions). No base-path configuration is needed — the page has no router and no relative asset URLs.
