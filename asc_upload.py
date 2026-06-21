#!/usr/bin/env python3
"""
App Store Connect media uploader.
- Clears stuck upload state by deleting all screenshot/preview sets
- Re-uploads screenshots and previews for iOS

Usage:
  python3 asc_upload.py --clear           # clear all media (fix stuck state)
  python3 asc_upload.py --upload          # upload all media
  python3 asc_upload.py --clear --upload  # clear then upload
"""

import argparse
import hashlib
import json
import mimetypes
import os
import sys
import time
from pathlib import Path

import jwt
import requests

# ── Config ────────────────────────────────────────────────────────────────────
KEY_ID     = "<key_id>"           # App Store Connect API Key ID (e.g. ABC1234DEF)
ISSUER_ID  = "<key_issuer_id>"    # UUID from Users & Access → Keys page
KEY_PATH   = Path("<key_p8_path>") # Absolute path to downloaded .p8 file
APP_ID     = "<key_app_id>"       # Numeric Apple ID from App Information page

# Media to upload — edit paths as needed
IPAD_SCREENSHOTS = [
    Path("<basepath>/appstore_screenshots/ipad_1_2732x2048.png"),
    Path("<basepath>appstore_screenshots/ipad_2_2732x2048.png"),
    Path("<basepath>appstore_screenshots/ipad_3_2732x2048.png"),
]
IPHONE_SCREENSHOTS = [
    Path("<basepath>appstore_screenshots/iphone_1_2778x1284.png"),
    Path("<basepath>appstore_screenshots/iphone_2_2778x1284.png"),
    Path("<basepath>appstore_screenshots/iphone_3_2778x1284.png"),
]
IPAD_PREVIEW    = Path("<basepath>/apppreview_ipad_1600x1200.mov")
IPHONE_PREVIEW  = Path("/<basepath>/apppreview_iphone_1920x886.mov")

# Display types
IPAD_SCREENSHOT_TYPE   = "APP_IPAD_PRO_3GEN_129"   # 13-inch iPad Pro (2732×2048)
IPHONE_SCREENSHOT_TYPE = "APP_IPHONE_65"            # 6.5-inch iPhone (2778×1284)
IPAD_PREVIEW_TYPE      = "IPAD_PRO_3GEN_129"
IPHONE_PREVIEW_TYPE    = "IPHONE_65"

BASE_URL = "https://api.appstoreconnect.apple.com/v1"
# ──────────────────────────────────────────────────────────────────────────────


def make_token():
    private_key = KEY_PATH.read_text()
    payload = {
        "iss": ISSUER_ID,
        "exp": int(time.time()) + 1200,
        "aud": "appstoreconnect-v1",
    }
    return jwt.encode(payload, private_key, algorithm="ES256", headers={"kid": KEY_ID})


def headers():
    return {"Authorization": f"Bearer {make_token()}", "Content-Type": "application/json"}


def get(path, params=None):
    r = requests.get(f"{BASE_URL}{path}", headers=headers(), params=params)
    r.raise_for_status()
    return r.json()


def post(path, body):
    r = requests.post(f"{BASE_URL}{path}", headers=headers(), json=body)
    if not r.ok:
        print(f"  POST {path} failed {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
    return r.json()


def patch(path, body):
    r = requests.patch(f"{BASE_URL}{path}", headers=headers(), json=body)
    if not r.ok:
        print(f"  PATCH {path} failed {r.status_code}: {r.text[:300]}")
        r.raise_for_status()
    return r.json()


def delete(path):
    r = requests.delete(f"{BASE_URL}{path}", headers=headers())
    if r.status_code not in (200, 204):
        print(f"  DELETE {path} failed {r.status_code}: {r.text[:200]}")
    else:
        print(f"  deleted {path}")


def get_edit_version_id():
    """Return the version ID that is in PREPARE_FOR_SUBMISSION or similar editable state."""
    data = get(f"/apps/{APP_ID}/appStoreVersions", params={"filter[platform]": "IOS"})
    versions = data.get("data", [])
    # Prefer editable states
    editable = ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED",
                "METADATA_REJECTED", "WAITING_FOR_REVIEW", "IN_REVIEW"]
    for v in versions:
        if v["attributes"]["appStoreState"] in editable:
            print(f"  Using version {v['attributes']['versionString']} ({v['attributes']['appStoreState']})")
            return v["id"]
    # Fall back to most recent
    if versions:
        v = versions[0]
        print(f"  Using version {v['attributes']['versionString']} ({v['attributes']['appStoreState']})")
        return v["id"]
    raise RuntimeError("No iOS version found")


def get_localization_id(version_id, locale="en-US"):
    data = get(f"/appStoreVersions/{version_id}/appStoreVersionLocalizations")
    for loc in data.get("data", []):
        if loc["attributes"]["locale"] == locale:
            return loc["id"]
    raise RuntimeError(f"Locale {locale} not found")


def clear_all_media(loc_id):
    print("\n── Clearing screenshot sets ──")
    data = get(f"/appStoreVersionLocalizations/{loc_id}/appScreenshotSets")
    for s in data.get("data", []):
        dtype = s["attributes"]["screenshotDisplayType"]
        print(f"  Deleting screenshot set: {dtype}")
        # Delete individual screenshots first
        screenshots = get(f"/appScreenshotSets/{s['id']}/appScreenshots").get("data", [])
        for sc in screenshots:
            delete(f"/appScreenshots/{sc['id']}")
        delete(f"/appScreenshotSets/{s['id']}")

    print("\n── Clearing preview sets ──")
    data = get(f"/appStoreVersionLocalizations/{loc_id}/appPreviewSets")
    for p in data.get("data", []):
        dtype = p["attributes"]["previewType"]
        print(f"  Deleting preview set: {dtype}")
        previews = get(f"/appPreviewSets/{p['id']}/appPreviews").get("data", [])
        for pv in previews:
            delete(f"/appPreviews/{pv['id']}")
        delete(f"/appPreviewSets/{p['id']}")

    print("  Done clearing.")


def create_screenshot_set(loc_id, display_type):
    body = {"data": {"type": "appScreenshotSets", "attributes": {"screenshotDisplayType": display_type},
                     "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc_id}}}}}
    return post("/appScreenshotSets", body)["data"]["id"]


def get_or_create_screenshot_set(loc_id, display_type):
    data = get(f"/appStoreVersionLocalizations/{loc_id}/appScreenshotSets")
    for s in data.get("data", []):
        if s["attributes"]["screenshotDisplayType"] == display_type:
            print(f"  Reusing existing screenshot set: {display_type}")
            return s["id"]
    return create_screenshot_set(loc_id, display_type)


def get_or_create_preview_set(loc_id, preview_type):
    data = get(f"/appStoreVersionLocalizations/{loc_id}/appPreviewSets")
    for p in data.get("data", []):
        if p["attributes"]["previewType"] == preview_type:
            print(f"  Reusing existing preview set: {preview_type}")
            return p["id"]
    return create_preview_set(loc_id, preview_type)
    body = {"data": {"type": "appScreenshotSets", "attributes": {"screenshotDisplayType": display_type},
                     "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc_id}}}}}
    return post("/appScreenshotSets", body)["data"]["id"]


def create_preview_set(loc_id, preview_type):
    body = {"data": {"type": "appPreviewSets", "attributes": {"previewType": preview_type},
                     "relationships": {"appStoreVersionLocalization": {"data": {"type": "appStoreVersionLocalizations", "id": loc_id}}}}}
    return post("/appPreviewSets", body)["data"]["id"]


def upload_file_to_reservation(upload_ops, file_path):
    """Execute Apple's upload operations (PUT to S3)."""
    data = file_path.read_bytes()
    for op in upload_ops:
        url = op["url"]
        method = op["method"]
        req_headers = {h["name"]: h["value"] for h in op.get("requestHeaders", [])}
        offset = op["offset"]
        length = op["length"]
        chunk = data[offset: offset + length]
        r = requests.request(method, url, headers=req_headers, data=chunk)
        if not r.ok:
            raise RuntimeError(f"S3 upload chunk failed {r.status_code}: {r.text[:200]}")


def upload_screenshot(set_id, file_path, index):
    print(f"  Uploading screenshot: {file_path.name}")
    stat = file_path.stat()
    md5 = hashlib.md5(file_path.read_bytes()).digest().hex() if hasattr(hashlib.md5(file_path.read_bytes()), 'hex') else hashlib.md5(file_path.read_bytes()).hexdigest()
    mime = "image/png"

    body = {"data": {"type": "appScreenshots",
                     "attributes": {"fileName": file_path.name, "fileSize": stat.st_size},
                     "relationships": {"appScreenshotSet": {"data": {"type": "appScreenshotSets", "id": set_id}}}}}
    resp = post("/appScreenshots", body)
    asset_id = resp["data"]["id"]
    upload_ops = resp["data"]["attributes"]["uploadOperations"]

    upload_file_to_reservation(upload_ops, file_path)

    # Commit
    patch(f"/appScreenshots/{asset_id}", {"data": {"type": "appScreenshots", "id": asset_id,
                                                     "attributes": {"uploaded": True, "sourceFileChecksum": md5}}})
    print(f"    committed {file_path.name}")


def upload_preview(set_id, file_path):
    print(f"  Uploading preview: {file_path.name}")
    stat = file_path.stat()
    md5 = hashlib.md5(file_path.read_bytes()).hexdigest()

    body = {"data": {"type": "appPreviews",
                     "attributes": {"fileName": file_path.name, "fileSize": stat.st_size},
                     "relationships": {"appPreviewSet": {"data": {"type": "appPreviewSets", "id": set_id}}}}}
    resp = post("/appPreviews", body)
    asset_id = resp["data"]["id"]
    upload_ops = resp["data"]["attributes"]["uploadOperations"]

    upload_file_to_reservation(upload_ops, file_path)

    patch(f"/appPreviews/{asset_id}", {"data": {"type": "appPreviews", "id": asset_id,
                                                  "attributes": {"uploaded": True, "sourceFileChecksum": md5}}})
    print(f"    committed {file_path.name}")


def upload_all_media(loc_id):
    print("\n── Uploading iPad screenshots ──")
    ipad_ss_set = get_or_create_screenshot_set(loc_id, IPAD_SCREENSHOT_TYPE)
    for i, f in enumerate(IPAD_SCREENSHOTS):
        upload_screenshot(ipad_ss_set, f, i)

    print("\n── Uploading iPhone screenshots ──")
    iphone_ss_set = get_or_create_screenshot_set(loc_id, IPHONE_SCREENSHOT_TYPE)
    for i, f in enumerate(IPHONE_SCREENSHOTS):
        upload_screenshot(iphone_ss_set, f, i)

    print("\n── Uploading iPad preview ──")
    ipad_pv_set = get_or_create_preview_set(loc_id, IPAD_PREVIEW_TYPE)
    upload_preview(ipad_pv_set, IPAD_PREVIEW)

    print("\n── Uploading iPhone preview ──")
    iphone_pv_set = get_or_create_preview_set(loc_id, IPHONE_PREVIEW_TYPE)
    upload_preview(iphone_pv_set, IPHONE_PREVIEW)

    print("\nAll media uploaded.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--clear", action="store_true", help="Delete all existing media")
    parser.add_argument("--upload", action="store_true", help="Upload new media")
    parser.add_argument("--locale", default="en-US", help="Locale (default: en-US)")
    args = parser.parse_args()

    if not args.clear and not args.upload:
        parser.print_help()
        sys.exit(1)

    # Check PyJWT installed
    try:
        import jwt
    except ImportError:
        print("Install dependencies: pip3 install PyJWT cryptography requests")
        sys.exit(1)

    print(f"App ID: {APP_ID}")
    version_id = get_edit_version_id()
    loc_id = get_localization_id(version_id, args.locale)
    print(f"Version ID: {version_id}  Localization ID: {loc_id}")

    if args.clear:
        clear_all_media(loc_id)

    if args.upload:
        upload_all_media(loc_id)


if __name__ == "__main__":
    main()
