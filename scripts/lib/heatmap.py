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
                # Y is flipped, matching the frontend's worldToPixel (image
                # origin is top-left, same as the source README's formula).
                col = min(max(int(u * bins), 0), bins - 1)
                row = min(max(int((1 - v) * bins), 0), bins - 1)
                grids[map_id][cat][row][col] += 1
    return grids
