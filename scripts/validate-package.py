#!/usr/bin/env python3
import json
import pathlib
import struct
import sys

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
PET_JSON = ROOT / "pet" / "pet.json"
SPRITESHEET = ROOT / "pet" / "spritesheet.webp"
CONTACT_SHEET = ROOT / "qa" / "contact-sheet.png"
DIRECTION_SHEET = ROOT / "qa" / "look-directions.png"
PREVIEW_DIR = ROOT / "qa" / "previews"

EXPECTED_PREVIEWS = {
    "idle.gif",
    "running-right.gif",
    "running-left.gif",
    "waving.gif",
    "jumping.gif",
    "failed.gif",
    "waiting.gif",
    "running.gif",
    "review.gif",
}

STATE_ROWS = (
    "idle",
    "running-right",
    "running-left",
    "waving",
    "jumping",
    "failed",
    "waiting",
    "running",
    "review",
    "look-000-to-157.5",
    "look-180-to-337.5",
)
CELL_HEIGHT = 208
CELL_WIDTH = 192
FRAME_COUNTS = (6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8)
FRINGE_PIXEL_LIMIT = 250


def fail(message):
    print(f"validate-package: {message}", file=sys.stderr)
    sys.exit(1)


def read_webp_size(path):
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        fail(f"{path.relative_to(ROOT)} is not a WebP file")

    offset = 12
    while offset + 8 <= len(data):
        chunk = data[offset : offset + 4]
        size = struct.unpack_from("<I", data, offset + 4)[0]
        payload = offset + 8

        if chunk == b"VP8X" and payload + 10 <= len(data):
            width = 1 + int.from_bytes(data[payload + 4 : payload + 7], "little")
            height = 1 + int.from_bytes(data[payload + 7 : payload + 10], "little")
            return width, height

        if chunk == b"VP8 " and payload + 10 <= len(data):
            width = struct.unpack_from("<H", data, payload + 6)[0] & 0x3FFF
            height = struct.unpack_from("<H", data, payload + 8)[0] & 0x3FFF
            return width, height

        if chunk == b"VP8L" and payload + 5 <= len(data):
            bits = int.from_bytes(data[payload + 1 : payload + 5], "little")
            width = 1 + (bits & 0x3FFF)
            height = 1 + ((bits >> 14) & 0x3FFF)
            return width, height

        offset += 8 + size + (size % 2)

    fail(f"could not read dimensions from {path.relative_to(ROOT)}")


def read_png_size(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        fail(f"{path.relative_to(ROOT)} is not a PNG file")
    return struct.unpack(">II", data[16:24])


def validate_colored_fringe(path):
    with Image.open(path) as image:
        rgba = image.convert("RGBA")

    for row, state in enumerate(STATE_ROWS):
        strip = rgba.crop((0, row * CELL_HEIGHT, rgba.width, (row + 1) * CELL_HEIGHT))
        magenta_pixels = 0
        green_pixels = 0
        for red, green, blue, alpha in strip.get_flattened_data():
            if alpha < 16:
                continue
            if red >= 180 and blue >= 160 and green <= 130:
                magenta_pixels += 1
            if green >= 150 and green >= red * 1.5 and green >= blue * 1.5:
                green_pixels += 1

        if magenta_pixels > FRINGE_PIXEL_LIMIT:
            fail(f"{state} has {magenta_pixels} magenta fringe pixels")
        if green_pixels > FRINGE_PIXEL_LIMIT:
            fail(f"{state} has {green_pixels} green fringe pixels")


def validate_cells(path):
    with Image.open(path) as image:
        alpha = image.convert("RGBA").getchannel("A")
    for row, count in enumerate(FRAME_COUNTS):
        for column in range(8):
            cell = alpha.crop((column * CELL_WIDTH, row * CELL_HEIGHT,
                               (column + 1) * CELL_WIDTH, (row + 1) * CELL_HEIGHT))
            populated = cell.getbbox() is not None
            if column < count and not populated:
                fail(f"{STATE_ROWS[row]} frame {column} is empty")
            if column >= count and populated:
                fail(f"{STATE_ROWS[row]} unused column {column} is not transparent")


def main():
    manifest = json.loads(PET_JSON.read_text())
    required = {
        "id": "larry-david",
        "displayName": "Larry David",
        "spriteVersionNumber": 2,
        "spritesheetPath": "spritesheet.webp",
    }
    for key, value in required.items():
        if manifest.get(key) != value:
            fail(f"pet.json has unexpected {key!r}: {manifest.get(key)!r}")

    if read_webp_size(SPRITESHEET) != (1536, 2288):
        fail("spritesheet.webp should be 1536x2288")

    validate_cells(SPRITESHEET)
    validate_colored_fringe(SPRITESHEET)

    if read_png_size(CONTACT_SHEET) != (768, 1386):
        fail("contact-sheet.png should be 768x1386")

    if read_png_size(DIRECTION_SHEET) != (1536, 1170):
        fail("look-directions.png should be 1536x1170")

    previews = {path.name for path in PREVIEW_DIR.glob("*.gif")}
    if previews != EXPECTED_PREVIEWS:
        missing = sorted(EXPECTED_PREVIEWS - previews)
        extra = sorted(previews - EXPECTED_PREVIEWS)
        fail(f"preview GIF mismatch; missing={missing}, extra={extra}")

    for preview in sorted(PREVIEW_DIR.glob("*.gif")):
        if preview.read_bytes()[:6] not in {b"GIF87a", b"GIF89a"}:
            fail(f"{preview.relative_to(ROOT)} is not a GIF file")

    print("validate-package: ok")


if __name__ == "__main__":
    main()
