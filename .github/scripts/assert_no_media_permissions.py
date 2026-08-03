#!/usr/bin/env python3
"""Fail if a built manifest requests the broad photo/video permissions.

Play blocked version code 2040 under its photo and video permissions policy:
an app targeting API 33+ may hold READ_MEDIA_IMAGES / READ_MEDIA_VIDEO only
where a system picker cannot provide core functionality. Ours can — document
upload goes through the Storage Access Framework, which needs no permission —
so AndroidManifest.xml strips both with tools:node="remove".

That strip is not self-enforcing. Plugin manifests declare these permissions
themselves, so a dependency bump can merge them back in while the app's own
manifest still looks clean. This checks what the build actually produced.

Reads manifest paths on stdin, one per line. Exits non-zero on the first
offending file, with GitHub Actions error annotations.

Two things it deliberately does not do:

  * grep. Comments survive the merge, and the ones in AndroidManifest.xml
    explain the policy by naming these very permissions — a text search
    matches its own documentation and fails a build that is clean.
  * flag READ_MEDIA_AUDIO. It is outside this policy. It is also unused here
    and worth removing, but that is hygiene, not a release blocker, and
    conflating the two makes the failure message a lie.
"""

import sys
import xml.etree.ElementTree as ET

ANDROID_NAME = "{http://schemas.android.com/apk/res/android}name"

BANNED = {
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
}


def offenders(path):
    """Banned permissions this manifest requests, sorted."""
    root = ET.parse(path).getroot()
    requested = {p.get(ANDROID_NAME) for p in root.iter("uses-permission")}
    return sorted(requested & BANNED)


def main():
    paths = [line.strip() for line in sys.stdin if line.strip()]
    if not paths:
        print("::error::No manifests to check — the caller found none.")
        return 1

    bad = False
    for path in paths:
        try:
            found = offenders(path)
        except ET.ParseError as exc:
            print(f"::error::{path} is not parseable as XML: {exc}")
            bad = True
            continue
        if found:
            bad = True
            print(f"::error::{path} requests {', '.join(found)}")

    if bad:
        print(
            "::error::Play rejects this under the photo and video permissions "
            'policy. Add a tools:node="remove" entry for it in '
            "hanguk_app/android/app/src/main/AndroidManifest.xml, or drop the "
            "plugin that declares it. See docs/RELEASE.md."
        )
        return 1

    print(f"Checked {len(paths)} manifest(s); no broad media permissions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
