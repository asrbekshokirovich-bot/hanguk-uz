"""Tests for the live (Phase 3) translation provider call sites.

No live network: every test that exercises a live path either patches
`_get_client` / `_get_translator` (Anthropic, DeepL) or uses respx to
mock the Papago HTTP endpoint.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx
import pytest
import respx
from tenacity import stop_after_attempt, wait_none

from uni_db.translate import claude as claude_adapter
from uni_db.translate import deepl as deepl_adapter
from uni_db.translate import papago as papago_adapter


@pytest.fixture
def fast_papago_retry(monkeypatch: pytest.MonkeyPatch):
    """Bypass tenacity backoff inside _call_papago for tests that
    intentionally drive an error through the retry decorator. Keeps
    the production retry config untouched."""
    monkeypatch.setattr(papago_adapter._call_papago.retry, "wait", wait_none())
    monkeypatch.setattr(
        papago_adapter._call_papago.retry, "stop", stop_after_attempt(1)
    )


# ---------------------------------------------------------------------------
# Fakes for the Anthropic SDK shape (claude.py uses messages.create)
# ---------------------------------------------------------------------------


@dataclass
class _FakeUsage:
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class _FakeContentBlock:
    text: str
    type: str = "text"


@dataclass
class _FakeAnthropicResponse:
    content: list[_FakeContentBlock]
    usage: _FakeUsage
    model: str = "claude-sonnet-4-6"


class _FakeMessages:
    def __init__(self, response: _FakeAnthropicResponse) -> None:
        self._response = response
        self.last_kwargs: dict[str, Any] | None = None

    def create(self, **kwargs: Any) -> _FakeAnthropicResponse:
        self.last_kwargs = kwargs
        return self._response


class _FakeAnthropic:
    def __init__(self, response: _FakeAnthropicResponse) -> None:
        self.messages = _FakeMessages(response)


# ---------------------------------------------------------------------------
# Claude — mock path stays the default
# ---------------------------------------------------------------------------


class TestClaudeMockPath:
    def test_returns_mock_when_live_apis_false(self) -> None:
        out = claude_adapter.translate(
            source_text_ko="2026.09.01 원서접수",
            target_lang="en",
        )
        assert out.provider == "claude"
        assert out.text_value.startswith("[claude-mock en]")
        assert out.via_pivot is False

    def test_pivot_changes_mock_prefix_and_confidence(self) -> None:
        out = claude_adapter.translate(
            source_text_ko="some english text",
            target_lang="uz",
            pivot="en",
        )
        assert "ko->en->uz" in out.text_value
        assert out.via_pivot is True
        assert out.confidence == 0.55


# ---------------------------------------------------------------------------
# Claude — live path with fake client
# ---------------------------------------------------------------------------


@pytest.fixture
def claude_live(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(claude_adapter.settings, "live_apis", True)
    monkeypatch.setattr(claude_adapter.settings, "anthropic_api_key", "sk-ant-test")
    monkeypatch.setattr(
        claude_adapter.settings, "anthropic_model_translate", "claude-sonnet-4-6"
    )
    monkeypatch.setattr(claude_adapter.settings, "http_request_timeout_sec", 30)


class TestClaudeLivePath:
    def test_raises_runtime_error_when_api_key_missing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(claude_adapter.settings, "live_apis", True)
        monkeypatch.setattr(claude_adapter.settings, "anthropic_api_key", "")
        with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY"):
            claude_adapter.translate(
                source_text_ko="some korean", target_lang="en"
            )

    def test_calls_anthropic_and_returns_text(
        self, claude_live, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _FakeAnthropic(
            _FakeAnthropicResponse(
                content=[_FakeContentBlock(text="September 1, 2026: applications open.")],
                usage=_FakeUsage(input_tokens=120, output_tokens=18),
            )
        )
        monkeypatch.setattr(claude_adapter, "_get_client", lambda: client)
        out = claude_adapter.translate(
            source_text_ko="2026.09.01 원서접수",
            target_lang="en",
        )
        assert out.provider == "claude"
        assert out.text_value == "September 1, 2026: applications open."
        kwargs = client.messages.last_kwargs
        assert kwargs is not None
        assert kwargs["system"][0]["cache_control"] == {"type": "ephemeral"}
        assert "English" in kwargs["system"][0]["text"]

    def test_strips_markdown_fences(
        self, claude_live, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _FakeAnthropic(
            _FakeAnthropicResponse(
                content=[
                    _FakeContentBlock(text="```\nSeptember 1, 2026: applications open.\n```")
                ],
                usage=_FakeUsage(),
            )
        )
        monkeypatch.setattr(claude_adapter, "_get_client", lambda: client)
        out = claude_adapter.translate(
            source_text_ko="some ko", target_lang="en"
        )
        assert out.text_value == "September 1, 2026: applications open."

    def test_pivot_path_includes_pivot_in_system_prompt(
        self, claude_live, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        client = _FakeAnthropic(
            _FakeAnthropicResponse(
                content=[_FakeContentBlock(text="2026 yil 1-sentyabr...")],
                usage=_FakeUsage(),
            )
        )
        monkeypatch.setattr(claude_adapter, "_get_client", lambda: client)
        out = claude_adapter.translate(
            source_text_ko="September 1, 2026",
            target_lang="uz",
            pivot="en",
        )
        kwargs = client.messages.last_kwargs
        assert kwargs is not None
        assert "pivoted" in kwargs["system"][0]["text"].lower()
        assert out.via_pivot is True


# ---------------------------------------------------------------------------
# Papago — mock + live (live uses respx to mock httpx)
# ---------------------------------------------------------------------------


class TestPapagoMockPath:
    def test_returns_mock_when_live_apis_false(self) -> None:
        out = papago_adapter.translate(
            source_text_ko="2026.09.01 원서접수", target_lang="vi"
        )
        assert out.provider == "papago"
        assert out.text_value.startswith("[papago-mock vi]")

    def test_unsupported_target_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="does not support"):
            papago_adapter.translate(
                source_text_ko="some ko", target_lang="uz"
            )


@pytest.fixture
def papago_live(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(papago_adapter.settings, "live_apis", True)
    monkeypatch.setattr(papago_adapter.settings, "naver_papago_client_id", "papago-id")
    monkeypatch.setattr(
        papago_adapter.settings, "naver_papago_client_secret", "papago-secret"
    )
    monkeypatch.setattr(papago_adapter.settings, "http_request_timeout_sec", 30)
    monkeypatch.setattr(
        papago_adapter.settings, "http_user_agent", "HangukUniDBBot-test"
    )


class TestPapagoLivePath:
    def test_raises_when_credentials_missing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(papago_adapter.settings, "live_apis", True)
        monkeypatch.setattr(papago_adapter.settings, "naver_papago_client_id", "")
        monkeypatch.setattr(papago_adapter.settings, "naver_papago_client_secret", "")
        with pytest.raises(RuntimeError, match="Papago credentials"):
            papago_adapter.translate(
                source_text_ko="some ko", target_lang="en"
            )

    def test_calls_papago_and_returns_translated_text(
        self, papago_live, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.post(papago_adapter._PAPAGO_ENDPOINT).mock(
            return_value=httpx.Response(
                200,
                json={
                    "message": {
                        "result": {
                            "translatedText": "September 1, 2026: application opens",
                            "srcLangType": "ko",
                            "tarLangType": "en",
                        }
                    }
                },
            )
        )
        out = papago_adapter.translate(
            source_text_ko="2026.09.01 원서접수", target_lang="en"
        )
        assert out.provider == "papago"
        assert out.text_value == "September 1, 2026: application opens"
        # Verify the request shape
        sent = respx_mock.calls.last.request
        assert sent.headers["X-NCP-APIGW-API-KEY-ID"] == "papago-id"
        assert sent.headers["X-NCP-APIGW-API-KEY"] == "papago-secret"
        body = sent.content.decode()
        assert "source=ko" in body
        assert "target=en" in body

    def test_5xx_raises_papago_api_error_for_retry(
        self, papago_live, fast_papago_retry, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.post(papago_adapter._PAPAGO_ENDPOINT).mock(
            return_value=httpx.Response(503, text="upstream busy")
        )
        with pytest.raises(papago_adapter.PapagoAPIError):
            papago_adapter.translate(
                source_text_ko="some ko", target_lang="en"
            )

    def test_4xx_raises_runtime_error_no_retry(
        self, papago_live, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.post(papago_adapter._PAPAGO_ENDPOINT).mock(
            return_value=httpx.Response(400, text="bad request")
        )
        with pytest.raises(RuntimeError, match="non-retriable"):
            papago_adapter.translate(
                source_text_ko="some ko", target_lang="en"
            )

    def test_malformed_response_raises_papago_api_error(
        self, papago_live, fast_papago_retry, respx_mock: respx.MockRouter
    ) -> None:
        respx_mock.post(papago_adapter._PAPAGO_ENDPOINT).mock(
            return_value=httpx.Response(200, json={"unexpected": "shape"})
        )
        with pytest.raises(papago_adapter.PapagoAPIError):
            papago_adapter.translate(
                source_text_ko="some ko", target_lang="en"
            )


# ---------------------------------------------------------------------------
# DeepL — mock + live (live patches the SDK Translator)
# ---------------------------------------------------------------------------


class TestDeepLMockPath:
    def test_returns_mock_when_live_apis_false(self) -> None:
        out = deepl_adapter.translate(
            source_text_ko="some ko", target_lang="en"
        )
        assert out.provider == "deepl"
        assert out.text_value.startswith("[deepl-mock en]")

    def test_unsupported_target_raises_value_error(self) -> None:
        with pytest.raises(ValueError, match="does not support"):
            deepl_adapter.translate(
                source_text_ko="some ko", target_lang="vi"
            )


@dataclass
class _FakeDeepLResult:
    text: str


class _FakeDeepLTranslator:
    def __init__(
        self,
        result: _FakeDeepLResult | list[_FakeDeepLResult] | Exception,
    ) -> None:
        self._result = result
        self.last_kwargs: dict[str, Any] | None = None

    def translate_text(self, source_text_ko: str, **kwargs: Any) -> Any:
        self.last_kwargs = {"source_text_ko": source_text_ko, **kwargs}
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


@pytest.fixture
def deepl_live(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(deepl_adapter.settings, "live_apis", True)
    monkeypatch.setattr(deepl_adapter.settings, "deepl_api_key", "test-deepl-key")


class TestDeepLLivePath:
    def test_raises_when_api_key_missing(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setattr(deepl_adapter.settings, "live_apis", True)
        monkeypatch.setattr(deepl_adapter.settings, "deepl_api_key", "")
        with pytest.raises(RuntimeError, match="DEEPL_API_KEY"):
            deepl_adapter.translate(
                source_text_ko="some ko", target_lang="en"
            )

    def test_calls_deepl_and_returns_text(
        self, deepl_live, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        translator = _FakeDeepLTranslator(_FakeDeepLResult(text="Hello world."))
        monkeypatch.setattr(deepl_adapter, "_get_translator", lambda: translator)
        out = deepl_adapter.translate(
            source_text_ko="안녕하세요", target_lang="en"
        )
        assert out.provider == "deepl"
        assert out.text_value == "Hello world."
        assert translator.last_kwargs is not None
        assert translator.last_kwargs["source_lang"] == "KO"
        assert translator.last_kwargs["target_lang"] == "EN-US"

    def test_unwraps_single_element_list_result(
        self, deepl_live, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        translator = _FakeDeepLTranslator([_FakeDeepLResult(text="Hello world.")])
        monkeypatch.setattr(deepl_adapter, "_get_translator", lambda: translator)
        out = deepl_adapter.translate(
            source_text_ko="안녕", target_lang="en"
        )
        assert out.text_value == "Hello world."

    def test_empty_list_result_raises_deepl_api_error(
        self, deepl_live, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        translator = _FakeDeepLTranslator([])
        monkeypatch.setattr(deepl_adapter, "_get_translator", lambda: translator)
        with pytest.raises(deepl_adapter.DeepLAPIError):
            deepl_adapter.translate(source_text_ko="안녕", target_lang="en")
