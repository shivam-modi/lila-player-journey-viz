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
