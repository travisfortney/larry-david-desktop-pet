#!/usr/bin/env python3
import json
import pathlib
import struct
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PET_JSON = ROOT / "pet" / "pet.json"
SPRITESHEET = ROOT / "pet" / "spritesheet.webp"
CONTACT_SHEET = ROOT / "qa" / "contact-sheet.png"
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


def main():
    manifest = json.loads(PET_JSON.read_text())
    required = {
        "id": "larry-david-v2",
        "displayName": "Larry David v2",
        "spritesheetPath": "spritesheet.webp",
    }
    for key, value in required.items():
        if manifest.get(key) != value:
            fail(f"pet.json has unexpected {key!r}: {manifest.get(key)!r}")

    if read_webp_size(SPRITESHEET) != (1536, 1872):
        fail("spritesheet.webp should be 1536x1872")

    if read_png_size(CONTACT_SHEET) != (768, 1134):
        fail("contact-sheet.png should be 768x1134")

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
