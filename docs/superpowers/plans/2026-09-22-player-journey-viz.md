# Player Journey Visualization Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a static web tool that lets a Level Designer explore LILA BLACK player telemetry — journeys, kills/deaths/loot/storm events, human-vs-bot — on the game's 3 minimaps, with filtering, timeline playback, and heatmaps.

**Architecture:** A one-time Python preprocessing script converts the 1,243 source parquet files into compact static JSON (match index, per-match event bundles, per-map heatmap grids) plus compressed minimap images. A Vite + React + TypeScript frontend fetches this static data and renders it on `<canvas>` layered over the minimap `<img>`, with no backend at runtime. Deployed as a static site.

**Tech Stack:** Python 3.14 (pandas, pyarrow, Pillow, pytest) for preprocessing; Vite + React 18 + TypeScript for the frontend; Vitest for frontend unit tests; Vercel for hosting; GitHub via `gh` CLI.

**Spec:** `docs/superpowers/specs/2026-09-22-player-journey-viz-design.md`

## Global Constraints

- Source data lives at `/Users/shivam-modi/Downloads/player_data/` (not committed to the repo — see spec's Assumptions). The preprocessing script takes this path via a `--input` CLI flag, default `/Users/shivam-modi/Downloads/player_data`.
- Coordinate mapping (from the source README, verbatim): `u = (x - originX) / scale`, `v = (z - originZ) / scale`, `pixelX = u * 1024`, `pixelY = (1 - v) * 1024`. Map configs: AmbroseValley scale=900/originX=-370/originZ=-473; GrandRift scale=581/originX=-290/originZ=-290; Lockdown scale=1000/originX=-500/originZ=-500. Minimaps are 1024×1024px.
- `event` column is stored as bytes in parquet; must be decoded with `.decode('utf-8')`.
- Bot vs human: `user_id` that parses as a valid UUID is human; otherwise (bare numeric string) it's a bot. There is no separate boolean column for this.
- `y` (elevation) is dropped in all processed output — only `x`/`z` are used for 2D plotting.
- `ts` is `datetime64[ms]`; cast to `int64` gives milliseconds. It's relative to an arbitrary per-file baseline, not wall-clock — per-match bundles must normalize it to start at 0 (subtract that match's minimum `ts`) so timeline playback starts at t=0.
- Day folders map to dates: `February_10`→`2026-02-10`, `February_11`→`2026-02-11`, `February_12`→`2026-02-12`, `February_13`→`2026-02-13`, `February_14`→`2026-02-14` (partial day).
- Heatmap grids are 100×100 bins in UV space (0–1), aggregated across all 5 days — not date-filterable (documented assumption).
- Canvas rendering and layout React components are verified via manual browser smoke-test (Task 13), not automated snapshot tests — canvas pixel assertions are brittle and low-value here. Pure logic (coordinate math, data aggregation, filter cascading) gets real Vitest/pytest unit tests.
- No backend, no database, no auth. Fully static site, no env vars.

---

## Task 1: Repo & environment scaffolding

**Files:**
- Create: `.gitignore`
- Create: `scripts/requirements.txt`
- Create: `scripts/.venv/` (gitignored, not committed)
- Create: `web/` (via `npm create vite@latest`)
- Modify: `web/.gitignore` (merge into root `.gitignore` instead)

**Interfaces:**
- Produces: a working Python venv at `scripts/.venv` with pandas/pyarrow/Pillow/pytest installed, and a working Vite React+TS app at `web/` with `npm run dev` / `npm run build` / `npm run test` (vitest) all wired.

- [ ] **Step 1: Create root `.gitignore`**

```gitignore
# Python
scripts/.venv/
__pycache__/
*.pyc

# Node
web/node_modules/
web/dist/

# OS
.DS_Store
```

- [ ] **Step 2: Set up the Python environment**

Run:
```bash
cd /Users/shivam-modi/Documents/works/lilagames
python3 -m venv scripts/.venv
scripts/.venv/bin/pip install -q pandas pyarrow pillow pytest
```

Create `scripts/requirements.txt`:
```
pandas>=3.0
pyarrow>=25.0
pillow>=12.0
pytest>=8.0
```

- [ ] **Step 3: Verify the Python environment**

Run: `scripts/.venv/bin/python3 -c "import pandas, pyarrow, PIL, pytest; print('ok')"`
Expected: `ok`

- [ ] **Step 4: Scaffold the Vite React+TS app**

Run:
```bash
cd /Users/shivam-modi/Documents/works/lilagames
npm create vite@latest web -- --template react-ts
cd web
npm install
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 5: Wire up Vitest**

Edit `web/vite.config.ts` to add a `test` block:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
```

Add to `web/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 6: Verify the frontend toolchain**

Run: `cd web && npm run build`
Expected: builds successfully, produces `web/dist/`.

Run: `cd web && npm run test`
Expected: passes (no test files yet is fine — vitest reports 0 tests, exit code 0).

- [ ] **Step 7: Commit**

```bash
git add .gitignore scripts/requirements.txt web/
git commit -m "Scaffold repo: Python preprocessing env + Vite React TS app"
```

---

## Task 2: Preprocessing — parse, decode, derive is_bot

**Files:**
- Create: `scripts/lib/__init__.py` (empty)
- Create: `scripts/lib/parse.py`
- Test: `scripts/tests/test_parse.py`
- Create: `scripts/tests/fixtures/` (small synthetic parquet files for tests)

**Interfaces:**
- Produces:
  - `is_bot_id(user_id: str) -> bool`
  - `read_events(path: Path) -> pd.DataFrame` — columns: `user_id, match_id, map_id, x, z, ts_ms, event, is_bot`
  - `DAY_FOLDER_TO_DATE: dict[str, str]`
  - `load_all_events(root: Path) -> pd.DataFrame` — same columns plus `date`, loaded from every `*.nakama-0` file under `root`'s day-folders, skipping unreadable files.

- [ ] **Step 1: Write a fixture-generating helper and the failing tests**

Create `scripts/tests/fixtures/make_fixtures.py` (run manually, not part of test suite, to generate two tiny real parquet files for tests):

```python
"""Generates tiny synthetic parquet fixtures matching the production schema.
Run once: scripts/.venv/bin/python3 scripts/tests/fixtures/make_fixtures.py
"""
import pyarrow as pa
import pyarrow.parquet as pq
from pathlib import Path

FIXTURES = Path(__file__).parent

def make_human_file():
    table = pa.table({
        "user_id": ["human-1", "human-1", "human-1"],
        "match_id": ["match-a.nakama-0"] * 3,
        "map_id": ["AmbroseValley"] * 3,
        "x": pa.array([-301.45, -300.0, -298.0], type=pa.float32()),
        "y": pa.array([124.97, 124.0, 123.0], type=pa.float32()),
        "z": pa.array([-355.55, -354.0, -350.0], type=pa.float32()),
        "ts": pa.array([1000, 2000, 3000], type=pa.timestamp("ms")),
        "event": pa.array([b"Position", b"Position", b"Kill"], type=pa.binary()),
    })
    pq.write_table(table, FIXTURES / "human-1_match-a.nakama-0")

def make_bot_file():
    table = pa.table({
        "user_id": ["42", "42"],
        "match_id": ["match-a.nakama-0"] * 2,
        "map_id": ["AmbroseValley"] * 2,
        "x": pa.array([-280.85, -279.0], type=pa.float32()),
        "y": pa.array([121.62, 121.0], type=pa.float32()),
        "z": pa.array([-323.35, -320.0], type=pa.float32()),
        "ts": pa.array([1500, 2500], type=pa.timestamp("ms")),
        "event": pa.array([b"BotPosition", b"BotKilled"], type=pa.binary()),
    })
    pq.write_table(table, FIXTURES / "42_match-a.nakama-0")

if __name__ == "__main__":
    make_human_file()
    make_bot_file()
    print("fixtures written to", FIXTURES)
```

Note: fixture user_id `"human-1"` isn't a real UUID — Step 2 of this task will use a real UUID for the is_bot unit test instead; the fixture files above exist only to test `read_events`/`load_all_events` plumbing (column presence, decode, ts cast), not is_bot logic.

Now create the failing test file `scripts/tests/test_parse.py`:

```python
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.parse import is_bot_id, read_events, load_all_events, DAY_FOLDER_TO_DATE

FIXTURES = Path(__file__).parent / "fixtures"


def test_is_bot_id_uuid_is_human():
    assert is_bot_id("f4e072fa-b7af-4761-b567-1d95b7ad0108") is False


def test_is_bot_id_numeric_is_bot():
    assert is_bot_id("1440") is True
    assert is_bot_id("42") is True


def test_read_events_decodes_event_bytes_and_casts_ts():
    df = read_events(FIXTURES / "human-1_match-a.nakama-0")
    assert list(df["event"]) == ["Position", "Position", "Kill"]
    assert df["ts_ms"].dtype.kind in ("i", "u")
    assert list(df["ts_ms"]) == [1000, 2000, 3000]
    assert "y" not in df.columns
    assert df["is_bot"].iloc[0] == False


def test_read_events_flags_bot_rows():
    df = read_events(FIXTURES / "42_match-a.nakama-0")
    assert all(df["is_bot"])


def test_load_all_events_skips_unreadable_files(tmp_path):
    day_dir = tmp_path / "February_10"
    day_dir.mkdir()
    (day_dir / "bad_file.nakama-0").write_text("not a parquet file")
    import shutil
    shutil.copy(FIXTURES / "human-1_match-a.nakama-0", day_dir / "human-1_match-a.nakama-0")

    df = load_all_events(tmp_path)
    assert len(df) == 3  # only the good file's rows
    assert (df["date"] == "2026-02-10").all()


def test_day_folder_to_date_mapping():
    assert DAY_FOLDER_TO_DATE["February_10"] == "2026-02-10"
    assert DAY_FOLDER_TO_DATE["February_14"] == "2026-02-14"
```

- [ ] **Step 2: Generate fixtures and run the tests to see them fail**

Run:
```bash
scripts/.venv/bin/python3 scripts/tests/fixtures/make_fixtures.py
cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_parse.py -v
```
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.parse'` (doesn't exist yet).

- [ ] **Step 3: Implement `scripts/lib/parse.py`**

```python
import uuid
from pathlib import Path

import pandas as pd

DAY_FOLDER_TO_DATE = {
    "February_10": "2026-02-10",
    "February_11": "2026-02-11",
    "February_12": "2026-02-12",
    "February_13": "2026-02-13",
    "February_14": "2026-02-14",
}


def is_bot_id(user_id: str) -> bool:
    try:
        uuid.UUID(str(user_id))
        return False
    except (ValueError, AttributeError, TypeError):
        return True


def read_events(path: Path) -> pd.DataFrame:
    df = pd.read_parquet(path)
    df["event"] = df["event"].apply(
        lambda v: v.decode("utf-8") if isinstance(v, bytes) else v
    )
    df["ts_ms"] = df["ts"].astype("int64")
    df["is_bot"] = df["user_id"].apply(is_bot_id)
    df = df.drop(columns=["y", "ts"])
    return df[["user_id", "match_id", "map_id", "x", "z", "ts_ms", "event", "is_bot"]]


def load_all_events(root: Path) -> pd.DataFrame:
    root = Path(root)
    frames = []
    for day_folder, date in DAY_FOLDER_TO_DATE.items():
        day_dir = root / day_folder
        if not day_dir.is_dir():
            continue
        for file_path in day_dir.glob("*.nakama-0"):
            try:
                df = read_events(file_path)
            except Exception:
                continue
            df["date"] = date
            frames.append(df)
    if not frames:
        return pd.DataFrame(
            columns=["user_id", "match_id", "map_id", "x", "z", "ts_ms", "event", "is_bot", "date"]
        )
    return pd.concat(frames, ignore_index=True)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_parse.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ scripts/tests/
git commit -m "Add parquet parsing: event decode, is_bot derivation, day->date mapping"
```

---

## Task 3: Preprocessing — matches_index and per-match bundles

**Files:**
- Create: `scripts/lib/aggregate.py`
- Test: `scripts/tests/test_aggregate.py`

**Interfaces:**
- Consumes: `load_all_events(root) -> pd.DataFrame` (Task 2), columns `user_id, match_id, map_id, x, z, ts_ms, event, is_bot, date`.
- Produces:
  - `build_matches_index(events: pd.DataFrame) -> list[dict]` — each dict: `{match_id, map_id, date, human_count, bot_count, duration_ms, kills, deaths, storm_deaths, loot}`.
  - `build_match_bundle(match_events: pd.DataFrame) -> list[dict]` — each dict: `{user_id, is_bot, x, z, ts, event}` with `ts` normalized to start at 0 for that match, sorted by `ts`.

- [ ] **Step 1: Write the failing tests**

```python
# scripts/tests/test_aggregate.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from lib.aggregate import build_matches_index, build_match_bundle

def sample_events():
    return pd.DataFrame([
        {"user_id": "h1", "match_id": "m1", "map_id": "AmbroseValley", "x": 1.0, "z": 1.0, "ts_ms": 5000, "event": "Position", "is_bot": False, "date": "2026-02-10"},
        {"user_id": "h1", "match_id": "m1", "map_id": "AmbroseValley", "x": 2.0, "z": 2.0, "ts_ms": 7000, "event": "Kill", "is_bot": False, "date": "2026-02-10"},
        {"user_id": "b1", "match_id": "m1", "map_id": "AmbroseValley", "x": 3.0, "z": 3.0, "ts_ms": 6000, "event": "BotKilled", "is_bot": True, "date": "2026-02-10"},
        {"user_id": "h1", "match_id": "m1", "map_id": "AmbroseValley", "x": 4.0, "z": 4.0, "ts_ms": 9000, "event": "KilledByStorm", "is_bot": False, "date": "2026-02-10"},
    ])

def test_build_matches_index_counts_and_duration():
    idx = build_matches_index(sample_events())
    assert len(idx) == 1
    row = idx[0]
    assert row["match_id"] == "m1"
    assert row["map_id"] == "AmbroseValley"
    assert row["date"] == "2026-02-10"
    assert row["human_count"] == 1
    assert row["bot_count"] == 1
    assert row["duration_ms"] == 4000  # 9000 - 5000
    assert row["kills"] == 1
    assert row["deaths"] == 1  # BotKilled counts as a death
    assert row["storm_deaths"] == 1
    assert row["loot"] == 0

def test_build_match_bundle_normalizes_and_sorts_ts():
    bundle = build_match_bundle(sample_events())
    assert [e["ts"] for e in bundle] == [0, 1000, 2000, 4000]
    assert bundle[0]["user_id"] == "h1"
    assert bundle[0]["event"] == "Position"
    assert "match_id" not in bundle[0]
    assert "date" not in bundle[0]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_aggregate.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.aggregate'`

- [ ] **Step 3: Implement `scripts/lib/aggregate.py`**

```python
import pandas as pd

KILL_EVENTS = {"Kill", "BotKill"}
DEATH_EVENTS = {"Killed", "BotKilled"}
STORM_EVENTS = {"KilledByStorm"}
LOOT_EVENTS = {"Loot"}


def build_matches_index(events: pd.DataFrame) -> list[dict]:
    rows = []
    for match_id, g in events.groupby("match_id"):
        humans = g.loc[~g["is_bot"], "user_id"].nunique()
        bots = g.loc[g["is_bot"], "user_id"].nunique()
        rows.append({
            "match_id": match_id,
            "map_id": g["map_id"].iloc[0],
            "date": g["date"].iloc[0],
            "human_count": int(humans),
            "bot_count": int(bots),
            "duration_ms": int(g["ts_ms"].max() - g["ts_ms"].min()),
            "kills": int(g["event"].isin(KILL_EVENTS).sum()),
            "deaths": int(g["event"].isin(DEATH_EVENTS).sum()),
            "storm_deaths": int(g["event"].isin(STORM_EVENTS).sum()),
            "loot": int(g["event"].isin(LOOT_EVENTS).sum()),
        })
    rows.sort(key=lambda r: (r["date"], r["match_id"]))
    return rows


def build_match_bundle(match_events: pd.DataFrame) -> list[dict]:
    g = match_events.sort_values("ts_ms").copy()
    baseline = g["ts_ms"].min()
    g["ts"] = g["ts_ms"] - baseline
    return g[["user_id", "is_bot", "x", "z", "ts", "event"]].to_dict("records")
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_aggregate.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/aggregate.py scripts/tests/test_aggregate.py
git commit -m "Add matches_index and per-match bundle aggregation"
```

---

## Task 4: Preprocessing — heatmap grid builder

**Files:**
- Create: `scripts/lib/heatmap.py`
- Test: `scripts/tests/test_heatmap.py`

**Interfaces:**
- Consumes: the coordinate formula from Global Constraints; per-map config `{scale, originX, originZ}`.
- Produces:
  - `MAP_CONFIGS: dict[str, dict]` — `{"AmbroseValley": {"scale": 900, "originX": -370, "originZ": -473}, ...}`
  - `world_to_uv(x: float, z: float, map_id: str) -> tuple[float, float]`
  - `build_heatmap_grids(events: pd.DataFrame, bins: int = 100) -> dict[str, dict[str, list[list[int]]]]` — returns `{map_id: {category: grid}}` where `grid` is a `bins x bins` list of ints, and `category` is one of `kills, deaths, storm_deaths, loot, traffic`.

- [ ] **Step 1: Write the failing tests**

```python
# scripts/tests/test_heatmap.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from lib.heatmap import world_to_uv, build_heatmap_grids, MAP_CONFIGS

def test_world_to_uv_matches_readme_worked_example():
    u, v = world_to_uv(-301.45, -355.55, "AmbroseValley")
    assert round(u, 4) == 0.0762
    assert round(v, 4) == 0.1305

def test_build_heatmap_grids_bins_events_into_correct_cell():
    events = pd.DataFrame([
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Kill"},   # u=0,v=0 -> bin (0,0)
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Killed"},
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "KilledByStorm"},
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Loot"},
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Position"},
    ])
    grids = build_heatmap_grids(events, bins=10)
    ambrose = grids["AmbroseValley"]
    assert ambrose["kills"][0][0] == 1
    assert ambrose["deaths"][0][0] == 1
    assert ambrose["storm_deaths"][0][0] == 1
    assert ambrose["loot"][0][0] == 1
    assert ambrose["traffic"][0][0] == 1
    assert sum(sum(row) for row in ambrose["kills"]) == 1  # only one cell touched

def test_build_heatmap_grids_covers_all_three_maps():
    events = pd.DataFrame([
        {"map_id": "GrandRift", "x": -290.0, "z": -290.0, "event": "Kill"},
    ])
    grids = build_heatmap_grids(events, bins=10)
    assert set(grids.keys()) == set(MAP_CONFIGS.keys())
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_heatmap.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.heatmap'`

- [ ] **Step 3: Implement `scripts/lib/heatmap.py`**

```python
import pandas as pd

MAP_CONFIGS = {
    "AmbroseValley": {"scale": 900, "originX": -370, "originZ": -473},
    "GrandRift": {"scale": 581, "originX": -290, "originZ": -290},
    "Lockdown": {"scale": 1000, "originX": -500, "originZ": -500},
}

CATEGORY_EVENTS = {
    "kills": {"Kill", "BotKill"},
    "deaths": {"Killed", "BotKilled"},
    "storm_deaths": {"KilledByStorm"},
    "loot": {"Loot"},
    "traffic": {"Position", "BotPosition"},
}


def world_to_uv(x: float, z: float, map_id: str) -> tuple[float, float]:
    cfg = MAP_CONFIGS[map_id]
    u = (x - cfg["originX"]) / cfg["scale"]
    v = (z - cfg["originZ"]) / cfg["scale"]
    return u, v


def _empty_grid(bins: int) -> list[list[int]]:
    return [[0] * bins for _ in range(bins)]


def build_heatmap_grids(events: pd.DataFrame, bins: int = 100) -> dict[str, dict[str, list[list[int]]]]:
    grids = {
        map_id: {cat: _empty_grid(bins) for cat in CATEGORY_EVENTS}
        for map_id in MAP_CONFIGS
    }
    for map_id, map_events in events.groupby("map_id"):
        if map_id not in MAP_CONFIGS:
            continue
        for cat, event_names in CATEGORY_EVENTS.items():
            subset = map_events[map_events["event"].isin(event_names)]
            for x, z in zip(subset["x"], subset["z"]):
                u, v = world_to_uv(x, z, map_id)
                col = min(max(int(u * bins), 0), bins - 1)
                row = min(max(int(v * bins), 0), bins - 1)
                grids[map_id][cat][row][col] += 1
    return grids
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_heatmap.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/heatmap.py scripts/tests/test_heatmap.py
git commit -m "Add heatmap grid builder with world-to-UV coordinate mapping"
```

---

## Task 5: Preprocessing — pipeline runner, minimap compression, run on real data

**Files:**
- Create: `scripts/preprocess.py`
- Create: `scripts/lib/images.py`
- Test: `scripts/tests/test_images.py`

**Interfaces:**
- Consumes: `load_all_events`, `build_matches_index`, `build_match_bundle`, `build_heatmap_grids` from Tasks 2-4.
- Produces: `compress_minimap(src: Path, dst: Path, max_bytes: int = 1_500_000) -> None`; `scripts/preprocess.py` CLI writing to `web/public/data/` and `web/public/minimaps/`.

- [ ] **Step 1: Write the failing test for image compression**

```python
# scripts/tests/test_images.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image
from lib.images import compress_minimap

def test_compress_minimap_shrinks_file_and_preserves_dimensions(tmp_path):
    src = tmp_path / "src.png"
    Image.new("RGB", (1024, 1024), color=(120, 130, 140)).save(src)
    dst = tmp_path / "out.jpg"

    compress_minimap(src, dst, max_bytes=200_000)

    assert dst.exists()
    assert dst.stat().st_size <= 200_000
    with Image.open(dst) as img:
        assert img.size == (1024, 1024)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_images.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'lib.images'`

- [ ] **Step 3: Implement `scripts/lib/images.py`**

```python
from pathlib import Path

from PIL import Image


def compress_minimap(src: Path, dst: Path, max_bytes: int = 1_500_000) -> None:
    img = Image.open(src).convert("RGB")
    quality = 90
    dst.parent.mkdir(parents=True, exist_ok=True)
    while quality >= 30:
        img.save(dst, "JPEG", quality=quality, optimize=True)
        if dst.stat().st_size <= max_bytes:
            return
        quality -= 10
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_images.py -v`
Expected: PASS

- [ ] **Step 5: Implement `scripts/preprocess.py`**

```python
import argparse
import json
from pathlib import Path

from lib.parse import load_all_events
from lib.aggregate import build_matches_index, build_match_bundle
from lib.heatmap import build_heatmap_grids
from lib.images import compress_minimap

MINIMAP_FILES = {
    "AmbroseValley": "AmbroseValley_Minimap.png",
    "GrandRift": "GrandRift_Minimap.png",
    "Lockdown": "Lockdown_Minimap.jpg",
}


def run(input_root: Path, output_root: Path) -> None:
    data_dir = output_root / "data"
    matches_dir = data_dir / "matches"
    heatmaps_dir = data_dir / "heatmaps"
    minimaps_dir = output_root / "minimaps"
    for d in (matches_dir, heatmaps_dir, minimaps_dir):
        d.mkdir(parents=True, exist_ok=True)

    print(f"Loading events from {input_root} ...")
    events = load_all_events(input_root)
    print(f"Loaded {len(events)} rows across {events['match_id'].nunique()} matches")

    index = build_matches_index(events)
    (data_dir / "matches_index.json").write_text(json.dumps(index))
    print(f"Wrote matches_index.json ({len(index)} matches)")

    for match_id, g in events.groupby("match_id"):
        bundle = build_match_bundle(g)
        safe_name = match_id.replace("/", "_")
        (matches_dir / f"{safe_name}.json").write_text(json.dumps(bundle))
    print(f"Wrote {events['match_id'].nunique()} per-match bundles")

    grids = build_heatmap_grids(events, bins=100)
    for map_id, cat_grids in grids.items():
        (heatmaps_dir / f"{map_id}.json").write_text(json.dumps(cat_grids))
    print(f"Wrote heatmap grids for {len(grids)} maps")

    for map_id, filename in MINIMAP_FILES.items():
        src = input_root / "minimaps" / filename
        dst = minimaps_dir / f"{map_id}.jpg"
        compress_minimap(src, dst)
        print(f"Compressed {filename} -> {dst.name} ({dst.stat().st_size // 1024} KB)")


def main():
    parser = argparse.ArgumentParser(description="Preprocess LILA BLACK player telemetry into static JSON")
    parser.add_argument("--input", default="/Users/shivam-modi/Downloads/player_data")
    parser.add_argument("--output", default=str(Path(__file__).parent.parent / "web" / "public"))
    args = parser.parse_args()
    run(Path(args.input), Path(args.output))


if __name__ == "__main__":
    main()
```

- [ ] **Step 6: Run the full pipeline against the real data**

Run:
```bash
cd /Users/shivam-modi/Documents/works/lilagames
scripts/.venv/bin/python3 scripts/preprocess.py
```
Expected: completes without error; prints row/match counts matching the source README's quick stats (~89,000 rows, 796 matches); `web/public/data/matches_index.json`, `web/public/data/matches/*.json` (796 files), `web/public/data/heatmaps/*.json` (3 files), and `web/public/minimaps/*.jpg` (3 files, each well under 1.5MB) all exist.

Verify: `python3 -c "import json; d=json.load(open('web/public/data/matches_index.json')); print(len(d), d[0])"` — sanity-check the shape of one entry.

- [ ] **Step 7: Commit**

```bash
git add scripts/preprocess.py scripts/lib/images.py scripts/tests/test_images.py web/public/data web/public/minimaps
git commit -m "Add pipeline runner + minimap compression; run pipeline on production data"
```

---

## Task 6: Frontend — types, coordinate mapping, map config

**Files:**
- Create: `web/src/lib/types.ts`
- Create: `web/src/lib/coords.ts`
- Create: `web/src/lib/mapConfig.ts`
- Test: `web/src/lib/coords.test.ts`

**Interfaces:**
- Produces:
  - `MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'`
  - `MatchIndexEntry`, `MatchEvent`, `HeatmapGrids` types (mirroring the JSON shapes from Tasks 3-4).
  - `MAP_CONFIGS: Record<MapId, { scale: number; originX: number; originZ: number; minimapSrc: string }>`
  - `worldToPixel(x: number, z: number, mapId: MapId): { x: number; y: number }`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/coords.test.ts
import { describe, it, expect } from 'vitest'
import { worldToPixel } from './coords'

describe('worldToPixel', () => {
  it('matches the README worked example for AmbroseValley', () => {
    const { x, y } = worldToPixel(-301.45, -355.55, 'AmbroseValley')
    expect(Math.round(x)).toBe(78)
    expect(Math.round(y)).toBe(890)
  })

  it('maps the map origin to the bottom-left pixel corner', () => {
    const { x, y } = worldToPixel(-370, -473, 'AmbroseValley')
    expect(x).toBeCloseTo(0, 1)
    expect(y).toBeCloseTo(1024, 1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- coords`
Expected: FAIL — cannot find module `./coords`

- [ ] **Step 3: Implement `web/src/lib/types.ts`**

```ts
export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'

export interface MatchIndexEntry {
  match_id: string
  map_id: MapId
  date: string
  human_count: number
  bot_count: number
  duration_ms: number
  kills: number
  deaths: number
  storm_deaths: number
  loot: number
}

export type EventType =
  | 'Position'
  | 'BotPosition'
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot'

export interface MatchEvent {
  user_id: string
  is_bot: boolean
  x: number
  z: number
  ts: number
  event: EventType
}

export type HeatmapCategory = 'kills' | 'deaths' | 'storm_deaths' | 'loot' | 'traffic'

export type HeatmapGrids = Record<HeatmapCategory, number[][]>
```

- [ ] **Step 4: Implement `web/src/lib/mapConfig.ts`**

```ts
import type { MapId } from './types'

export const MAP_CONFIGS: Record<MapId, { scale: number; originX: number; originZ: number; minimapSrc: string }> = {
  AmbroseValley: { scale: 900, originX: -370, originZ: -473, minimapSrc: '/minimaps/AmbroseValley.jpg' },
  GrandRift: { scale: 581, originX: -290, originZ: -290, minimapSrc: '/minimaps/GrandRift.jpg' },
  Lockdown: { scale: 1000, originX: -500, originZ: -500, minimapSrc: '/minimaps/Lockdown.jpg' },
}

export const MINIMAP_SIZE = 1024
```

- [ ] **Step 5: Implement `web/src/lib/coords.ts`**

```ts
import { MAP_CONFIGS, MINIMAP_SIZE } from './mapConfig'
import type { MapId } from './types'

export function worldToPixel(x: number, z: number, mapId: MapId): { x: number; y: number } {
  const cfg = MAP_CONFIGS[mapId]
  const u = (x - cfg.originX) / cfg.scale
  const v = (z - cfg.originZ) / cfg.scale
  return {
    x: u * MINIMAP_SIZE,
    y: (1 - v) * MINIMAP_SIZE,
  }
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd web && npm run test -- coords`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/
git commit -m "Add frontend types, map config, and world-to-pixel coordinate mapping"
```

---

## Task 7: Frontend — data loading hooks

**Files:**
- Create: `web/src/lib/dataClient.ts`
- Create: `web/src/hooks/useMatchesIndex.ts`
- Create: `web/src/hooks/useMatchBundle.ts`
- Create: `web/src/hooks/useHeatmap.ts`
- Test: `web/src/lib/dataClient.test.ts`

**Interfaces:**
- Consumes: `MatchIndexEntry`, `MatchEvent`, `HeatmapGrids`, `MapId` from Task 6.
- Produces:
  - `fetchMatchesIndex(): Promise<MatchIndexEntry[]>`
  - `fetchMatchBundle(matchId: string): Promise<MatchEvent[]>`
  - `fetchHeatmap(mapId: MapId): Promise<HeatmapGrids>`
  - `useMatchesIndex(): { data: MatchIndexEntry[] | null; loading: boolean; error: Error | null }`
  - `useMatchBundle(matchId: string | null): { data: MatchEvent[] | null; loading: boolean; error: Error | null }`
  - `useHeatmap(mapId: MapId | null): { data: HeatmapGrids | null; loading: boolean; error: Error | null }`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/dataClient.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchMatchesIndex, fetchMatchBundle, fetchHeatmap } from './dataClient'

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn())
})

describe('dataClient', () => {
  it('fetches and parses the matches index', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ match_id: 'm1' }] })
    const result = await fetchMatchesIndex()
    expect(fetch).toHaveBeenCalledWith('/data/matches_index.json')
    expect(result).toEqual([{ match_id: 'm1' }])
  })

  it('fetches a per-match bundle by id, escaping slashes in the filename', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [] })
    await fetchMatchBundle('abc.nakama-0')
    expect(fetch).toHaveBeenCalledWith('/data/matches/abc.nakama-0.json')
  })

  it('fetches heatmap grids for a map', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ kills: [] }) })
    const result = await fetchHeatmap('AmbroseValley')
    expect(fetch).toHaveBeenCalledWith('/data/heatmaps/AmbroseValley.json')
    expect(result).toEqual({ kills: [] })
  })

  it('throws when a fetch is not ok', async () => {
    ;(fetch as any).mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchMatchesIndex()).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- dataClient`
Expected: FAIL — cannot find module `./dataClient`

- [ ] **Step 3: Implement `web/src/lib/dataClient.ts`**

```ts
import type { MapId, MatchIndexEntry, MatchEvent, HeatmapGrids } from './types'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchMatchesIndex(): Promise<MatchIndexEntry[]> {
  return getJson('/data/matches_index.json')
}

export function fetchMatchBundle(matchId: string): Promise<MatchEvent[]> {
  const safeName = matchId.replace(/\//g, '_')
  return getJson(`/data/matches/${safeName}.json`)
}

export function fetchHeatmap(mapId: MapId): Promise<HeatmapGrids> {
  return getJson(`/data/heatmaps/${mapId}.json`)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- dataClient`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement the hooks (no separate tests — thin wrappers around Step 3's tested functions; verified visually in Task 13)**

```ts
// web/src/hooks/useMatchesIndex.ts
import { useEffect, useState } from 'react'
import { fetchMatchesIndex } from '../lib/dataClient'
import type { MatchIndexEntry } from '../lib/types'

export function useMatchesIndex() {
  const [data, setData] = useState<MatchIndexEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMatchesIndex()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
```

```ts
// web/src/hooks/useMatchBundle.ts
import { useEffect, useState } from 'react'
import { fetchMatchBundle } from '../lib/dataClient'
import type { MatchEvent } from '../lib/types'

export function useMatchBundle(matchId: string | null) {
  const [data, setData] = useState<MatchEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!matchId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setData(null)
    fetchMatchBundle(matchId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [matchId])

  return { data, loading, error }
}
```

```ts
// web/src/hooks/useHeatmap.ts
import { useEffect, useState } from 'react'
import { fetchHeatmap } from '../lib/dataClient'
import type { HeatmapGrids, MapId } from '../lib/types'

export function useHeatmap(mapId: MapId | null) {
  const [data, setData] = useState<HeatmapGrids | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!mapId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchHeatmap(mapId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [mapId])

  return { data, loading, error }
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/dataClient.ts web/src/lib/dataClient.test.ts web/src/hooks/
git commit -m "Add static data fetching client and React hooks"
```

---

## Task 8: Frontend — FilterPanel component

**Files:**
- Create: `web/src/components/FilterPanel.tsx`
- Create: `web/src/components/FilterPanel.css`
- Create: `web/src/lib/filterMatches.ts`
- Test: `web/src/lib/filterMatches.test.ts`

**Interfaces:**
- Consumes: `MatchIndexEntry[]`, `MapId` from Task 6.
- Produces:
  - `filterMatches(index: MatchIndexEntry[], mapId: MapId | null, date: string | null): MatchIndexEntry[]`
  - `uniqueDates(index: MatchIndexEntry[], mapId: MapId | null): string[]`
  - `<FilterPanel>` component, props:
    ```ts
    interface FilterPanelProps {
      index: MatchIndexEntry[]
      mapId: MapId
      date: string | null
      matchId: string | null
      entityFilter: 'all' | 'humans' | 'bots'
      eventTypeFilter: Set<EventType>
      heatmapCategory: HeatmapCategory | 'off'
      onMapChange: (m: MapId) => void
      onDateChange: (d: string | null) => void
      onMatchChange: (m: string | null) => void
      onEntityFilterChange: (f: 'all' | 'humans' | 'bots') => void
      onEventTypeToggle: (e: EventType) => void
      onHeatmapCategoryChange: (c: HeatmapCategory | 'off') => void
    }
    ```

- [ ] **Step 1: Write the failing test for the pure filter logic**

```ts
// web/src/lib/filterMatches.test.ts
import { describe, it, expect } from 'vitest'
import { filterMatches, uniqueDates } from './filterMatches'
import type { MatchIndexEntry } from './types'

const index: MatchIndexEntry[] = [
  { match_id: 'm1', map_id: 'AmbroseValley', date: '2026-02-10', human_count: 2, bot_count: 8, duration_ms: 1000, kills: 1, deaths: 1, storm_deaths: 0, loot: 2 },
  { match_id: 'm2', map_id: 'AmbroseValley', date: '2026-02-11', human_count: 1, bot_count: 9, duration_ms: 1000, kills: 0, deaths: 0, storm_deaths: 1, loot: 0 },
  { match_id: 'm3', map_id: 'GrandRift', date: '2026-02-10', human_count: 3, bot_count: 7, duration_ms: 1000, kills: 2, deaths: 2, storm_deaths: 0, loot: 1 },
]

describe('filterMatches', () => {
  it('filters by map', () => {
    expect(filterMatches(index, 'AmbroseValley', null).map((m) => m.match_id)).toEqual(['m1', 'm2'])
  })

  it('filters by map and date', () => {
    expect(filterMatches(index, 'AmbroseValley', '2026-02-11').map((m) => m.match_id)).toEqual(['m2'])
  })
})

describe('uniqueDates', () => {
  it('returns sorted unique dates for a map', () => {
    expect(uniqueDates(index, 'AmbroseValley')).toEqual(['2026-02-10', '2026-02-11'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- filterMatches`
Expected: FAIL — cannot find module `./filterMatches`

- [ ] **Step 3: Implement `web/src/lib/filterMatches.ts`**

```ts
import type { MapId, MatchIndexEntry } from './types'

export function filterMatches(index: MatchIndexEntry[], mapId: MapId | null, date: string | null): MatchIndexEntry[] {
  return index.filter((m) => (mapId ? m.map_id === mapId : true) && (date ? m.date === date : true))
}

export function uniqueDates(index: MatchIndexEntry[], mapId: MapId | null): string[] {
  const dates = new Set(filterMatches(index, mapId, null).map((m) => m.date))
  return Array.from(dates).sort()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- filterMatches`
Expected: PASS (3 tests)

- [ ] **Step 5: Implement `web/src/components/FilterPanel.tsx`**

```tsx
import type { EventType, HeatmapCategory, MapId, MatchIndexEntry } from '../lib/types'
import { filterMatches, uniqueDates } from '../lib/filterMatches'
import './FilterPanel.css'

const MAPS: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown']
const EVENT_TYPES: EventType[] = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']
const HEATMAP_CATEGORIES: (HeatmapCategory | 'off')[] = ['off', 'kills', 'deaths', 'storm_deaths', 'loot', 'traffic']

interface FilterPanelProps {
  index: MatchIndexEntry[]
  mapId: MapId
  date: string | null
  matchId: string | null
  entityFilter: 'all' | 'humans' | 'bots'
  eventTypeFilter: Set<EventType>
  heatmapCategory: HeatmapCategory | 'off'
  onMapChange: (m: MapId) => void
  onDateChange: (d: string | null) => void
  onMatchChange: (m: string | null) => void
  onEntityFilterChange: (f: 'all' | 'humans' | 'bots') => void
  onEventTypeToggle: (e: EventType) => void
  onHeatmapCategoryChange: (c: HeatmapCategory | 'off') => void
}

export function FilterPanel(props: FilterPanelProps) {
  const dates = uniqueDates(props.index, props.mapId)
  const matches = filterMatches(props.index, props.mapId, props.date)

  return (
    <aside className="filter-panel">
      <section>
        <h3>Map</h3>
        <select value={props.mapId} onChange={(e) => props.onMapChange(e.target.value as MapId)}>
          {MAPS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>

      <section>
        <h3>Date</h3>
        <select value={props.date ?? ''} onChange={(e) => props.onDateChange(e.target.value || null)}>
          <option value="">All dates</option>
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </section>

      <section>
        <h3>Match ({matches.length})</h3>
        <select value={props.matchId ?? ''} onChange={(e) => props.onMatchChange(e.target.value || null)}>
          <option value="">Overview (no match selected)</option>
          {matches.map((m) => (
            <option key={m.match_id} value={m.match_id}>
              {m.match_id.slice(0, 8)} — {m.human_count}H/{m.bot_count}B — {Math.round(m.duration_ms / 1000)}s
            </option>
          ))}
        </select>
      </section>

      <section>
        <h3>Players</h3>
        {(['all', 'humans', 'bots'] as const).map((f) => (
          <label key={f}>
            <input type="radio" name="entity" checked={props.entityFilter === f} onChange={() => props.onEntityFilterChange(f)} />
            {f}
          </label>
        ))}
      </section>

      <section>
        <h3>Event types</h3>
        {EVENT_TYPES.map((e) => (
          <label key={e}>
            <input type="checkbox" checked={props.eventTypeFilter.has(e)} onChange={() => props.onEventTypeToggle(e)} />
            {e}
          </label>
        ))}
      </section>

      {!props.matchId && (
        <section>
          <h3>Heatmap</h3>
          <select value={props.heatmapCategory} onChange={(e) => props.onHeatmapCategoryChange(e.target.value as HeatmapCategory | 'off')}>
            {HEATMAP_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </section>
      )}
    </aside>
  )
}
```

Create a minimal `web/src/components/FilterPanel.css` with flex column layout, dark background, spacing — real values, not placeholders:

```css
.filter-panel {
  width: 260px;
  flex-shrink: 0;
  background: #1a1d23;
  color: #e6e6e6;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
  font-size: 13px;
}

.filter-panel h3 {
  margin: 0 0 8px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #8a8f98;
}

.filter-panel select {
  width: 100%;
  padding: 6px 8px;
  background: #2a2e37;
  color: #e6e6e6;
  border: 1px solid #3a3f4a;
  border-radius: 4px;
}

.filter-panel label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 0;
  cursor: pointer;
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/filterMatches.ts web/src/lib/filterMatches.test.ts web/src/components/FilterPanel.tsx web/src/components/FilterPanel.css
git commit -m "Add FilterPanel component with map/date/match/entity/event/heatmap filters"
```

---

## Task 9: Frontend — MapCanvas base rendering (minimap + coordinate-correct drawing)

**Files:**
- Create: `web/src/components/MapCanvas.tsx`
- Create: `web/src/components/MapCanvas.css`
- Create: `web/src/lib/drawCommands.ts`
- Test: `web/src/lib/drawCommands.test.ts`

**Interfaces:**
- Consumes: `worldToPixel` (Task 6), `MatchEvent`, `HeatmapGrids` (Task 6).
- Produces:
  - `type DrawPoint = { x: number; y: number; kind: 'kill' | 'death' | 'storm' | 'loot'; isBot: boolean }`
  - `eventsToDrawPoints(events: { x: number; z: number; event: EventType; is_bot: boolean }[], mapId: MapId): DrawPoint[]` — filters to the 4 discrete event categories (drops Position/BotPosition) and projects to pixel space.
  - `<MapCanvas>` component, props: `{ mapId: MapId; heatmap?: HeatmapGrids | null; heatmapCategory?: HeatmapCategory | 'off'; overviewPoints?: DrawPoint[]; playbackFrame?: PlaybackFrame | null }` (`PlaybackFrame` defined in Task 11, prop optional/undefined here).

- [ ] **Step 1: Write the failing test for the pure projection logic**

```ts
// web/src/lib/drawCommands.test.ts
import { describe, it, expect } from 'vitest'
import { eventsToDrawPoints } from './drawCommands'

describe('eventsToDrawPoints', () => {
  it('drops Position/BotPosition events and keeps discrete event categories', () => {
    const events = [
      { x: -301.45, z: -355.55, event: 'Position' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'Kill' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'BotKilled' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'KilledByStorm' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'Loot' as const, is_bot: false },
    ]
    const points = eventsToDrawPoints(events, 'AmbroseValley')
    expect(points.map((p) => p.kind)).toEqual(['kill', 'death', 'storm', 'loot'])
    expect(Math.round(points[0].x)).toBe(78)
    expect(Math.round(points[0].y)).toBe(890)
  })

  it('maps BotKill to kind kill and Killed to kind death', () => {
    const events = [
      { x: -370, z: -473, event: 'BotKill' as const, is_bot: false },
      { x: -370, z: -473, event: 'Killed' as const, is_bot: false },
    ]
    const points = eventsToDrawPoints(events, 'AmbroseValley')
    expect(points.map((p) => p.kind)).toEqual(['kill', 'death'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- drawCommands`
Expected: FAIL — cannot find module `./drawCommands`

- [ ] **Step 3: Implement `web/src/lib/drawCommands.ts`**

```ts
import { worldToPixel } from './coords'
import type { EventType, MapId } from './types'

export type DrawPointKind = 'kill' | 'death' | 'storm' | 'loot'

export interface DrawPoint {
  x: number
  y: number
  kind: DrawPointKind
  isBot: boolean
}

const EVENT_TO_KIND: Partial<Record<EventType, DrawPointKind>> = {
  Kill: 'kill',
  BotKill: 'kill',
  Killed: 'death',
  BotKilled: 'death',
  KilledByStorm: 'storm',
  Loot: 'loot',
}

export function eventsToDrawPoints(
  events: { x: number; z: number; event: EventType; is_bot: boolean }[],
  mapId: MapId
): DrawPoint[] {
  const points: DrawPoint[] = []
  for (const e of events) {
    const kind = EVENT_TO_KIND[e.event]
    if (!kind) continue
    const { x, y } = worldToPixel(e.x, e.z, mapId)
    points.push({ x, y, kind, isBot: e.is_bot })
  }
  return points
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- drawCommands`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement `web/src/components/MapCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react'
import { MAP_CONFIGS, MINIMAP_SIZE } from '../lib/mapConfig'
import type { HeatmapCategory, HeatmapGrids, MapId } from '../lib/types'
import type { DrawPoint } from '../lib/drawCommands'
import './MapCanvas.css'

const MARKER_COLORS: Record<DrawPoint['kind'], string> = {
  kill: '#ff4d4d',
  death: '#ffffff',
  storm: '#b060ff',
  loot: '#4dff88',
}

export interface PlaybackFrame {
  positions: { x: number; y: number; isBot: boolean; trail: { x: number; y: number }[] }[]
  events: DrawPoint[]
}

interface MapCanvasProps {
  mapId: MapId
  heatmap?: HeatmapGrids | null
  heatmapCategory?: HeatmapCategory | 'off'
  overviewPoints?: DrawPoint[]
  playbackFrame?: PlaybackFrame | null
}

function drawHeatmap(ctx: CanvasRenderingContext2D, grid: number[][]) {
  const bins = grid.length
  const cellSize = MINIMAP_SIZE / bins
  let max = 1
  for (const row of grid) for (const v of row) if (v > max) max = v
  for (let row = 0; row < bins; row++) {
    for (let col = 0; col < bins; col++) {
      const v = grid[row][col]
      if (v === 0) continue
      const alpha = Math.min(0.85, 0.15 + (v / max) * 0.7)
      ctx.fillStyle = `rgba(255, 80, 0, ${alpha})`
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
}

function drawPoint(ctx: CanvasRenderingContext2D, p: DrawPoint) {
  ctx.beginPath()
  ctx.fillStyle = MARKER_COLORS[p.kind]
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = '#000'
  ctx.stroke()
}

export function MapCanvas({ mapId, heatmap, heatmapCategory, overviewPoints, playbackFrame }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    if (heatmap && heatmapCategory && heatmapCategory !== 'off') {
      drawHeatmap(ctx, heatmap[heatmapCategory])
    }

    if (overviewPoints) {
      for (const p of overviewPoints) drawPoint(ctx, p)
    }

    if (playbackFrame) {
      for (const pos of playbackFrame.positions) {
        if (pos.trail.length > 1) {
          ctx.beginPath()
          ctx.strokeStyle = pos.isBot ? 'rgba(150,150,150,0.5)' : 'rgba(80,180,255,0.7)'
          ctx.lineWidth = pos.isBot ? 1 : 2
          ctx.moveTo(pos.trail[0].x, pos.trail[0].y)
          for (const t of pos.trail.slice(1)) ctx.lineTo(t.x, t.y)
          ctx.stroke()
        }
        ctx.beginPath()
        if (pos.isBot) {
          ctx.strokeStyle = '#aaaaaa'
          ctx.lineWidth = 2
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillStyle = '#50b4ff'
          ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      for (const p of playbackFrame.events) drawPoint(ctx, p)
    }
  }, [mapId, heatmap, heatmapCategory, overviewPoints, playbackFrame])

  return (
    <div className="map-canvas-wrap">
      <img className="map-canvas-bg" src={MAP_CONFIGS[mapId].minimapSrc} alt={`${mapId} minimap`} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />
      <canvas ref={canvasRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} className="map-canvas-overlay" />
    </div>
  )
}
```

```css
/* web/src/components/MapCanvas.css */
.map-canvas-wrap {
  position: relative;
  width: 1024px;
  height: 1024px;
  max-width: 100%;
  aspect-ratio: 1 / 1;
}

.map-canvas-bg,
.map-canvas-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.map-canvas-bg {
  object-fit: cover;
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/drawCommands.ts web/src/lib/drawCommands.test.ts web/src/components/MapCanvas.tsx web/src/components/MapCanvas.css
git commit -m "Add MapCanvas: minimap rendering with heatmap, overview points, playback"
```

---

## Task 10: Frontend — Timeline and match-playback frame computation

**Files:**
- Create: `web/src/lib/playback.ts`
- Test: `web/src/lib/playback.test.ts`
- Create: `web/src/components/Timeline.tsx`
- Create: `web/src/components/Timeline.css`

**Interfaces:**
- Consumes: `MatchEvent[]` (Task 6), `worldToPixel`/`eventsToDrawPoints` (Tasks 6, 9), `PlaybackFrame` (Task 9).
- Produces:
  - `computePlaybackFrame(events: MatchEvent[], mapId: MapId, atTs: number, trailWindowMs: number = 5000): PlaybackFrame`
  - `<Timeline>` component, props: `{ durationMs: number; currentTs: number; playing: boolean; speed: number; onSeek: (ts: number) => void; onTogglePlay: () => void; onSpeedChange: (s: number) => void }`

- [ ] **Step 1: Write the failing test**

```ts
// web/src/lib/playback.test.ts
import { describe, it, expect } from 'vitest'
import { computePlaybackFrame } from './playback'
import type { MatchEvent } from './types'

const events: MatchEvent[] = [
  { user_id: 'h1', is_bot: false, x: -370, z: -473, ts: 0, event: 'Position' },
  { user_id: 'h1', is_bot: false, x: -280, z: -400, ts: 2000, event: 'Position' },
  { user_id: 'h1', is_bot: false, x: -280, z: -400, ts: 2100, event: 'Kill' },
  { user_id: 'b1', is_bot: true, x: -300, z: -450, ts: 1000, event: 'BotPosition' },
]

describe('computePlaybackFrame', () => {
  it('places each entity at their most recent position at or before atTs', () => {
    const frame = computePlaybackFrame(events, 'AmbroseValley', 2000)
    expect(frame.positions).toHaveLength(2)
    const human = frame.positions.find((p) => !p.isBot)!
    expect(Math.round(human.x)).toBe(102)
  })

  it('excludes entities with no position sample yet at atTs', () => {
    const frame = computePlaybackFrame(events, 'AmbroseValley', 500)
    expect(frame.positions).toHaveLength(1)
    expect(frame.positions[0].isBot).toBe(false)
  })

  it('includes discrete events that have occurred by atTs and excludes later ones', () => {
    const frameBefore = computePlaybackFrame(events, 'AmbroseValley', 2000)
    expect(frameBefore.events).toHaveLength(0)
    const frameAfter = computePlaybackFrame(events, 'AmbroseValley', 2100)
    expect(frameAfter.events).toHaveLength(1)
    expect(frameAfter.events[0].kind).toBe('kill')
  })

  it('builds a trail of recent positions within the trail window', () => {
    const frame = computePlaybackFrame(events, 'AmbroseValley', 2000, 5000)
    const human = frame.positions.find((p) => !p.isBot)!
    expect(human.trail.length).toBe(2) // ts=0 and ts=2000 both within the 5000ms window
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npm run test -- playback`
Expected: FAIL — cannot find module `./playback`

- [ ] **Step 3: Implement `web/src/lib/playback.ts`**

```ts
import { worldToPixel } from './coords'
import { eventsToDrawPoints } from './drawCommands'
import type { PlaybackFrame } from '../components/MapCanvas'
import type { MapId, MatchEvent } from './types'

const POSITION_EVENTS = new Set(['Position', 'BotPosition'])

export function computePlaybackFrame(
  events: MatchEvent[],
  mapId: MapId,
  atTs: number,
  trailWindowMs: number = 5000
): PlaybackFrame {
  const byUser = new Map<string, MatchEvent[]>()
  for (const e of events) {
    if (!POSITION_EVENTS.has(e.event)) continue
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, [])
    byUser.get(e.user_id)!.push(e)
  }

  const positions: PlaybackFrame['positions'] = []
  for (const [, userEvents] of byUser) {
    const upToNow = userEvents.filter((e) => e.ts <= atTs)
    if (upToNow.length === 0) continue
    const latest = upToNow[upToNow.length - 1]
    const { x, y } = worldToPixel(latest.x, latest.z, mapId)
    const trail = upToNow
      .filter((e) => e.ts >= atTs - trailWindowMs)
      .map((e) => worldToPixel(e.x, e.z, mapId))
    positions.push({ x, y, isBot: latest.is_bot, trail })
  }

  const discreteEvents = events.filter((e) => e.ts <= atTs)
  const drawEvents = eventsToDrawPoints(discreteEvents, mapId)

  return { positions, events: drawEvents }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npm run test -- playback`
Expected: PASS (4 tests)

- [ ] **Step 5: Implement `web/src/components/Timeline.tsx`**

```tsx
import './Timeline.css'

interface TimelineProps {
  durationMs: number
  currentTs: number
  playing: boolean
  speed: number
  onSeek: (ts: number) => void
  onTogglePlay: () => void
  onSpeedChange: (s: number) => void
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Timeline({ durationMs, currentTs, playing, speed, onSeek, onTogglePlay, onSpeedChange }: TimelineProps) {
  return (
    <div className="timeline">
      <button onClick={onTogglePlay}>{playing ? 'Pause' : 'Play'}</button>
      <span className="timeline-time">{formatMs(currentTs)} / {formatMs(durationMs)}</span>
      <input
        className="timeline-scrub"
        type="range"
        min={0}
        max={durationMs}
        value={currentTs}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={4}>4x</option>
      </select>
    </div>
  )
}
```

```css
/* web/src/components/Timeline.css */
.timeline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: #1a1d23;
  color: #e6e6e6;
}

.timeline-scrub {
  flex: 1;
}

.timeline-time {
  font-variant-numeric: tabular-nums;
  min-width: 90px;
}
```

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/playback.ts web/src/lib/playback.test.ts web/src/components/Timeline.tsx web/src/components/Timeline.css
git commit -m "Add playback frame computation and Timeline scrubber component"
```

---

## Task 11: Frontend — App integration, Legend, mode switching, styling

**Files:**
- Create: `web/src/components/Legend.tsx`
- Create: `web/src/components/Legend.css`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.css`
- Modify: `web/src/index.css`

**Interfaces:**
- Consumes: everything from Tasks 6-10 (`FilterPanel`, `MapCanvas`, `Timeline`, hooks, `filterMatches`, `eventsToDrawPoints`, `computePlaybackFrame`).
- Produces: the assembled app — this is the integration point; no new exported interfaces consumed by later tasks.

- [ ] **Step 1: Implement `web/src/components/Legend.tsx`**

```tsx
import './Legend.css'

export function Legend() {
  return (
    <div className="legend">
      <div><span className="dot human" /> Human</div>
      <div><span className="dot bot" /> Bot</div>
      <div><span className="marker kill" /> Kill</div>
      <div><span className="marker death" /> Death</div>
      <div><span className="marker storm" /> Storm death</div>
      <div><span className="marker loot" /> Loot</div>
    </div>
  )
}
```

```css
/* web/src/components/Legend.css */
.legend {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  background: #1a1d23;
  color: #cfd3da;
  font-size: 12px;
  flex-wrap: wrap;
}

.legend > div {
  display: flex;
  align-items: center;
  gap: 6px;
}

.dot, .marker {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
}

.dot.human { background: #50b4ff; }
.dot.bot { background: transparent; border: 2px solid #aaaaaa; }
.marker.kill { background: #ff4d4d; }
.marker.death { background: #ffffff; }
.marker.storm { background: #b060ff; }
.marker.loot { background: #4dff88; }
```

- [ ] **Step 2: Implement `web/src/App.tsx`**

```tsx
import { useMemo, useState, useEffect, useRef } from 'react'
import { FilterPanel } from './components/FilterPanel'
import { MapCanvas } from './components/MapCanvas'
import { Timeline } from './components/Timeline'
import { Legend } from './components/Legend'
import { useMatchesIndex } from './hooks/useMatchesIndex'
import { useMatchBundle } from './hooks/useMatchBundle'
import { useHeatmap } from './hooks/useHeatmap'
import { filterMatches } from './lib/filterMatches'
import { eventsToDrawPoints } from './lib/drawCommands'
import { computePlaybackFrame } from './lib/playback'
import type { EventType, HeatmapCategory, MapId } from './lib/types'
import './App.css'

const ALL_EVENT_TYPES: EventType[] = ['Kill', 'Killed', 'BotKill', 'BotKilled', 'KilledByStorm', 'Loot']

export default function App() {
  const { data: index, loading: indexLoading } = useMatchesIndex()
  const [mapId, setMapId] = useState<MapId>('AmbroseValley')
  const [date, setDate] = useState<string | null>(null)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [entityFilter, setEntityFilter] = useState<'all' | 'humans' | 'bots'>('all')
  const [eventTypeFilter, setEventTypeFilter] = useState<Set<EventType>>(new Set(ALL_EVENT_TYPES))
  const [heatmapCategory, setHeatmapCategory] = useState<HeatmapCategory | 'off'>('kills')

  const { data: heatmap } = useHeatmap(matchId ? null : mapId)
  const { data: matchEvents } = useMatchBundle(matchId)

  const [currentTs, setCurrentTs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)

  const durationMs = useMemo(() => {
    if (!matchId || !index) return 0
    return index.find((m) => m.match_id === matchId)?.duration_ms ?? 0
  }, [matchId, index])

  useEffect(() => {
    setCurrentTs(0)
    setPlaying(false)
  }, [matchId])

  useEffect(() => {
    if (!playing) {
      lastFrameTimeRef.current = null
      return
    }
    const tick = (now: number) => {
      if (lastFrameTimeRef.current != null) {
        const delta = (now - lastFrameTimeRef.current) * speed
        setCurrentTs((t) => Math.min(durationMs, t + delta))
      }
      lastFrameTimeRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speed, durationMs])

  useEffect(() => {
    if (currentTs >= durationMs && durationMs > 0) setPlaying(false)
  }, [currentTs, durationMs])

  const overviewPoints = useMemo(() => {
    if (matchId || !index) return undefined
    const scoped = filterMatches(index, mapId, date)
    void scoped // overview points are computed from heatmap-scale event scatter in a future iteration;
    // for now, overview relies on the heatmap layer for spatial density and match list for browsing.
    return []
  }, [matchId, index, mapId, date])

  const playbackFrame = useMemo(() => {
    if (!matchId || !matchEvents) return null
    let scoped = matchEvents
    if (entityFilter === 'humans') scoped = scoped.filter((e) => !e.is_bot)
    if (entityFilter === 'bots') scoped = scoped.filter((e) => e.is_bot)
    // Position/BotPosition always pass through (needed to place the dots each frame);
    // discrete event types are gated by the eventTypeFilter checkboxes.
    scoped = scoped.filter((e) => e.event === 'Position' || e.event === 'BotPosition' || eventTypeFilter.has(e.event))
    return computePlaybackFrame(scoped, mapId, currentTs)
  }, [matchId, matchEvents, mapId, currentTs, entityFilter, eventTypeFilter])

  if (indexLoading || !index) {
    return <div className="app-loading">Loading match data…</div>
  }

  return (
    <div className="app">
      <FilterPanel
        index={index}
        mapId={mapId}
        date={date}
        matchId={matchId}
        entityFilter={entityFilter}
        eventTypeFilter={eventTypeFilter}
        heatmapCategory={heatmapCategory}
        onMapChange={(m) => { setMapId(m); setDate(null); setMatchId(null) }}
        onDateChange={(d) => { setDate(d); setMatchId(null) }}
        onMatchChange={setMatchId}
        onEntityFilterChange={setEntityFilter}
        onEventTypeToggle={(e) => setEventTypeFilter((prev) => {
          const next = new Set(prev)
          if (next.has(e)) next.delete(e); else next.add(e)
          return next
        })}
        onHeatmapCategoryChange={setHeatmapCategory}
      />
      <main className="app-main">
        <Legend />
        <div className="app-canvas-area">
          <MapCanvas
            mapId={mapId}
            heatmap={heatmap}
            heatmapCategory={matchId ? 'off' : heatmapCategory}
            overviewPoints={overviewPoints ? eventsToDrawPoints(overviewPoints, mapId) : undefined}
            playbackFrame={playbackFrame}
          />
        </div>
        {matchId && (
          <Timeline
            durationMs={durationMs}
            currentTs={currentTs}
            playing={playing}
            speed={speed}
            onSeek={setCurrentTs}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSpeedChange={setSpeed}
          />
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Implement `web/src/App.css`**

```css
.app {
  display: flex;
  height: 100vh;
  background: #0e0f12;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-canvas-area {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: auto;
  padding: 16px;
}

.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  color: #cfd3da;
  background: #0e0f12;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 4: Simplify `web/src/index.css`**

Replace the Vite default template CSS with:

```css
* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #0e0f12;
  color: #e6e6e6;
}
```

- [ ] **Step 5: Remove unused Vite template assets**

Run: `cd web && rm -f src/App.tsx.orig public/vite.svg src/assets/react.svg 2>/dev/null; true`

(This is best-effort cleanup — skip any file that doesn't exist.)

- [ ] **Step 6: Run the full test suite and build**

Run: `cd web && npm run test && npm run build`
Expected: all tests PASS; build succeeds with no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add web/src/App.tsx web/src/App.css web/src/index.css web/src/components/Legend.tsx web/src/components/Legend.css
git commit -m "Integrate App: mode switching, playback loop, legend, styling"
```

---

## Task 12: Frontend — build a real Overview-mode event scatter (fix Task 11's stub)

Task 11 stubbed `overviewPoints` to an empty array because Overview mode needs per-event coordinates scoped by map+date across potentially many matches, which `matches_index.json` doesn't carry (it only has counts). This task adds a lightweight overview-events dataset from the pipeline and wires it in properly.

**Files:**
- Modify: `scripts/preprocess.py`
- Modify: `scripts/lib/aggregate.py`
- Modify: `scripts/tests/test_aggregate.py`
- Modify: `web/src/lib/dataClient.ts`
- Modify: `web/src/lib/dataClient.test.ts`
- Modify: `web/src/hooks/useMatchesIndex.ts` → add `web/src/hooks/useOverviewEvents.ts`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Produces (Python): `build_overview_events(events: pd.DataFrame) -> dict[str, list[dict]]` — keyed by `map_id`, each entry a list of `{date, x, z, event, is_bot}` for the 4 discrete event categories only (Position/BotPosition excluded — heatmap already covers traffic density).
- Produces (TS): `fetchOverviewEvents(mapId: MapId): Promise<OverviewEvent[]>`, `useOverviewEvents(mapId: MapId): { data: OverviewEvent[] | null; loading: boolean; error: Error | null }`, type `OverviewEvent = { date: string; x: number; z: number; event: EventType; is_bot: boolean }`.
- Output file: `web/public/data/overview_events/<map_id>.json`.

- [ ] **Step 1: Add a failing test for `build_overview_events`**

Append to `scripts/tests/test_aggregate.py`:

```python
from lib.aggregate import build_overview_events

def test_build_overview_events_excludes_position_and_groups_by_map():
    events = pd.DataFrame([
        {"user_id": "h1", "match_id": "m1", "map_id": "AmbroseValley", "x": 1.0, "z": 1.0, "ts_ms": 1000, "event": "Position", "is_bot": False, "date": "2026-02-10"},
        {"user_id": "h1", "match_id": "m1", "map_id": "AmbroseValley", "x": 2.0, "z": 2.0, "ts_ms": 2000, "event": "Kill", "is_bot": False, "date": "2026-02-10"},
        {"user_id": "b1", "match_id": "m2", "map_id": "GrandRift", "x": 3.0, "z": 3.0, "ts_ms": 3000, "event": "BotKilled", "is_bot": True, "date": "2026-02-11"},
    ])
    result = build_overview_events(events)
    assert set(result.keys()) == {"AmbroseValley", "GrandRift"}
    assert len(result["AmbroseValley"]) == 1
    assert result["AmbroseValley"][0]["event"] == "Kill"
    assert result["GrandRift"][0]["is_bot"] is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_aggregate.py -v -k overview_events`
Expected: FAIL — `ImportError: cannot import name 'build_overview_events'`

- [ ] **Step 3: Implement in `scripts/lib/aggregate.py`**

Add to the bottom of the file:

```python
DISCRETE_EVENTS = KILL_EVENTS | DEATH_EVENTS | STORM_EVENTS | LOOT_EVENTS


def build_overview_events(events: pd.DataFrame) -> dict[str, list[dict]]:
    discrete = events[events["event"].isin(DISCRETE_EVENTS)]
    result: dict[str, list[dict]] = {}
    for map_id, g in discrete.groupby("map_id"):
        result[map_id] = g[["date", "x", "z", "event", "is_bot"]].to_dict("records")
    return result
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 -m pytest scripts/tests/test_aggregate.py -v`
Expected: PASS (all tests in file, including the new one)

- [ ] **Step 5: Wire into `scripts/preprocess.py`**

Add the import: `from lib.aggregate import build_matches_index, build_match_bundle, build_overview_events`

In `run()`, after the heatmap-writing block, add:

```python
    overview_dir = data_dir / "overview_events"
    overview_dir.mkdir(parents=True, exist_ok=True)
    overview = build_overview_events(events)
    for map_id, event_list in overview.items():
        (overview_dir / f"{map_id}.json").write_text(json.dumps(event_list))
    print(f"Wrote overview events for {len(overview)} maps")
```

- [ ] **Step 6: Re-run the pipeline on real data**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 scripts/preprocess.py`
Expected: completes; `web/public/data/overview_events/*.json` (3 files) now exist.

- [ ] **Step 7: Add the failing frontend test**

Append to `web/src/lib/dataClient.test.ts`:

```ts
it('fetches overview events for a map', async () => {
  ;(fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ date: '2026-02-10' }] })
  const result = await fetchOverviewEvents('AmbroseValley')
  expect(fetch).toHaveBeenCalledWith('/data/overview_events/AmbroseValley.json')
  expect(result).toEqual([{ date: '2026-02-10' }])
})
```

Add the import at the top: `import { fetchMatchesIndex, fetchMatchBundle, fetchHeatmap, fetchOverviewEvents } from './dataClient'`

- [ ] **Step 8: Run to verify it fails**

Run: `cd web && npm run test -- dataClient`
Expected: FAIL — `fetchOverviewEvents` is not exported

- [ ] **Step 9: Implement in `web/src/lib/dataClient.ts` and add the type**

Add to `web/src/lib/types.ts`:
```ts
export interface OverviewEvent {
  date: string
  x: number
  z: number
  event: EventType
  is_bot: boolean
}
```

Add to `web/src/lib/dataClient.ts`:
```ts
import type { MapId, MatchIndexEntry, MatchEvent, HeatmapGrids, OverviewEvent } from './types'
// (extend the existing type import line above instead of duplicating it)

export function fetchOverviewEvents(mapId: MapId): Promise<OverviewEvent[]> {
  return getJson(`/data/overview_events/${mapId}.json`)
}
```

- [ ] **Step 10: Run to verify it passes**

Run: `cd web && npm run test -- dataClient`
Expected: PASS (5 tests)

- [ ] **Step 11: Add `web/src/hooks/useOverviewEvents.ts`**

```ts
import { useEffect, useState } from 'react'
import { fetchOverviewEvents } from '../lib/dataClient'
import type { MapId, OverviewEvent } from '../lib/types'

export function useOverviewEvents(mapId: MapId) {
  const [data, setData] = useState<OverviewEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchOverviewEvents(mapId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [mapId])

  return { data, loading, error }
}
```

- [ ] **Step 12: Wire into `web/src/App.tsx`**

Add the import: `import { useOverviewEvents } from './hooks/useOverviewEvents'`

Add the hook call near the other hooks: `const { data: overviewEvents } = useOverviewEvents(mapId)`

Replace the `overviewPoints` `useMemo` block with:

```tsx
  const overviewPoints = useMemo(() => {
    if (matchId || !overviewEvents) return []
    let scoped = overviewEvents.filter((e) => (date ? e.date === date : true))
    if (entityFilter === 'humans') scoped = scoped.filter((e) => !e.is_bot)
    if (entityFilter === 'bots') scoped = scoped.filter((e) => e.is_bot)
    scoped = scoped.filter((e) => eventTypeFilter.has(e.event))
    return eventsToDrawPoints(scoped, mapId)
  }, [matchId, overviewEvents, date, entityFilter, eventTypeFilter, mapId])
```

Update the `<MapCanvas>` usage to pass `overviewPoints={overviewPoints}` directly (it's already `DrawPoint[]`, not raw events — remove the old `eventsToDrawPoints(overviewPoints, mapId)` call at the call site since that's now done inside the memo).

- [ ] **Step 13: Run full frontend test suite and build**

Run: `cd web && npm run test && npm run build`
Expected: PASS, build succeeds.

- [ ] **Step 14: Commit**

```bash
git add scripts/lib/aggregate.py scripts/tests/test_aggregate.py scripts/preprocess.py web/src/lib/ web/src/hooks/useOverviewEvents.ts web/src/App.tsx web/public/data/overview_events
git commit -m "Add Overview mode event scatter: per-map discrete event data + wiring"
```

---

## Task 13: Local smoke test in a real browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run (background): `cd web && npm run dev`
Note the local URL (typically `http://localhost:5173`).

- [ ] **Step 2: Visually verify Overview mode**

Using Chrome browser automation: navigate to the dev URL. Confirm: minimap loads for the default map, filter panel is visible and populated (dates, match dropdown with real match IDs/counts), heatmap renders with visible hot zones, switching the heatmap category changes the overlay, switching maps swaps the minimap image and heatmap.

- [ ] **Step 3: Visually verify Match Playback mode**

Select a match from the dropdown. Confirm: dots appear on the minimap positioned plausibly within the map bounds (not clustered at 0,0 or off-image — this is the key coordinate-mapping correctness check), humans and bots are visually distinct, pressing Play advances the timeline and dots move, event markers (especially Kill/Death/Loot/Storm if that match has any) appear at the right moments, scrubbing the timeline jumps positions correctly, entity and event-type filters change what's shown.

- [ ] **Step 4: Check the browser console for errors**

Use `read_console_messages` to confirm no uncaught errors/warnings during the above interactions.

- [ ] **Step 5: Fix any issues found**

If coordinates look wrong (e.g., all points at a corner or off-screen), re-check `worldToPixel` against the README's worked example and the actual `map_id` being used — a common bug class here is mismatching a match's `map_id` against the wrong `MAP_CONFIGS` entry. Fix and re-verify before proceeding; do not move to Task 14 with a visibly broken coordinate mapping.

- [ ] **Step 6: Stop the dev server**

Run: `kill %1` or stop the background process started in Step 1.

(No commit — this task produces no file changes unless Step 5 found a bug, in which case commit that fix with an explicit message describing what was wrong.)

---

## Task 14: Documentation — README.md and ARCHITECTURE.md

**Files:**
- Create: `README.md`
- Create: `ARCHITECTURE.md`

**Interfaces:** none — pure documentation, content drawn from the spec (`docs/superpowers/specs/2026-09-22-player-journey-viz-design.md`) and the actual implementation from Tasks 1-13.

- [ ] **Step 1: Write `README.md`**

Cover: what the tool is (one paragraph), tech stack (Python preprocessing: pandas/pyarrow/Pillow; frontend: Vite/React/TypeScript, no backend), setup steps (`python3 -m venv scripts/.venv && scripts/.venv/bin/pip install -r scripts/requirements.txt`, run `scripts/preprocess.py --input <path-to-player_data>` to regenerate data, `cd web && npm install && npm run dev`), env vars (none — static site), how to run tests (`scripts/.venv/bin/python3 -m pytest scripts/tests/`, `cd web && npm run test`), the deployed URL (filled in after Task 16), and a short "what to click first" walkthrough (pick a map → pick a date → either leave Match on "Overview" to see the heatmap, or pick a match to watch it play back).

- [ ] **Step 2: Write `ARCHITECTURE.md`**

One page, sections: What I built with and why (static site, no backend — dataset is small enough that a database adds cost without benefit); Data flow diagram in prose (parquet → `preprocess.py` → static JSON/compressed images in `web/public` → React fetches → Canvas renders); Coordinate mapping walkthrough (state the formula, the per-map config table, and the worked example, explicitly noting this was taken directly from the source data's README and verified with a unit test in `web/src/lib/coords.test.ts`); Assumptions (the 4 bullets from the spec's Assumptions section — heatmaps not date-filterable, `y` dropped, raw parquet not committed, bot detection is UUID-format-based); Tradeoffs table (Static site vs backend API; Precomputed heatmap grids vs client-side aggregation; Per-match JSON lazy-loading vs one giant bundle — each with the alternative considered and why the chosen approach won).

- [ ] **Step 3: Commit**

```bash
git add README.md ARCHITECTURE.md
git commit -m "Add README and ARCHITECTURE docs"
```

---

## Task 15: Documentation — INSIGHTS.md (data-driven findings)

**Files:**
- Create: `scripts/analyze_insights.py` (throwaway analysis script, still committed for reproducibility)
- Create: `INSIGHTS.md`

**Interfaces:**
- Consumes: `web/public/data/matches_index.json`, `web/public/data/heatmaps/*.json`, `web/public/data/overview_events/*.json` (all already on disk from Task 12's pipeline run).

- [ ] **Step 1: Write `scripts/analyze_insights.py`**

```python
import json
from pathlib import Path
from collections import Counter

DATA = Path(__file__).parent.parent / "web" / "public" / "data"

index = json.loads((DATA / "matches_index.json").read_text())

print("=== Match counts per map ===")
print(Counter(m["map_id"] for m in index))

print("\n=== Avg human/bot counts per map ===")
by_map = {}
for m in index:
    by_map.setdefault(m["map_id"], []).append(m)
for map_id, matches in by_map.items():
    avg_h = sum(x["human_count"] for x in matches) / len(matches)
    avg_b = sum(x["bot_count"] for x in matches) / len(matches)
    print(f"{map_id}: avg humans={avg_h:.1f}, avg bots={avg_b:.1f}, matches={len(matches)}")

print("\n=== Storm death share per map ===")
for map_id, matches in by_map.items():
    total_deaths = sum(x["deaths"] + x["storm_deaths"] for x in matches)
    total_storm = sum(x["storm_deaths"] for x in matches)
    pct = (total_storm / total_deaths * 100) if total_deaths else 0
    print(f"{map_id}: {pct:.1f}% of deaths are storm deaths ({total_storm}/{total_deaths})")

print("\n=== Heatmap hotspot concentration per map (kills) ===")
for map_id in by_map:
    grid = json.loads((DATA / "heatmaps" / f"{map_id}.json").read_text())["kills"]
    flat = sorted((v for row in grid for v in row if v > 0), reverse=True)
    total = sum(flat)
    top10 = sum(flat[:10])
    pct = (top10 / total * 100) if total else 0
    print(f"{map_id}: top 10 cells (of {len(flat)} occupied) hold {pct:.1f}% of all kills")

print("\n=== Match duration distribution ===")
for map_id, matches in by_map.items():
    durations = sorted(x["duration_ms"] / 1000 for x in matches)
    mid = durations[len(durations) // 2]
    print(f"{map_id}: median duration {mid:.0f}s, min {durations[0]:.0f}s, max {durations[-1]:.0f}s")
```

- [ ] **Step 2: Run it and read the output**

Run: `cd /Users/shivam-modi/Documents/works/lilagames && scripts/.venv/bin/python3 scripts/analyze_insights.py`

Read the actual printed numbers — these are the real inputs to Step 3, not filled in from guesswork.

- [ ] **Step 3: Write `INSIGHTS.md` from the real output**

Structure: three insights, each with **What caught my eye**, **Evidence** (the actual stat/pattern from Step 2's output — quote real numbers, don't invent any), **Actionable** (what a level designer/game designer could change, and what metric it would move), **Why a level designer should care**.

Candidate angles to pull from the real numbers (use whichever three are actually most striking in the Step 2 output — do not force a narrative that the data doesn't support):
1. Kill/death hotspot concentration on one map vs another (from the "top 10 cells hold X%" output) — implies chokepoints or landing-zone clustering.
2. Storm-death share differing meaningfully between maps — implies storm timing/pacing tuned differently, or players on one map struggle more to outrun it.
3. Match duration or human/bot ratio differences between maps — implies one map plays faster/slower or is more bot-heavy, affecting perceived difficulty.

If the real numbers don't support one of these three, substitute with whatever the Step 2 output actually shows (e.g., a specific map having near-zero loot events recorded, or one map's traffic heatmap being extremely concentrated vs spread out — check the `traffic` category output too if needed by extending the script). The requirement is three insights backed by real numbers from this dataset, not these three specific topics.

- [ ] **Step 4: Commit**

```bash
git add scripts/analyze_insights.py INSIGHTS.md
git commit -m "Add data-driven insights analysis and INSIGHTS.md"
```

---

## Task 16: GitHub repo creation and push

**Files:** none (repo/remote operations only)

- [ ] **Step 1: Create the GitHub repo**

Run: `gh repo create lila-player-journey-viz --public --source=. --remote=origin --description "Player journey visualization tool for LILA BLACK telemetry"`

(If the user prefers a different repo name or private visibility, confirm before running — default to public since the assignment requires a shareable repo link reviewers can open without an invite.)

- [ ] **Step 2: Push**

Run: `git push -u origin main`

- [ ] **Step 3: Verify**

Run: `gh repo view --web=false` and confirm the repo URL is reachable: `gh api repos/{owner}/lila-player-journey-viz --jq .html_url`

---

## Task 17: Vercel deployment

**Files:**
- Create: `web/vercel.json` (if needed for SPA routing/static config)

- [ ] **Step 1: Check for Vercel auth**

Run: `npx vercel whoami`
If not logged in, tell the user: "Run `vercel login` in your terminal (interactive browser auth) — I can't do this step for you. Let me know once you're logged in."

- [ ] **Step 2: Deploy**

Run (once authenticated): `cd web && npx vercel --prod --yes`
This should auto-detect the Vite project (build command `npm run build`, output dir `dist`). Confirm the returned production URL.

- [ ] **Step 3: Smoke-test the deployed URL**

Using Chrome browser automation: navigate to the production URL, confirm the app loads, a minimap renders, and selecting a match plays back correctly (same checks as Task 13, on the live deployment — this catches static-asset-path issues that only show up in production builds).

- [ ] **Step 4: Update README.md with the live URL**

Fill in the "Deployed URL" line left open in Task 14.

Run:
```bash
git add README.md
git commit -m "Add live deployment URL to README"
git push
```

---

## Final check against the assignment's submission checklist

After Task 17, re-read the original assignment's checklist and confirm each item against the actual running deployment and repo (not from memory): tool live at hosted URL; player paths render correctly on the minimap; humans visually distinct from bots; kill/death/loot/storm events marked; map/date/match filtering works; timeline/playback works; heatmaps show kill/death/traffic zones; ARCHITECTURE.md covers coordinate mapping; INSIGHTS.md has three insights with real supporting evidence; README covers setup end-to-end for someone with zero prior context.
