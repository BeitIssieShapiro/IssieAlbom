# App Store Media Requirements — IssieAlbum

## Screenshots

### iPhone
| Dimension | Orientation |
|-----------|-------------|
| 2778 × 1284 px | Landscape |
| 1284 × 2778 px | Portrait |
| 2688 × 1242 px | Landscape |
| 1242 × 2688 px | Portrait |

**Used:** `iphone_*_2778x1284.png` (in `~/Desktop/appstore_screenshots/`)
**Display type:** `APP_IPHONE_65` (6.5-inch)

### iPad
| Dimension | Orientation |
|-----------|-------------|
| 2732 × 2048 px | Landscape |
| 2048 × 2732 px | Portrait |
| 2064 × 2752 px | Landscape |
| 2752 × 2064 px | Portrait |

**Used:** `ipad_*_2732x2048.png` (in `~/Desktop/appstore_screenshots/`)
**Display type:** `APP_IPAD_PRO_3GEN_129` (13-inch)

---

## App Preview (Video)

### Requirements
- Format: H.264 `.mov`
- Duration: **15–30 seconds**
- Frame rate: 30 fps
- SAR: 1:1 (no anamorphic)
- Profile: **H.264 High** (not Main — Main gets silently rejected)
- Bitrate: **10–12 Mbps** (use CBR filler to guarantee it)
- Audio: AAC 256kbps, 44.1kHz stereo
- Color: bt709 signaled explicitly
- `+faststart` movflag
- **No black bars** — cropdetect first, then scale

### iPhone
| Dimension | Orientation | Display type |
|-----------|-------------|-------------|
| 1920 × 886 px | Landscape | `IPHONE_65` |

**Used:** `apppreview_iphone_1920x886.mov`

### iPad
| Dimension | Orientation | Display type |
|-----------|-------------|-------------|
| 1600 × 1200 px | Landscape | `IPAD_PRO_3GEN_129` |

**Used:** `apppreview_ipad_1600x1200.mov`

---

## ffmpeg Recipes

### Detect black bars
```bash
ffmpeg -i source.mp4 -vf "cropdetect=24:2:0" -t 10 -f null -
# Look for crop=W:H:X:Y in output
```

### iPhone video (crop bars + scale to fill + speed if needed)
```bash
# If source has bars at y=36, content 1200x828:
ffmpeg -y -i source.mp4 \
  -vf "crop=1200:828:0:36,scale=1920:1382,crop=1920:886:0:248,setsar=1:1" \
  -c:v libx264 -preset slow -profile:v high -level:v 4.1 \
  -b:v 10M -maxrate 12M -bufsize 12M \
  -x264-params "nal-hrd=cbr:filler=1:force-cfr=1:colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -movflags +faststart \
  -c:a aac -b:a 256k -ar 44100 -ac 2 \
  output_iphone.mov
```

### iPad video (crop bars + exact scale — 4:3 source fits 1600×1200 exactly)
```bash
ffmpeg -y -i source.mp4 \
  -vf "crop=1200:828:0:36,scale=1600:1200,setsar=1:1" \
  -c:v libx264 -preset slow -profile:v high -level:v 4.0 \
  -b:v 10M -maxrate 12M -bufsize 12M \
  -x264-params "nal-hrd=cbr:filler=1:force-cfr=1:colorprim=bt709:transfer=bt709:colormatrix=bt709" \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -movflags +faststart \
  -c:a aac -b:a 256k -ar 44100 -ac 2 \
  output_ipad.mov
```

### Screenshot scaling
```bash
# iPhone landscape (stretch to fill — no padding)
ffmpeg -y -i screenshot.png -vf "scale=2778:1284,setsar=1:1" -update 1 out_iphone.png

# iPad landscape
ffmpeg -y -i screenshot.png -vf "scale=2732:2048,setsar=1:1" -update 1 out_ipad.png
```

### Speed factor (if source > 30s)
```
speed = original_duration / 30
# e.g. 38.53s → speed=1.284
# Add to vf: setpts=PTS/1.284
# Add to af: atempo=1.284
```

---

## Upload Script

**File:** `asc_upload.py` (in repo root)

**Dependencies:**
```bash
pip3 install PyJWT cryptography requests --break-system-packages
```

**Usage:**
```bash
python3 asc_upload.py --clear           # delete all existing media
python3 asc_upload.py --upload          # upload all media
python3 asc_upload.py --clear --upload  # clear then upload (safest)
```

**Config at top of script:** Key ID, Issuer ID, .p8 path, App ID, file paths.

---

## Fixing "Uploads In Progress" Stuck State

This is a **server-side Apple bug** — no browser action (refresh, clear cache, incognito, different browser) will fix it. The cause is orphaned preview asset records on Apple's backend from previously failed or cancelled uploads.

### Diagnosis
```bash
python3 - <<'EOF'
# (paste the status check snippet — see script)
# Shows asset delivery state of all previews
EOF
```

If previews show `COMPLETE` in the API but the web UI still says "in progress", there are **hidden orphaned preview IDs** from old uploads.

### Fix
1. Find the stuck preview IDs via the `reviewSubmissionItems` API error response:
```bash
# Try to add version to a review submission — Apple returns the stuck IDs in associatedErrors
POST /v1/reviewSubmissionItems  →  STATE_ERROR.PREVIEW_UPLOADS_IN_PROGRESS
# Response includes: "/v1/appPreviews/<stuck-id>": [...]
```

2. Delete each stuck preview by ID:
```bash
DELETE /v1/appPreviews/<stuck-id>
```

3. Run `python3 asc_upload.py --clear --upload` to reset and re-upload everything.

4. Verify all assets are `COMPLETE` before submitting.

### If draft review submissions pile up
List and cancel them via API (they can't be deleted directly — cancel first):
```python
# List
GET /v1/apps/{APP_ID}/reviewSubmissions?filter[platform]=IOS

# Cancel (PATCH with canceled:true or use App Store Connect UI)
# Then DELETE once in CANCELING state
```

