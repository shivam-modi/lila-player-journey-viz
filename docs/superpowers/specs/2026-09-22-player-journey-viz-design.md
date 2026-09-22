# Player Journey Visualization Tool — Design Spec

Date: 2026-09-22
Status: Approved by user, proceeding to implementation.

## Context

Lila Games take-home assignment: build a web tool that lets a Level Designer
explore 5 days of LILA BLACK (extraction shooter) telemetry — player paths,
kills/deaths/loot/storm events, human vs bot distinction — on top of the
game's 3 minimaps. Must be hosted at a shareable URL, source in a public
GitHub repo, with README + ARCHITECTURE.md + INSIGHTS.md.

Source data: `/Users/shivam-modi/Downloads/player_data/` — 1,243 parquet
files (one per player per match, filename `{user_id}_{match_id}.nakama-0`),
~89K rows, 796 matches, 3 maps (AmbroseValley, GrandRift, Lockdown), Feb
10–14 2026 (Feb 14 partial). Full schema/coordinate formula in that folder's
README.md.

## Approach

Fully static site. No backend, no database, no server-side runtime.

- **Preprocessing** (`scripts/preprocess.py`, run once, output committed):
  reads all parquet files with pandas/pyarrow, decodes the `event` bytes
  column, derives `is_bot` from `user_id` shape (UUID vs numeric per file
  name / column), and emits static JSON consumed directly by the frontend.
- **Frontend** (`web/`, Vite + React + TypeScript): fetches the static JSON,
  renders paths/events on `<canvas>` layered over the minimap `<img>`,
  handles filtering, timeline playback, and heatmap toggles client-side.
- **Hosting**: Vercel static deployment of `web/dist`. GitHub repo created
  via `gh repo create` (user already authenticated).

Rejected alternatives:
- **Streamlit**: faster to prototype, but full-script reruns on every
  interaction make smooth timeline scrubbing/animation awkward, and it reads
  as a data-science tool rather than a product a Level Designer would want
  to live in.
- **Full-stack (API server + DB)**: total dataset is 34MB / 89K rows —
  no query complexity that needs a database, and a backend only adds
  hosting cost/complexity with no functional benefit here.

## Data pipeline

Outputs (all under `web/public/data/`):

1. **`matches_index.json`** — array of match summaries: `match_id`,
   `map_id`, `date` (derived from source folder, e.g. `February_10`),
   `human_count`, `bot_count`, `duration_ms` (max `ts` − min `ts` across the
   match's files), and per-event-type counts (`kills`, `deaths`,
   `bot_kills`, `bot_killed`, `storm_deaths`, `loot`). Drives the
   map/date/match filter UI without loading full event streams.
2. **`matches/<match_id>.json`** — full merged event timeline for one
   match: every row from every file sharing that `match_id`, sorted by
   `ts`, shape `{ user_id, is_bot, x, z, ts, event }` (elevation `y` dropped
   — not needed for 2D plotting per the source README). Lazy-loaded only
   when a match is opened for playback.
3. **`heatmaps/<map_id>.json`** — precomputed grid histograms (100×100
   bins spanning the map's UV space) per category: `kills` (Kill+BotKill),
   `deaths` (Killed+BotKilled), `storm_deaths`, `loot`, `traffic`
   (downsampled Position+BotPosition density). Aggregated across all 5 days
   — **not** date-filterable (see Assumptions).
4. **Minimaps**: copied from source, re-encoded/compressed for web
   (target: well under source's up-to-12MB originals) into
   `web/public/minimaps/`.

`is_bot` derivation: a `user_id` that parses as a UUID is human; a bare
numeric string is a bot. Matches the source README's convention exactly —
computed once here so the frontend never re-derives it.

## Coordinate mapping

Per-map config (hardcoded from the source README's table):

| Map | scale | originX | originZ |
|---|---|---|---|
| AmbroseValley | 900 | -370 | -473 |
| GrandRift | 581 | -290 | -290 |
| Lockdown | 1000 | -500 | -500 |

```
u = (x - originX) / scale
v = (z - originZ) / scale
pixelX = u * 1024
pixelY = (1 - v) * 1024   // Y flipped: image origin is top-left
```

Implemented once in `web/src/lib/coords.ts`, verified against the worked
example in the source README (AmbroseValley, x=-301.45/z=-355.55 →
pixel ≈ (78, 890)).

## Frontend UX

Two modes sharing one `MapCanvas`:

- **Overview mode** (map + date selected, no match): heatmap for the
  selected category (kills/deaths/storm/traffic/off) plus every
  kill/death/storm-death marker across matches in the filtered scope,
  scattered on the minimap. Answers "where do fights happen / where does
  the storm kill people / what's ignored" without opening a match.
- **Match Playback mode** (a match selected): players render as moving
  dots — humans solid-colored with a short trail, bots hollow/grey, no
  trail (visually distinct, per requirement). Discrete events render as
  distinct markers at the moment they occur: kill (red), death/killed
  (skull), loot (green diamond), storm death (purple ring). A timeline bar
  drives simulated time with play/pause and speed control (1x/2x/4x),
  scrubbable.

Layout: left `FilterPanel` (map → date → match dropdown, populated from
`matches_index.json` → entity toggle Humans/Bots/Both → event-type
toggles → heatmap category selector, active only in Overview mode), center
`MapCanvas`, bottom `Timeline` (Match Playback mode only), a small
`Legend` for marker/color meaning.

## Assumptions (to restate in ARCHITECTURE.md)

- Heatmaps aggregate all 5 days per map; not date-sliced. Date filtering
  applies to match selection/Overview event scatter, not heatmap grids.
- `y` (elevation) is unused for 2D plotting, per the source README's own
  note.
- Raw parquet dataset is not committed to the repo (production telemetry,
  34MB, fully reconstructable via `scripts/preprocess.py` against the
  provided zip) — only the derived static JSON needed to run the site is
  committed.
- Bot detection is filename/user_id-shape-based only (no separate `is_bot`
  column exists in the schema), matching the source README's documented
  convention.

## Repo layout

```
/
├── scripts/           Python preprocessing (preprocess.py, requirements.txt)
├── web/               Vite + React + TS app (public/data, public/minimaps, src/)
├── README.md          stack, setup, env vars (none — static site)
├── ARCHITECTURE.md    one-pager: decisions, data flow, coord mapping, tradeoffs
└── INSIGHTS.md        three findings from using the tool on the data
```

## Deployment

`gh repo create` (already authenticated) → push → `vercel --prod` (requires
one interactive `vercel login` from the user; I'll prompt for it when we
reach that step).

## Out of scope

- Backend/database, auth, multi-user features.
- Date-filterable heatmaps (see Assumptions).
- Editing/annotating data from the UI (read-only visualization tool).
