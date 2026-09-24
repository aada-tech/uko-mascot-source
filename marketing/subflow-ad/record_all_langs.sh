#!/bin/sh
# Records every app clip (ad + SubFlow landing) in French, English and Spanish.
#   (SubFlow production build on :3000)  sh marketing/subflow-ad/record_all_langs.sh [fr en es]
cd "$(dirname "$0")"
for lang in ${@:-fr en es}; do
  CLIP_LANG=$lang CLIPS_OUT="$(pwd)/clips-$lang" node record_clips.cjs add error simulate code themes calendar cancel || exit 1
done
