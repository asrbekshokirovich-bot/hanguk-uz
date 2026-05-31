"""One-off entrypoint: probe Adiga admissions-calendar CSV.

Mirrors the run_<X>_once.py pattern (discovery, parse, translate).

Usage:
  cd services/uni_db
  python scripts/run_adiga_calendar_once.py

Or, via the production systemd unit on the Hetzner host:
  systemctl start uni-db-adiga-calendar.service
"""

from __future__ import annotations

import asyncio
import sys

from uni_db.workers.adiga_calendar_worker import run


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
