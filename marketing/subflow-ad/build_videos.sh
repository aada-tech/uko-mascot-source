#!/bin/sh
# Every video, per language (fr en es), from the recorded clips (clips-<lang>/):
#  - the 9:16 ad (out/uko-subflow-ad-9x16-<lang>.mp4) + its 720p landing copy and poster
#  - SubFlow landing clips (subflow/apps/web/public/landing/<lang>/*.mp4 + .webp)
# Needs: python3 -m http.server 3340 (from UKO_MASTER_PACK/) for the ad composition.
set -e
cd "$(dirname "$0")"
LANDING=../../landing_page/media
SUBFLOW=${SUBFLOW_PUBLIC:-$HOME/Developer/subflow/apps/web/public/landing}
for lang in ${@:-fr en es}; do
  node check_framing.cjs $lang
  # The error scene must stay on the form (error shown), never go back to the dashboard.
  python3 -c "
import json,sys
from PIL import Image,ImageStat
e=json.load(open('clips-$lang/error/events.json')); t=[x['t'] for x in e['events'] if x['label']=='error'][0]
back=[i/30 for i in range(int(t*30)+6,e['frames'],6) if ImageStat.Stat(Image.open('clips-$lang/error/%05d.jpg'%i).crop((0,40,780,100)).convert('L')).mean[0]>200]
sys.exit('FAIL [$lang] error scene: the form closed at %.1f s (the amount was accepted)'%back[0]) if back else print('ok   [$lang] error scene: the form stays open with the error')"
  node render_ad.cjs --lang $lang --cues >/dev/null
  node audio.cjs $lang
  node render_ad.cjs --lang $lang
  ffmpeg -y -loglevel error -i out/uko-subflow-ad-9x16-$lang.mp4 -vf scale=720:-2 -c:v libx264 -preset slow -crf 26 -c:a aac -b:a 96k -movflags +faststart $LANDING/uko-subflow-ad-$lang.mp4
  ffmpeg -y -loglevel error -ss 20 -i out/uko-subflow-ad-9x16-$lang.mp4 -frames:v 1 -vf scale=720:-2 -q:v 4 $LANDING/uko-subflow-ad-poster-$lang.jpg
  mkdir -p $SUBFLOW/$lang
  for sc in themes add calendar simulate cancel; do
    ffmpeg -y -loglevel error -framerate 30 -i clips-$lang/$sc/%05d.jpg -vf "scale=600:-2:flags=lanczos,format=yuv420p" -c:v libx264 -preset slow -crf 22 -profile:v high -movflags +faststart -an $SUBFLOW/$lang/$sc.mp4
    python3 -c "from PIL import Image; Image.open('clips-$lang/$sc/00000.jpg').resize((600,1298), Image.LANCZOS).save('$SUBFLOW/$lang/$sc.webp', quality=72, method=6)"
  done
  echo "$lang: ad $(du -h out/uko-subflow-ad-9x16-$lang.mp4 | cut -f1), landing $(du -h $LANDING/uko-subflow-ad-$lang.mp4 | cut -f1), subflow clips $(du -sh $SUBFLOW/$lang | cut -f1)"
done
