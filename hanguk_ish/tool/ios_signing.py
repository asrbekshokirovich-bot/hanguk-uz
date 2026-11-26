#!/usr/bin/env python3
"""HanPyol iOS signing via the App Store Connect API (2026-11-25).

Makes sure that, in the Apple team the API key belongs to:
  1. the bundle id uz.hanguk.ish exists (registered if not), with Push
     Notifications on (In-App Purchase is on for every App ID);
  2. an App Store provisioning profile for it exists, signed with the same
     Apple Distribution certificate as the .p12 we sign with (created if
     not, or if the old one lacks that certificate);
  3. says whether the App Store Connect app record exists (Apple only lets a
     person create it, on the website).

Writes the profile to --profile-out. Never prints keys.

Env: ASC_KEY_ID, ASC_ISSUER_ID, ASC_KEY_P8 (base64 of the .p8),
     IOS_DIST_CERT_P12 (base64), IOS_DIST_CERT_PASSWORD.
Needs: pip install pyjwt cryptography requests
"""
import argparse
import base64
import json
import os
import sys
import time

import jwt
import requests
from cryptography.hazmat.primitives.serialization import pkcs12

API = "https://api.appstoreconnect.apple.com/v1"


def token() -> str:
    key = base64.b64decode(env("ASC_KEY_P8")).decode()
    now = int(time.time())
    return jwt.encode(
        {"iss": env("ASC_ISSUER_ID"), "iat": now, "exp": now + 1100, "aud": "appstoreconnect-v1"},
        key,
        algorithm="ES256",
        headers={"kid": env("ASC_KEY_ID"), "typ": "JWT"},
    )


class Api:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers["Authorization"] = f"Bearer {token()}"

    def call(self, method, path, **kw):
        r = self.s.request(method, f"{API}{path}", timeout=60, **kw)
        if r.status_code >= 400:
            errors = r.json().get("errors", []) if r.headers.get("content-type", "").startswith("application/json") else []
            detail = "; ".join(f"{e.get('code')}: {e.get('detail')}" for e in errors) or r.text[:300]
            raise SystemExit(f"::error::{method} {path} → {r.status_code} {detail}")
        return r.json() if r.content else {}



def env(name):
    """A secret, without the BOM / line breaks Windows PowerShell adds when it
    pipes text into `gh secret set`."""
    return os.environ[name].replace("\ufeff", "").strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--bundle-id", default="uz.hanguk.ish")
    ap.add_argument("--name", default="HanPyol")
    ap.add_argument("--profile-name", default="HanPyol AppStore CI")
    ap.add_argument("--profile-out", required=True)
    ap.add_argument("--summary", default=os.environ.get("GITHUB_STEP_SUMMARY", "/dev/null"))
    a = ap.parse_args()
    api = Api()
    notes = []

    # 1. The bundle id.
    found = api.call("GET", "/bundleIds", params={"filter[identifier]": a.bundle_id, "limit": 5})["data"]
    found = [b for b in found if b["attributes"]["identifier"] == a.bundle_id]
    if found:
        bundle = found[0]
        notes.append(f"Bundle id {a.bundle_id}: already registered.")
    else:
        bundle = api.call("POST", "/bundleIds", json={"data": {"type": "bundleIds", "attributes": {
            "identifier": a.bundle_id, "name": a.name, "platform": "IOS"}}})["data"]
        notes.append(f"Bundle id {a.bundle_id}: registered now.")
    caps = api.call("GET", f"/bundleIds/{bundle['id']}/bundleIdCapabilities")["data"]
    if not any(c["attributes"]["capabilityType"] == "PUSH_NOTIFICATIONS" for c in caps):
        api.call("POST", "/bundleIdCapabilities", json={"data": {"type": "bundleIdCapabilities",
            "attributes": {"capabilityType": "PUSH_NOTIFICATIONS"},
            "relationships": {"bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}}}}})
        notes.append("Push Notifications: turned on.")

    # 2. The certificate inside our .p12, as Apple knows it.
    _, cert, _ = pkcs12.load_key_and_certificates(
        base64.b64decode(env("IOS_DIST_CERT_P12")), env("IOS_DIST_CERT_PASSWORD").encode())
    serial = format(cert.serial_number, "X").lstrip("0")
    certs = api.call("GET", "/certificates", params={"limit": 200})["data"]
    mine = [c for c in certs if c["attributes"].get("serialNumber", "").upper().lstrip("0") == serial]
    if not mine:
        raise SystemExit("::error::The .p12 certificate is not in this Apple team (or it was revoked).")
    cert_id = mine[0]["id"]

    # 3. The profile: reuse an active one with our certificate, else make one.
    profiles = api.call("GET", f"/bundleIds/{bundle['id']}/profiles", params={"limit": 50})["data"]
    use = None
    for p in profiles:
        at = p["attributes"]
        if at["profileType"] != "IOS_APP_STORE" or at["profileState"] != "ACTIVE":
            continue
        pc = api.call("GET", f"/profiles/{p['id']}/certificates")["data"]
        if any(c["id"] == cert_id for c in pc):
            use = p
            break
    if use is None:
        stale = [p for p in profiles if p["attributes"]["name"] == a.profile_name]
        for p in stale:  # a name must be unique
            api.call("DELETE", f"/profiles/{p['id']}")
        use = api.call("POST", "/profiles", json={"data": {"type": "profiles",
            "attributes": {"name": a.profile_name, "profileType": "IOS_APP_STORE"},
            "relationships": {
                "bundleId": {"data": {"type": "bundleIds", "id": bundle["id"]}},
                "certificates": {"data": [{"type": "certificates", "id": cert_id}]}}}})["data"]
        notes.append(f"Profile «{a.profile_name}»: created now.")
    else:
        notes.append(f"Profile «{use['attributes']['name']}»: reused.")
    with open(a.profile_out, "wb") as f:
        f.write(base64.b64decode(use["attributes"]["profileContent"]))

    # 4. The App Store Connect app record.
    apps = api.call("GET", "/apps", params={"filter[bundleId]": a.bundle_id})["data"]
    if apps:
        notes.append(f"App Store Connect app: «{apps[0]['attributes']['name']}» exists.")
        print("APP_EXISTS=true")
    else:
        notes.append("App Store Connect app: NOT created yet — the account holder creates it once "
                     f"(App Store Connect → Apps → + → New App, bundle id {a.bundle_id}).")
        print("APP_EXISTS=false")

    for n in notes:
        print(n)
    with open(a.summary, "a") as f:
        f.write("### iOS signing\n\n" + "\n".join(f"- {n}" for n in notes) + "\n")


if __name__ == "__main__":
    sys.exit(main())
