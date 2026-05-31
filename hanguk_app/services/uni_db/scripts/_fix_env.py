"""One-off: rewrite the corrupted SUPABASE_SERVICE_ROLE_KEY in /opt/.env."""
from pathlib import Path

NEW_JWT = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5c2pkdHlhbmhkZnBocXlpanNyIiwicm9sZSI6"
    "InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg1NTEwNiwiZXhwIjoyMDg4NDMxMTA2fQ."
    "68R5Yiz8wOyWvtDy5bt263C-d6pSykMkDC2YAt0Og_E"
)

p = Path("/opt/hanguk-uni-db/uni_db/.env")
text = p.read_text(encoding="utf-8")
lines = text.splitlines()
out = []
replaced = False
for line in lines:
    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
        out.append(f"SUPABASE_SERVICE_ROLE_KEY={NEW_JWT}")
        replaced = True
    else:
        out.append(line)
p.write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"replaced={replaced} new_line_len={len('SUPABASE_SERVICE_ROLE_KEY=' + NEW_JWT)}")
