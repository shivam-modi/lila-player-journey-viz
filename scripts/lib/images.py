from pathlib import Path

from PIL import Image


def compress_minimap(src: Path, dst: Path, max_bytes: int = 1_500_000) -> None:
    img = Image.open(src).convert("RGB")
    quality = 90
    dst.parent.mkdir(parents=True, exist_ok=True)
    while quality >= 30:
        img.save(dst, "JPEG", quality=quality, optimize=True)
        if dst.stat().st_size <= max_bytes:
            return
        quality -= 10
