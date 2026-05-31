"""Korean number normaliser — covers the formats listed in audit §4.4 / §5.3."""

from uni_db.parse.numbers_ko import parse_korean_amount


class TestPlainDigits:
    def test_comma_grouping(self) -> None:
        out = parse_korean_amount("4,800,000원")
        assert out is not None and out.amount_krw == 4_800_000

    def test_no_grouping(self) -> None:
        out = parse_korean_amount("4800000")
        assert out is not None and out.amount_krw == 4_800_000

    def test_krw_prefix(self) -> None:
        out = parse_korean_amount("KRW 5,000,000")
        assert out is not None and out.amount_krw == 5_000_000

    def test_won_symbol(self) -> None:
        out = parse_korean_amount("₩ 4,800,000")
        assert out is not None and out.amount_krw == 4_800_000


class TestKoreanMultipliers:
    def test_man(self) -> None:
        out = parse_korean_amount("480만원")
        assert out is not None and out.amount_krw == 4_800_000

    def test_baek(self) -> None:
        out = parse_korean_amount("3백만원")
        assert out is not None and out.amount_krw == 3_000_000

    def test_compound_ok_man(self) -> None:
        # 4억 8000만원 = 4 × 10⁸ + 8000 × 10⁴ = 480,000,000
        out = parse_korean_amount("4억 8000만원")
        assert out is not None
        assert out.amount_krw == 480_000_000


class TestEdgeCases:
    def test_returns_none_when_no_digits(self) -> None:
        assert parse_korean_amount("계약 협의") is None

    def test_empty_string(self) -> None:
        assert parse_korean_amount("") is None

    def test_preserves_original(self) -> None:
        out = parse_korean_amount("  4,800,000원  ")
        assert out is not None
        assert out.original == "4,800,000원"
