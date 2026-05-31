"""Report length of each translation-provider credential in settings."""
from uni_db.config import settings as s


def L(v: str | None) -> int:
    return len(v or "")


print(f"papago_client_id     len={L(s.naver_papago_client_id)}")
print(f"papago_client_secret len={L(s.naver_papago_client_secret)}")
print(f"deepl_api_key        len={L(s.deepl_api_key)}")
print(f"anthropic_api_key    len={L(s.anthropic_api_key)}")
print(f"live_apis            ={s.live_apis}")
