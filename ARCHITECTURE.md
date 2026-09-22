# Architecture

## What I built with, and why

A fully static site: a one-time Python preprocessing script (pandas +
pyarrow to read parquet, Pillow to compress minimaps) converts the 1,243
source parquet files into compact static JSON, and a Vite + React +
TypeScript frontend renders it on `<canvas>` layered over the minimap
`<img>`. No backend, no database.

I rejected two alternatives:
- **Streamlit**: faster to prototype, but its full-script-rerun model on
  every interaction makes smooth timeline scrubbing/animation awkward,
  and it reads as a data-science notebook rather than a tool a Level
  Designer would want to live in.
- **A backend API + database**: the full dataset is 34MB / ~89K rows —
  small enough to precompute once and serve as static files. A database
  would add hosting cost and operational complexity with no query the
  frontend actually needs to run dynamically.

## Data flow

```
parquet files (1,243, one per player per match)
  -> scripts/preprocess.py
       lib/parse.py     decode event bytes, derive is_bot from user_id shape, cast ts
       lib/aggregate.py build matches_index.json, per-match bundles, overview events
       lib/heatmap.py   bin events into 100x100 grids per map/category
       lib/images.py    compress minimaps to web-friendly JPEGs
  -> web/public/data/*.json + web/public/minimaps/*.jpg  (static assets, committed)
  -> React fetches these at runtime (no server-side logic)
  -> <canvas> renders paths, markers, heatmaps over the minimap <img>
```

Two data granularities feed the frontend: `matches_index.json` (one row
per match — powers filter dropdowns cheaply) and per-match JSON bundles
(full event timeline — fetched lazily only when a match is opened for
playback), plus precomputed per-map heatmap grids and per-map "overview
event" scatter data (all discrete events, for browsing without opening a
match).

## Coordinate mapping

This is the detail the assignment calls out as the trickiest part, so
here's the exact path from world coordinates to a pixel on screen.

The source data's README specifies each map's coordinate system as a
scale + origin pair, and a formula to convert world `(x, z)` into a UV
coordinate (0–1) and then a pixel on the 1024×1024 minimap:

```
u = (x - originX) / scale
v = (z - originZ) / scale
pixelX = u * 1024
pixelY = (1 - v) * 1024   // Y flipped: image origin is top-left
```

| Map | scale | originX | originZ |
|---|---|---|---|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

I implemented this once, in both places it's needed (`scripts/lib/heatmap.py`'s
`world_to_uv` for the Python-side heatmap binning, and `web/src/lib/coords.ts`'s
`worldToPixel` for the frontend), and unit-tested both against the source
README's own worked example (world `(-301.45, -355.55)` on AmbroseValley →
pixel `(78, 890)`) rather than trusting the formula by inspection. The `y`
column (elevation) is dropped entirely — the source README states it's not
part of the 2D minimap coordinate system.

I verified this end-to-end by loading the app in a real browser and
confirming that event clusters on GrandRift's minimap fell inside that
map's own labeled zones (e.g. "Engineer's Quarters", "Labour Quarters") —
not just that the math checked out in isolation.

## Assumptions

- **Heatmaps aggregate across all 5 days per map and are not
  date-filterable.** The assignment requires map/date/match filtering for
  paths and playback, but doesn't require the heatmap itself to be
  date-sliced — precomputing per-day grids (3 maps × 5 categories × 5
  days) for a feature that isn't asked to be date-scoped wasn't worth the
  added pipeline complexity.
- **Raw parquet data is not committed to this repo.** It's 34MB of
  production telemetry; only the derived static JSON needed to run the
  site is committed. `scripts/preprocess.py --input <path>` regenerates
  it from the original `player_data.zip`.
- **Bot vs. human is determined purely by `user_id` shape** (valid UUID =
  human, bare numeric string = bot), per the source data's own documented
  convention — there's no separate boolean column in the schema.
- **`y` (elevation) is unused** for all 2D plotting and heatmap binning,
  per the source README's explicit note.

## Major tradeoffs

| Decision | Alternative considered | Why this won |
|---|---|---|
| Static site, no backend | Backend API + database | Dataset (34MB/89K rows) is small enough to precompute once; a DB adds cost with no dynamic query the app needs |
| Precomputed heatmap grids (Python) | Client-side aggregation from raw events | Keeps the browser from re-binning ~75K position rows on every heatmap toggle; grids are tiny (100×100 ints) |
| Per-match JSON, lazy-loaded | One giant bundle with all 796 matches' events | Avoids shipping ~14MB of event data upfront; a Level Designer only ever looks at one match at a time |
| Plain Canvas rendering | A mapping/charting library (deck.gl, Leaflet) | The "map" is a static image with simple point/line overlays — a library's abstraction (tiling, projections) solves problems this tool doesn't have |
