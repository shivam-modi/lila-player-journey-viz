import pandas as pd

KILL_EVENTS = {"Kill", "BotKill"}
DEATH_EVENTS = {"Killed", "BotKilled"}
STORM_EVENTS = {"KilledByStorm"}
LOOT_EVENTS = {"Loot"}
DISCRETE_EVENTS = KILL_EVENTS | DEATH_EVENTS | STORM_EVENTS | LOOT_EVENTS


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


def build_overview_events(events: pd.DataFrame) -> dict[str, list[dict]]:
    discrete = events[events["event"].isin(DISCRETE_EVENTS)]
    result: dict[str, list[dict]] = {}
    for map_id, g in discrete.groupby("map_id"):
        result[map_id] = g[["date", "x", "z", "event", "is_bot"]].to_dict("records")
    return result
