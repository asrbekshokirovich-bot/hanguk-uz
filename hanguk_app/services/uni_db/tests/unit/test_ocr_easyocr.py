"""ADR-002 — EasyOCR provider tests (mocked; no model download)."""

from uni_db.parse import ocr_easyocr


class TestOcrPdfBytesStub:
    def test_returns_stub_when_live_apis_off(self) -> None:
        # conftest already pins UNI_DB_LIVE_APIS=false for the suite,
        # so this is the default code path.
        result = ocr_easyocr.ocr_pdf_bytes(b"%PDF-fake")
        assert result.extractor == "easyocr"
        assert result.pages == 0
        assert result.cost_usd_estimate == 0.0
        assert "stubbed" in result.text.lower()


class TestRunOcrProviderSwap:
    def test_default_provider_is_easyocr(self, monkeypatch) -> None:
        monkeypatch.setattr(
            ocr_easyocr.settings, "ocr_provider", "easyocr", raising=False
        )
        result = ocr_easyocr.run_ocr(b"%PDF-fake")
        assert result.extractor == "easyocr"

    def test_naver_clova_swap_works_when_configured(self, monkeypatch) -> None:
        monkeypatch.setattr(
            ocr_easyocr.settings, "ocr_provider", "naver_clova", raising=False
        )
        # Should not raise — Clova stub returns its own OcrResult shape.
        result = ocr_easyocr.run_ocr(b"%PDF-fake")
        assert result.extractor == "naver_clova"


class TestReaderCacheKey:
    def test_default_languages_are_korean_plus_english(self) -> None:
        assert ocr_easyocr.DEFAULT_LANGUAGES == ("ko", "en")

    def test_reader_factory_is_lru_cached(self) -> None:
        # Calling _get_reader twice with the same languages must return
        # the same object (the cache key is the tuple). We can't actually
        # load EasyOCR in CI, so we just check the cache_clear API works.
        ocr_easyocr._get_reader.cache_clear()
        # No assertion — this just proves the lru_cache decorator was
        # applied without exploding the module.
