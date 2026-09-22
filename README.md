# LILA BLACK — Player Journey Visualization Tool

A web tool for LILA Games' Level Design team to explore player behavior in
**LILA BLACK** (an extraction shooter): where players move, where fights
break out, where people die to the storm, and which areas of the map get
ignored — across 5 days of production telemetry and 3 maps.

**Live deployment:** https://lila-player-journey-viz.vercel.app

## What you're looking at

- **Overview mode** (default): pick a map and optionally a date. Shows a
  heatmap (kills / deaths / storm deaths / loot / traffic) plus every
  kill/death/storm-death/loot event scattered on the minimap for that
  scope.
- **Match Playback mode**: pick a specific match from the dropdown. Shows
  that match's players moving on the minimap in real time — humans as
  solid blue dots with a trail, bots as hollow grey dots — with kill,
  death, storm-death, and loot markers appearing at the moment they
  occurred. Use the timeline bar at the bottom to play, pause, change
  speed, or scrub to any point in the match.
- The left panel filters by map, date, match, human/bot, event type, and
  (in Overview mode) heatmap category.

## Tech stack

- **Preprocessing**: Python 3.14, pandas, pyarrow (parquet reading),
  Pillow (minimap compression), pytest.
- **Frontend**: Vite + React 19 + TypeScript, plain HTML5 Canvas for
  rendering (no charting/mapping library — the map is a static image with
  a canvas overlay), Vitest for unit tests.
- **Hosting**: fully static site (no backend, no database, no env vars).
  Deployed to Vercel.

## Repo layout

```
scripts/            Python preprocessing pipeline
  lib/               parse.py, aggregate.py, heatmap.py, images.py
  tests/             pytest unit tests + fixtures
  preprocess.py      CLI entrypoint — run once to (re)generate web/public/data
  analyze_insights.py  ad-hoc analysis script behind INSIGHTS.md
web/                 Vite + React + TypeScript app
  public/data/        matches_index.json, per-match bundles, heatmaps, overview events
  public/minimaps/    compressed minimap images
  src/lib/            coordinate mapping, data client, filtering, playback logic
  src/hooks/          React hooks wrapping the data client
  src/components/     FilterPanel, MapCanvas, Timeline, Legend
ARCHITECTURE.md
INSIGHTS.md
```

## Setup

### 1. Regenerate the data (optional — the repo already ships with processed data)

The raw production parquet dataset (`player_data.zip`, ~34MB) is **not**
committed to this repo — see ARCHITECTURE.md's Assumptions section for why.
If you have that data locally and want to regenerate `web/public/data` and
`web/public/minimaps` from scratch:

```bash
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -r scripts/requirements.txt
scripts/.venv/bin/python3 scripts/preprocess.py --input /path/to/player_data
```

### 2. Run the frontend locally

```bash
cd web
npm install
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

### 3. Environment variables

None. This is a fully static site — all data is fetched from static JSON
files shipped alongside the build.

## Running tests

```bash
# Python (pipeline)
scripts/.venv/bin/python3 -m pytest scripts/tests/

# Frontend
cd web && npm run test
```

## Building for production

```bash
cd web && npm run build
```

Outputs to `web/dist/`, deployable to any static host.
