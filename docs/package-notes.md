# Package Notes

Larry David is packaged as a compact 8x11 desktop pet spritesheet with a matching manifest, animation previews, and 16 pointer-tracking directions.

## Source Files

- Pet manifest: `pet/pet.json`
- Spritesheet: `pet/spritesheet.webp`
- Contact sheet: `qa/contact-sheet.png`
- Direction sheet: `qa/look-directions.png`
- State previews: `qa/previews/*.gif`
- Motion previews: `qa/motion/`
- Refinement source strips and briefs: `qa/sources/`
- Current validation: `qa/validation.json`

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

The look rows use a coherent clockwise head-and-eye sweep with a planted body. The jump rises 35 pixels above its ground pose and lands within one pixel of the idle baseline. The six used idle frames and the other seven standard animation states preserve their original visible pixels. The unused seventh idle cell is transparent.

Three independent axis reviews agreed on all 14 direction pairs. Ordered-frame motion review passed. The idle/jump preview uses the desktop renderer's frame durations and three jump repetitions; live desktop playback was not directly observed.

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

This repo keeps the polished package, preview artifacts, and approved refinement source strips. It excludes scratch work and unrelated local context.
