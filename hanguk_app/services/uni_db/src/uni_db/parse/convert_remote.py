"""Remote document conversion — the tier that needs nothing installed.

`format_convert.extract_hwp` has two local tiers, and on a CI runner BOTH
are absent: `pyhwp` is not a dependency of this package, and no workflow
installs LibreOffice. So every non-PDF guideline died before it ever reached
the model — 12 stored blobs with `parse_status='failed'` and not one
extraction job between them, because the failure happens in text extraction,
upstream of the job table.

This module adds a third tier that runs entirely over HTTPS. CloudConvert's
public format matrix (queried 2026-08-16, no auth required) confirms the
conversion we need:

    hwp  -> pdf   YES   (engine: office)
    doc  -> pdf   YES
    docx -> pdf   YES
    hwpx -> pdf   NO    <- not offered; hwpx still needs a local converter

That `hwpx` gap is deliberate and visible rather than papered over: a caller
asking for hwpx gets `UnsupportedFormat`, which reads very differently in a
failure note from "the conversion crashed".

Design notes
------------
* **Format may be left to the service.** Nine of the twelve dead blobs were
  stored with a lying content-type (`application/download`,
  `application/x-msdownload`) and our own magic-byte sniffer could not place
  them either. Passing `input_format=None` lets CloudConvert detect the type
  from the uploaded bytes, which is the whole reason to prefer it over
  guessing locally.
* **The transport is injectable** (`_client_factory`) so the whole flow is
  testable without network or an API key — the tests drive it through a fake
  httpx transport, the same way `format_convert` injects `subprocess.run`.
* **Errors carry the service's own words.** A conversion that fails at 2 a.m.
  in a scheduled run is only debuggable if the note says what CloudConvert
  actually replied, so the response body is quoted (truncated) in the error.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass

import httpx

from ..config import settings

log = logging.getLogger(__name__)

_API_ROOT = "https://api.cloudconvert.com/v2"

# CloudConvert's queue is not instant: a job goes waiting -> processing ->
# finished. Poll rather than block a worker thread on a webhook we have no
# public endpoint to receive.
_POLL_INTERVAL_SEC = 2.0
_POLL_TIMEOUT_SEC = 300.0
_HTTP_TIMEOUT_SEC = 60.0

# Input formats this module will hand to CloudConvert. Checked against the
# live format matrix; `hwpx` is absent from it and so absent here.
SUPPORTED_INPUT_FORMATS: frozenset[str] = frozenset({
    "hwp", "doc", "docx", "rtf", "odt", "ppt", "pptx", "xls", "xlsx",
})


class RemoteConversionError(RuntimeError):
    """The conversion service was reachable but did not produce a PDF."""


class UnsupportedFormat(RemoteConversionError):
    """This input format is not offered by the configured service.

    Separate from a generic failure on purpose: nothing about retrying, a
    different key, or a bigger timeout will change it.
    """


class NotConfigured(RemoteConversionError):
    """No remote-conversion credential is set — the tier is simply off."""


@dataclass(frozen=True, slots=True)
class RemoteConversion:
    pdf_bytes: bytes
    provider: str
    detected_format: str | None


def is_configured() -> bool:
    """True when a remote converter can run. Callers use this to skip the
    tier quietly rather than raise on every non-PDF in a keyless deployment."""
    return bool(getattr(settings, "cloudconvert_api_key", ""))


def _client_factory(token: str) -> httpx.Client:
    return httpx.Client(
        base_url=_API_ROOT,
        headers={"Authorization": f"Bearer {token}"},
        timeout=_HTTP_TIMEOUT_SEC,
    )


def _fail(resp: httpx.Response, what: str) -> RemoteConversionError:
    """Quote the service verbatim — a scheduled run's failure note is the
    only forensic evidence anyone will have later."""
    body = (resp.text or "")[:300].replace("\n", " ")
    return RemoteConversionError(
        f"cloudconvert {what} failed: HTTP {resp.status_code} {body}"
    )


def _task(job: dict, name: str) -> dict:
    for t in job.get("tasks", []) or []:
        if t.get("name") == name:
            return t
    raise RemoteConversionError(
        f"cloudconvert response has no '{name}' task — "
        f"tasks present: {[t.get('name') for t in job.get('tasks', []) or []]}"
    )


def convert_to_pdf(
    data: bytes,
    *,
    input_format: str | None = None,
    filename: str = "document",
    sleep=time.sleep,
    monotonic=time.monotonic,
) -> RemoteConversion:
    """Convert `data` to PDF bytes via CloudConvert.

    `input_format=None` lets the service detect the format from the bytes,
    which is what the nine unidentifiable blobs need. When a format IS given
    it is checked against `SUPPORTED_INPUT_FORMATS` first, so an hwpx fails
    immediately with `UnsupportedFormat` instead of burning a job slot and a
    five-minute poll to arrive at the same answer.

    `sleep`/`monotonic` are injected so tests exercise the polling loop
    without real time passing.
    """
    token = getattr(settings, "cloudconvert_api_key", "")
    if not token:
        raise NotConfigured(
            "UNI_DB_CLOUDCONVERT_API_KEY is not set; remote conversion is off"
        )
    if input_format is not None and input_format not in SUPPORTED_INPUT_FORMATS:
        raise UnsupportedFormat(
            f"cloudconvert does not convert {input_format!r} to pdf "
            f"(supported here: {', '.join(sorted(SUPPORTED_INPUT_FORMATS))})"
        )

    convert_task: dict[str, object] = {"operation": "convert", "output_format": "pdf"}
    convert_task["input"] = "upload"
    if input_format is not None:
        convert_task["input_format"] = input_format

    payload = {
        "tasks": {
            "upload": {"operation": "import/upload"},
            "convert": convert_task,
            "export": {"operation": "export/url", "input": "convert"},
        }
    }

    with _client_factory(token) as client:
        resp = client.post("/jobs", json=payload)
        if resp.status_code >= 400:
            raise _fail(resp, "job create")
        job = resp.json().get("data", {})
        job_id = job.get("id")
        if not job_id:
            raise RemoteConversionError("cloudconvert job create returned no id")

        _upload(client, _task(job, "upload"), data, filename)
        finished = _poll(client, job_id, sleep=sleep, monotonic=monotonic)
        pdf = _download(client, finished)

    if not pdf.startswith(b"%PDF-"):
        raise RemoteConversionError(
            "cloudconvert returned a file that is not a PDF "
            f"(first bytes: {pdf[:8]!r})"
        )
    return RemoteConversion(
        pdf_bytes=pdf, provider="cloudconvert", detected_format=input_format
    )


def _upload(client: httpx.Client, task: dict, data: bytes, filename: str) -> None:
    """POST the bytes to the signed form the import task handed back.

    CloudConvert's docs are explicit that the parameter keys are dynamic and
    that `file` must be the LAST field in the multipart body — so the fields
    are forwarded exactly as received and the file is appended after them.
    """
    form = (task.get("result") or {}).get("form") or {}
    url = form.get("url")
    params = form.get("parameters") or {}
    if not url:
        raise RemoteConversionError(
            "cloudconvert import task carried no upload form "
            f"(task status: {task.get('status')!r})"
        )
    resp = httpx.post(
        url,
        data=dict(params),
        files={"file": (filename, data)},
        timeout=_HTTP_TIMEOUT_SEC,
    )
    if resp.status_code >= 400:
        raise _fail(resp, "upload")


def _poll(client: httpx.Client, job_id: str, *, sleep, monotonic) -> dict:
    """Wait for the job to leave the queue. Returns the finished job."""
    deadline = monotonic() + _POLL_TIMEOUT_SEC
    last_status = "unknown"
    while monotonic() < deadline:
        resp = client.get(f"/jobs/{job_id}")
        if resp.status_code >= 400:
            raise _fail(resp, "job poll")
        job = resp.json().get("data", {})
        last_status = job.get("status", "unknown")
        if last_status == "finished":
            return job
        if last_status == "error":
            # Surface the failing task's own message: "no suitable engine",
            # "corrupt file" and "unsupported format" all land here and mean
            # very different things to whoever reads the review note.
            msgs = [
                f"{t.get('name')}: {t.get('message') or t.get('code')}"
                for t in job.get("tasks", []) or []
                if t.get("status") == "error"
            ]
            raise RemoteConversionError(
                "cloudconvert job failed — " + ("; ".join(msgs) or "no task detail")
            )
        sleep(_POLL_INTERVAL_SEC)
    raise RemoteConversionError(
        f"cloudconvert job {job_id} still {last_status} after "
        f"{_POLL_TIMEOUT_SEC:.0f}s"
    )


def _download(client: httpx.Client, job: dict) -> bytes:
    export = _task(job, "export")
    files = (export.get("result") or {}).get("files") or []
    if not files or not files[0].get("url"):
        raise RemoteConversionError("cloudconvert export task produced no file URL")
    resp = httpx.get(files[0]["url"], timeout=_HTTP_TIMEOUT_SEC, follow_redirects=True)
    if resp.status_code >= 400:
        raise _fail(resp, "download")
    return resp.content
