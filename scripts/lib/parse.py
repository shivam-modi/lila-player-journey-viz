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
    skipped: list[str] = []
    for day_folder, date in DAY_FOLDER_TO_DATE.items():
        day_dir = root / day_folder
        if not day_dir.is_dir():
            continue
        for file_path in day_dir.glob("*.nakama-0"):
            try:
                df = read_events(file_path)
            except Exception as e:
                skipped.append(f"{file_path.name}: {e}")
                continue
            df["date"] = date
            frames.append(df)

    if skipped:
        print(f"WARNING: skipped {len(skipped)} unreadable file(s):")
        for s in skipped[:20]:
            print(f"  - {s}")
        if len(skipped) > 20:
            print(f"  ... and {len(skipped) - 20} more")

    if not frames:
        return pd.DataFrame(
            columns=["user_id", "match_id", "map_id", "x", "z", "ts_ms", "event", "is_bot", "date"]
        )
    return pd.concat(frames, ignore_index=True)
