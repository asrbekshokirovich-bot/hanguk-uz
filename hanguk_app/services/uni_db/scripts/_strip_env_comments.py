"""Strip inline `# comment` from UNI_DB_LIVE_*/UNI_DB_ENV lines in /opt/.env.

Narrow on purpose:
  - Only rewrites lines whose key matches the small allowlist.
  - Preserves everything else byte-identically.
  - Moves the trailing comment text to a `# ...` line ABOVE the value.

Idempotent: running twice is a no-op (already-clean lines pass through).
"""

from pathlib import Path
import re
import sys

TARGET = Path("/opt/hanguk-uni-db/uni_db/.env")
ALLOWED = ("UNI_DB_LIVE_APIS", "UNI_DB_LIVE_CRAWL", "UNI_DB_ENV")

# Match:  KEY=value<spaces>#<comment>
PATTERN = re.compile(
    r"^(?P<key>" + "|".join(ALLOWED) + r")=(?P<value>[^\s#]+)\s+#\s*(?P<comment>.*)$"
)


def main() -> int:
    text = TARGET.read_text(encoding="utf-8")
    lines = text.splitlines()
    out: list[str] = []
    rewritten = 0

    for line in lines:
        m = PATTERN.match(line)
        if m:
            comment_above = f"# {m.group('comment').rstrip()}"
            cleaned = f"{m.group('key')}={m.group('value')}"
            out.append(comment_above)
            out.append(cleaned)
            rewritten += 1
        else:
            out.append(line)

    if rewritten == 0:
        print("no inline-comment lines matched — already clean")
        return 0

    new_text = "\n".join(out) + ("\n" if text.endswith("\n") else "")
    TARGET.write_text(new_text, encoding="utf-8")
    print(f"rewrote {rewritten} lines (added {rewritten} comment-above lines)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
