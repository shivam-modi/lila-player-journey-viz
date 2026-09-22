import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from PIL import Image
from lib.images import compress_minimap

def test_compress_minimap_shrinks_file_and_preserves_dimensions(tmp_path):
    src = tmp_path / "src.png"
    Image.new("RGB", (1024, 1024), color=(120, 130, 140)).save(src)
    dst = tmp_path / "out.jpg"

    compress_minimap(src, dst, max_bytes=200_000)

    assert dst.exists()
    assert dst.stat().st_size <= 200_000
    with Image.open(dst) as img:
        assert img.size == (1024, 1024)
