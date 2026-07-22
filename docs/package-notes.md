# Package Notes

Larry David is packaged as a compact 8x11 desktop pet spritesheet with a matching manifest, animation previews, and 16 pointer-tracking directions.

## Source Files

- Pet manifest: `pet/pet.json`
- Spritesheet: `pet/spritesheet.webp`
- Contact sheet: `qa/contact-sheet.png`
- Direction sheet: `qa/look-directions.png`
- State previews: `qa/previews/*.gif`

## Validation Summary

- Final spritesheet: `1536x2288`
- Cell size: `192x208`
- Rows: `11`
- Used frames: `73`
- Sprite format: `2`
- Transparent RGB residue: `0`
- Deterministic validation: passed
- Frame inspection: passed
- Cardinal direction review: passed

## Included States

- `idle`
- `running-right`
- `running-left`
- `waving`
- `jumping`
- `failed`
- `waiting`
- `running`
- `review`
- `look-000-to-157.5`
- `look-180-to-337.5`

## Repo Scope

This repo keeps the polished package and preview artifacts only. It intentionally excludes scratch work, reference images, unrelated local context, and anything company-related.
