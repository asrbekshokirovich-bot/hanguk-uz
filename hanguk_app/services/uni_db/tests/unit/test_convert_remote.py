"""Remote document conversion — the tier that needs nothing installed.

Driven end-to-end through a fake httpx transport: job create, the signed
upload form, the poll loop, and the download. No network, no API key, no
real time passing.

Why this tier exists at all is worth restating, because the tests below are
shaped by it: on a CI runner BOTH local tiers are absent — `pyhwp` is not a
dependency of this package and no workflow installs LibreOffice — so every
non-PDF guideline died in text extraction, upstream of the extraction-job
table. Twelve stored blobs, zero extraction jobs between them.
"""

from __future__ import annotations

import httpx
import pytest

from uni_db.config import settings
from uni_db.parse import convert_remote as cr

PDF = b"%PDF-1.4 fake"


def _job(status: str, *, with_form: bool = True, files: list | None = None,
         task_error: str | None = None) -> dict:
    upload: dict = {"name": "upload", "status": "waiting"}
    if with_form:
        upload["result"] = {
            "form": {
                "url": "https://upload.cloudconvert.example/abc",
                # Deliberately odd keys: the docs say these are dynamic and
                # must not be hardcoded, so the client must forward whatever
                # it is handed.
                "parameters": {"signature": "s1", "expires": "9999", "x-odd": "v"},
            }
        }
    export: dict = {"name": "export", "status": "finished"}
    if files is not None:
        export["result"] = {"files": files}
    convert: dict = {"name": "convert", "status": "finished"}
    if task_error:
        convert = {"name": "convert", "status": "error", "message": task_error}
    return {"id": "job-1", "status": status,
            "tasks": [upload, convert, export]}


class _Recorder:
    """Fake transport: answers the API and records what it was sent."""

    def __init__(self, poll_statuses: list[dict], *,
                 create_job: dict | None = None,
                 download: bytes = PDF) -> None:
        self.polls = list(poll_statuses)
        self.uploaded: list[tuple[dict, dict]] = []
        self.job_payload: dict | None = None
        self.create_job = create_job if create_job is not None else _job("waiting")
        self.download = download

    def handler(self, request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.endswith("/v2/jobs") and request.method == "POST":
            import json
            self.job_payload = json.loads(request.content)
            return httpx.Response(201, json={"data": self.create_job})
        if "/v2/jobs/job-1" in url:
            return httpx.Response(200, json={"data": self.polls.pop(0)})
        if "download.example" in url:
            return httpx.Response(200, content=self.download)
        return httpx.Response(404, text=f"unexpected {url}")


@pytest.fixture
def wired(monkeypatch):
    """A configured client whose transport is the recorder."""
    monkeypatch.setattr(settings, "cloudconvert_api_key", "k-test", raising=False)

    def make(rec: _Recorder):
        transport = httpx.MockTransport(rec.handler)
        monkeypatch.setattr(
            cr, "_client_factory",
            lambda token: httpx.Client(base_url=cr._API_ROOT, transport=transport),
        )
        # httpx.post/get are called directly for the upload and download,
        # which do not go through the API client.
        def fake_post(url, **kw):
            rec.uploaded.append((dict(kw.get("data") or {}), kw.get("files") or {}))
            return httpx.Response(201, request=httpx.Request("POST", url))

        monkeypatch.setattr(httpx, "post", fake_post)
        monkeypatch.setattr(
            httpx, "get",
            lambda url, **kw: httpx.Response(
                200, content=rec.download, request=httpx.Request("GET", url)),
        )
        return rec

    return make


FILES = [{"url": "https://download.example/out.pdf"}]


class TestHappyPath:
    def test_converts_and_returns_pdf_bytes(self, wired) -> None:
        rec = wired(_Recorder([_job("processing"), _job("finished", files=FILES)]))
        out = cr.convert_to_pdf(b"\xd0\xcf\x11\xe0hwp", input_format="hwp",
                                sleep=lambda s: None)
        assert out.pdf_bytes == PDF
        assert out.provider == "cloudconvert"

    def test_asks_the_service_to_detect_the_format_when_unknown(self, wired) -> None:
        # The nine unidentifiable blobs: no input_format is sent at all, which
        # is the entire reason to use a remote converter over guessing locally.
        rec = wired(_Recorder([_job("finished", files=FILES)]))
        cr.convert_to_pdf(b"\x00\x01junk", input_format=None, sleep=lambda s: None)
        convert = rec.job_payload["tasks"]["convert"]
        assert "input_format" not in convert
        assert convert["output_format"] == "pdf"

    def test_forwards_the_signed_form_fields_verbatim(self, wired) -> None:
        # CloudConvert's docs: the parameter keys are dynamic and must not be
        # hardcoded. A client that filtered them would break silently the day
        # they change.
        rec = wired(_Recorder([_job("finished", files=FILES)]))
        cr.convert_to_pdf(b"x", input_format="hwp", sleep=lambda s: None)
        fields, files = rec.uploaded[0]
        assert fields == {"signature": "s1", "expires": "9999", "x-odd": "v"}
        assert "file" in files


class TestRefusesEarly:
    def test_hwpx_is_rejected_without_spending_a_job(self, wired) -> None:
        # hwpx -> pdf is absent from CloudConvert's live format matrix.
        # Sending it anyway would burn a job slot and a five-minute poll to
        # arrive at the same answer.
        rec = wired(_Recorder([]))
        with pytest.raises(cr.UnsupportedFormat):
            cr.convert_to_pdf(b"PK\x03\x04", input_format="hwpx")
        assert rec.job_payload is None

    def test_missing_key_is_its_own_error(self, monkeypatch) -> None:
        monkeypatch.setattr(settings, "cloudconvert_api_key", "", raising=False)
        assert cr.is_configured() is False
        with pytest.raises(cr.NotConfigured):
            cr.convert_to_pdf(b"x", input_format="hwp")


class TestFailures:
    def test_job_error_quotes_the_failing_task(self, wired) -> None:
        # "no suitable engine", "corrupt file" and "unsupported format" all
        # arrive as status=error and mean very different things to whoever
        # reads the review note months later.
        wired(_Recorder([_job("error", task_error="no suitable engine found")]))
        with pytest.raises(cr.RemoteConversionError, match="no suitable engine"):
            cr.convert_to_pdf(b"x", input_format="hwp", sleep=lambda s: None)

    def test_a_non_pdf_result_is_caught(self, wired) -> None:
        wired(_Recorder([_job("finished", files=FILES)],
                        download=b"<html>error page</html>"))
        with pytest.raises(cr.RemoteConversionError, match="not a PDF"):
            cr.convert_to_pdf(b"x", input_format="hwp", sleep=lambda s: None)

    def test_polling_gives_up_and_says_the_last_status(self, wired) -> None:
        # A job stuck in the queue must not hang a worker forever.
        clock = {"t": 0.0}

        def monotonic() -> float:
            return clock["t"]

        def sleep(_s: float) -> None:
            clock["t"] += 60.0

        wired(_Recorder([_job("processing")] * 20))
        with pytest.raises(cr.RemoteConversionError, match="still processing"):
            cr.convert_to_pdf(b"x", input_format="hwp",
                              sleep=sleep, monotonic=monotonic)

    def test_missing_upload_form_is_reported(self, wired) -> None:
        wired(_Recorder([], create_job=_job("waiting", with_form=False)))
        with pytest.raises(cr.RemoteConversionError, match="no upload form"):
            cr.convert_to_pdf(b"x", input_format="hwp", sleep=lambda s: None)


class TestOffByDefault:
    def test_unconfigured_deployment_is_unchanged(self, monkeypatch) -> None:
        """The tier must be invisible when no key is set — a keyless install
        has to fail exactly the way it did before this module existed."""
        monkeypatch.setattr(settings, "cloudconvert_api_key", "", raising=False)
        from uni_db.parse import format_convert as fc

        monkeypatch.setattr(fc, "_run", lambda *a, **k: (_ for _ in ()).throw(
            FileNotFoundError("hwp5txt")))
        with pytest.raises(RuntimeError) as err:
            fc.extract_hwp(b"\xd0\xcf\x11\xe0", fmt="hwp")
        assert "not configured" in str(err.value)
