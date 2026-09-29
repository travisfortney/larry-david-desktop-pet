# Larry David Desktop Pet

A tiny animated desktop pet package based on Larry David, my deeply unimpressed silver tabby.

This repo contains the finished spritesheet, animation previews, contact sheets, and a small validation script for installing Larry into a local desktop pet app. Larry also tracks the pointer through 16 looking directions.

~~Not _that_ Larry David.~~ The real Larry David here is the cat in my GitHub profile photo, and he is the ~~model~~ reference for this design.

<img src="docs/images/real-larry-david.jpg" alt="The real Larry David, the cat this desktop pet is based on" width="180">

## Preview

![Larry David contact sheet](qa/contact-sheet.png)

Directional looks:

<img src="qa/look-directions.png" alt="Larry David looking in 16 directions" width="768">

Larry's clockwise look-around sweep keeps his paws planted while his head and eyes follow the pointer:

![Look-around animation](qa/motion/look-around.gif)

The hop includes a crouch, visible lift, and a return to his resting baseline:

![Idle to jump to idle](qa/motion/idle-jump-idle.gif)

Individual state previews:

| Idle | Running | Waiting | Review |
| --- | --- | --- | --- |
| ![Idle animation](qa/previews/idle.gif) | ![Running animation](qa/previews/running.gif) | ![Waiting animation](qa/previews/waiting.gif) | ![Review animation](qa/previews/review.gif) |

## Contents

- `pet/pet.json` - local pet manifest
- `pet/spritesheet.webp` - final 8x11 spritesheet
- `qa/contact-sheet.png` - contact sheet for all animation states
- `qa/look-directions.png` - neutral pose and all 16 looking directions
- `qa/previews/*.gif` - per-state animation previews
- `qa/motion/` - look-around comparison, jump sequence, and all-state GIF/MP4
- `qa/sources/` - approved artwork strips and refinement briefs
- `qa/validation.json` - structural and visual check results
- `scripts/install-local.sh` - local installer
- `scripts/validate-package.py` - package sanity check

## Install Locally

Run:

```bash
export LOCAL_PET_APP_HOME="/path/to/your/local/pet/app"
./scripts/install-local.sh
```

That copies the pet into the target pet folder.

To make Larry active, set:

```toml
selected-avatar-id = "custom:larry-david"
```

in your local app config, then wake or restart the app if needed.

## Notes

This is just a tiny polished package for a local desktop companion. The repo includes the finished pet package, preview artifacts, and the source strips for the latest motion refinements.
