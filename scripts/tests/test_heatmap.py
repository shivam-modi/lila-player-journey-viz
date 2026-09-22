import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from lib.heatmap import world_to_uv, build_heatmap_grids, MAP_CONFIGS

def test_world_to_uv_matches_readme_worked_example():
    u, v = world_to_uv(-301.45, -355.55, "AmbroseValley")
    assert round(u, 4) == 0.0762
    assert round(v, 4) == 0.1305

def test_build_heatmap_grids_applies_same_y_flip_as_the_frontend_renderer():
    # World origin (u=0, v=0) must land in the LAST grid row (bottom of the
    # image), matching worldToPixel's `pixelY = (1 - v) * MINIMAP_SIZE`
    # convention used for every point marker drawn on the same canvas.
    # A plain `row = v * bins` (no flip) would put it in row 0 (the top)
    # instead, silently mirroring the heatmap vertically relative to every
    # other overlay -- this is a real regression this test caught once.
    events = pd.DataFrame([
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Kill"},   # u=0, v=0
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Killed"},
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "KilledByStorm"},
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Loot"},
        {"map_id": "AmbroseValley", "x": -370.0, "z": -473.0, "event": "Position"},
    ])
    grids = build_heatmap_grids(events, bins=10)
    ambrose = grids["AmbroseValley"]
    assert ambrose["kills"][9][0] == 1
    assert ambrose["deaths"][9][0] == 1
    assert ambrose["storm_deaths"][9][0] == 1
    assert ambrose["loot"][9][0] == 1
    assert ambrose["traffic"][9][0] == 1
    assert ambrose["kills"][0][0] == 0  # must NOT be in the top row
    assert sum(sum(row) for row in ambrose["kills"]) == 1  # only one cell touched

def test_build_heatmap_grids_readme_worked_example_lands_in_bottom_region():
    # x=-301.45, z=-355.55 on AmbroseValley -> u=0.0762, v=0.1305 (the source
    # README's own worked example), which worldToPixel places at pixel
    # (78, 890) on a 1024px image -- the bottom ~13%. The heatmap bin for the
    # exact same point must land in the bottom ~13% of the grid, row 86 of
    # 100 ((1 - 0.1305) * 100), not row 13 (0.1305 * 100, the unflipped bug).
    events = pd.DataFrame([
        {"map_id": "AmbroseValley", "x": -301.45, "z": -355.55, "event": "Kill"},
    ])
    grids = build_heatmap_grids(events, bins=100)
    grid = grids["AmbroseValley"]["kills"]
    row, col = next((r, c) for r in range(100) for c in range(100) if grid[r][c] == 1)
    assert row == 86
    assert col == 7

def test_build_heatmap_grids_covers_all_three_maps():
    events = pd.DataFrame([
        {"map_id": "GrandRift", "x": -290.0, "z": -290.0, "event": "Kill"},
    ])
    grids = build_heatmap_grids(events, bins=10)
    assert set(grids.keys()) == set(MAP_CONFIGS.keys())
