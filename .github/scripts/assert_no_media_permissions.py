#!/usr/bin/env python3
"""Fail if a built manifest requests a permission Play has blocked us over.

Two policies, two releases lost, the same shape both times: a permission the
app does not need for anything it actually does, declared in the manifest,
where Play reads it.

  * READ_MEDIA_IMAGES / READ_MEDIA_VIDEO — blocked 2040. An app targeting
    API 33+ may hold these only where a system picker cannot do the job. Ours
    can: document upload goes through the Storage Access Framework, which needs
    no permission at all.
  * REQUEST_INSTALL_PACKAGES — blocked 2041, and Play rolled users back to the
    previous version. It may only be held by apps whose core purpose is
    installing other apps. It was here for the APK self-updater, which store
    builds already do not use — they update through Play's own flow.

AndroidManifest.xml strips all three with tools:node="remove", but that strip is
not self-enforcing: plugin manifests declare these themselves, so a dependency
bump can merge one back while the app's own manifest still looks clean. Runtime
flags do not help either — kIsStoreBuild disabled the updater's code and Play
blocked the release anyway, because the declaration is what it reads. This
checks what the build actually produced.

Reads manifest paths on stdin, one per line. Exits non-zero on the first
offending file, with GitHub Actions error annotations.

Two things it deliberately does not do:

  * grep. Comments survive the merge, and the ones in AndroidManifest.xml
    explain each policy by naming these very permissions — a text search
    matches its own documentation and fails a build that is clean.
  * flag READ_MEDIA_AUDIO. It is outside these policies. It is also unused here
    and worth removing, but that is hygiene, not a release blocker, and
    conflating the two makes the failure message a lie.
"""

import sys
import xml.etree.ElementTree as ET

ANDROID_NAME = "{http://schemas.android.com/apk/res/android}name"
TOOLS_NODE = "{http://schemas.android.com/tools}node"

BANNED = {
    "android.permission.READ_MEDIA_IMAGES",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.REQUEST_INSTALL_PACKAGES",
}


def offenders(path):
    """Banned permissions this manifest requests, sorted.

    A tools:node="remove" entry is a merge directive, not a request — it is
    the mechanism that strips these. It does not survive into a merged
    manifest, so this only matters when the script is pointed at the source
    manifest, where treating it as a request would report the fix as the bug.
    """
    root = ET.parse(path).getroot()
    requested = {
        p.get(ANDROID_NAME)
        for p in root.iter("uses-permission")
        if p.get(TOOLS_NODE) != "remove"
    }
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
            "::error::Play has blocked a release over each of these. Add a "
            'tools:node="remove" entry for it in '
            "hanguk_app/android/app/src/main/AndroidManifest.xml, or drop the "
            "plugin that declares it. A runtime flag is not enough — Play reads "
            "the manifest. See docs/RELEASE.md."
        )
        return 1

    print(f"Checked {len(paths)} manifest(s); no Play-blocked permissions.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
