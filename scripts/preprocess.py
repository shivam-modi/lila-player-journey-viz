import argparse
import json
from pathlib import Path

from lib.parse import load_all_events
from lib.aggregate import build_matches_index, build_match_bundle, build_overview_events
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
    overview_dir = data_dir / "overview_events"
    minimaps_dir = output_root / "minimaps"
    for d in (matches_dir, heatmaps_dir, overview_dir, minimaps_dir):
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

    overview = build_overview_events(events)
    for map_id, event_list in overview.items():
        (overview_dir / f"{map_id}.json").write_text(json.dumps(event_list))
    print(f"Wrote overview events for {len(overview)} maps")

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
