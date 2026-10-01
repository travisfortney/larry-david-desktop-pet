# Artwork sources

These source strips retain their original resolution and Larry’s established appearance, seated proportions, and crossed paws.

| File | Contents |
| --- | --- |
| `cardinals.png` | Four directional head poses: up, right, down, and left. |
| `look-clockwise-first.png` | Eight poses covering the right half of the clockwise look-around animation. |
| `look-clockwise-second.png` | Eight poses covering the left half of the clockwise look-around animation. |
| `jump.png` | Five poses covering anticipation, lift, apex, descent, and landing. |

## Atlas assembly

The first look strip sets the shared scale. The second look strip is scaled by 0.8741418764 to match before registration. Jump poses share one scale, with the hop fitted to the existing cell height.

Only the jumping and two look rows replace visible artwork. The unused seventh idle cell is cleared. Edge cleanup is limited to those rows, and invisible RGB is cleared before lossless WebP encoding.
