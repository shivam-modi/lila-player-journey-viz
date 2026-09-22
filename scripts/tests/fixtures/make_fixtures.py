"""Generates tiny synthetic parquet fixtures matching the production schema.
Run once: scripts/.venv/bin/python3 scripts/tests/fixtures/make_fixtures.py
"""
import pyarrow as pa
import pyarrow.parquet as pq
from pathlib import Path

FIXTURES = Path(__file__).parent

def make_human_file():
    table = pa.table({
        "user_id": ["f4e072fa-b7af-4761-b567-1d95b7ad0108"] * 3,
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
