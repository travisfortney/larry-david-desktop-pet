#!/usr/bin/env python3
"""Build compact browser sprites from the preserved artwork."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
assets = root / "web/assets"
for source in sorted((root / "qa/sources/web").glob("*.webp")):
    with Image.open(source) as image:
        image.convert("RGBA").save(assets / source.name, quality=90, method=6, alpha_quality=100)
with Image.open(assets / "larry.webp") as wave:
    wave.seek(0)
    wave.convert("RGBA").save(assets / "larry-still.png", optimize=True)
