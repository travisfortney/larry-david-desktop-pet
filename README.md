# Larry David Desktop Pet

A small desktop pet package built around my very unimpressed silver tabby.

Larry is based on my cat: a skeptical silver-gray tabby kitten with huge thoughtful eyes, crossed paws, and smoother animation. This repo keeps the finished pet files, preview images, and a simple validation check in one place.

## Preview

![Larry David v2 contact sheet](qa/contact-sheet.png)

Individual state previews:

| Idle | Running | Waiting | Review |
| --- | --- | --- | --- |
| ![Idle animation](qa/previews/idle.gif) | ![Running animation](qa/previews/running.gif) | ![Waiting animation](qa/previews/waiting.gif) | ![Review animation](qa/previews/review.gif) |

## Contents

- `pet/pet.json` - local pet manifest
- `pet/spritesheet.webp` - final 8x9 spritesheet
- `qa/contact-sheet.png` - contact sheet for all animation states
- `qa/previews/*.gif` - per-state animation previews
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
selected-avatar-id = "custom:larry-david-v2"
```

in your local app config, then wake or restart the app if needed.

## Notes

This is just a tiny polished package for a local desktop companion. The repo intentionally includes only the finished pet package and preview artifacts.
