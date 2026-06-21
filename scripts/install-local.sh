#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
pet_id="larry-david-v3"
if [[ -z "${LOCAL_PET_APP_HOME:-}" ]]; then
  echo "Set LOCAL_PET_APP_HOME to your local pet app folder before running this script." >&2
  exit 1
fi

local_app_home="$LOCAL_PET_APP_HOME"
target_dir="$local_app_home/pets/$pet_id"

mkdir -p "$target_dir"
cp "$repo_dir/pet/pet.json" "$target_dir/pet.json"
cp "$repo_dir/pet/spritesheet.webp" "$target_dir/spritesheet.webp"

echo "Installed $pet_id to $target_dir"
echo 'Set selected-avatar-id = "custom:larry-david-v3" in your local app config to use it.'
