import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import pandas as pd
from lib.aggregate import build_matches_index, build_match_bundle, build_overview_events

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
