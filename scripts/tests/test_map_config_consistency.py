import re
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from lib.heatmap import MAP_CONFIGS as PYTHON_MAP_CONFIGS

TS_CONFIG_PATH = Path(__file__).parent.parent.parent / "web" / "src" / "lib" / "mapConfig.ts"


def _parse_ts_map_configs() -> dict[str, dict[str, float]]:
    text = TS_CONFIG_PATH.read_text()
    configs = {}
    pattern = re.compile(
        r"(\w+):\s*\{\s*scale:\s*(-?\d+(?:\.\d+)?)\s*,\s*originX:\s*(-?\d+(?:\.\d+)?)\s*,\s*originZ:\s*(-?\d+(?:\.\d+)?)"
    )
    for match in pattern.finditer(text):
        map_id, scale, origin_x, origin_z = match.groups()
        configs[map_id] = {
            "scale": float(scale),
            "originX": float(origin_x),
            "originZ": float(origin_z),
        }
    return configs


def test_python_and_typescript_map_configs_agree():
    # scripts/lib/heatmap.py and web/src/lib/mapConfig.ts each hardcode the
    # same per-map scale/origin values independently (Python for heatmap
    # binning, TypeScript for on-screen coordinates). Nothing else forces
    # them to stay in sync -- this test is that check. If it ever fails,
    # one side was edited (e.g. adding a 4th map) without the other.
    ts_configs = _parse_ts_map_configs()
    assert set(ts_configs.keys()) == set(PYTHON_MAP_CONFIGS.keys()), (
        "Python (scripts/lib/heatmap.py) and TypeScript (web/src/lib/mapConfig.ts) "
        "define different sets of maps."
    )
    for map_id, py_cfg in PYTHON_MAP_CONFIGS.items():
        ts_cfg = ts_configs[map_id]
        assert ts_cfg["scale"] == py_cfg["scale"], f"{map_id} scale differs: py={py_cfg['scale']} ts={ts_cfg['scale']}"
        assert ts_cfg["originX"] == py_cfg["originX"], f"{map_id} originX differs: py={py_cfg['originX']} ts={ts_cfg['originX']}"
        assert ts_cfg["originZ"] == py_cfg["originZ"], f"{map_id} originZ differs: py={py_cfg['originZ']} ts={ts_cfg['originZ']}"
