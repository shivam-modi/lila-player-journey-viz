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
