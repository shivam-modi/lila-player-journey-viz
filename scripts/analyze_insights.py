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

print("\n=== Heatmap hotspot concentration per map (traffic) ===")
for map_id in by_map:
    grid = json.loads((DATA / "heatmaps" / f"{map_id}.json").read_text())["traffic"]
    flat = sorted((v for row in grid for v in row if v > 0), reverse=True)
    total = sum(flat)
    top10 = sum(flat[:10])
    occupied_pct = len(flat) / (len(grid) * len(grid)) * 100
    pct = (top10 / total * 100) if total else 0
    print(f"{map_id}: {occupied_pct:.1f}% of map cells ever visited; top 10 cells hold {pct:.1f}% of all traffic")

print("\n=== Match duration distribution ===")
for map_id, matches in by_map.items():
    durations = sorted(x["duration_ms"] / 1000 for x in matches)
    mid = durations[len(durations) // 2]
    print(f"{map_id}: median duration {mid:.1f}s, min {durations[0]:.1f}s, max {durations[-1]:.1f}s")

print("\n=== Loot events per match ===")
for map_id, matches in by_map.items():
    avg_loot = sum(x["loot"] for x in matches) / len(matches)
    print(f"{map_id}: avg loot events per match = {avg_loot:.1f}")

print("\n=== Kills per match ===")
for map_id, matches in by_map.items():
    avg_kills = sum(x["kills"] for x in matches) / len(matches)
    zero_kill_matches = sum(1 for x in matches if x["kills"] == 0)
    print(f"{map_id}: avg kills/match={avg_kills:.2f}, matches with 0 kills={zero_kill_matches}/{len(matches)}")
