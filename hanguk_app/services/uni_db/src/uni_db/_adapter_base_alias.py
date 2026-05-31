"""Internal re-export — keeps `workers/` decoupled from the import path
of `discovery/_adapter_base.py` while not introducing a circular import.
"""

from .discovery._adapter_base import SourceAdapter as SourceAdapter

__all__ = ["SourceAdapter"]
