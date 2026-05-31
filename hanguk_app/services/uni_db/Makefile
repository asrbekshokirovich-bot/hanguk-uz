# services/uni_db — common commands
# Phase 0: nothing here applies migrations or hits paid APIs.

PY ?= python3.12
VENV ?= .venv
PIP := $(VENV)/bin/pip
PYTEST := $(VENV)/bin/pytest
RUFF := $(VENV)/bin/ruff
MYPY := $(VENV)/bin/mypy

.PHONY: help install lint typecheck test test-fixtures \
        review-digest crawl-snu-fixture parse-fixture clean

help:
	@echo "Common targets:"
	@echo "  install         Create venv and install dev deps"
	@echo "  lint            Run ruff"
	@echo "  typecheck       Run mypy"
	@echo "  test            Run pytest (fixtures only — no live APIs)"
	@echo "  test-fixtures   Run only fixture-backed integration tests"
	@echo "  review-digest   Print HITL review queue as markdown (Phase 0 v1)"
	@echo "  crawl-snu-fixture   Run discovery loop against the SNU fixture"
	@echo "  parse-fixture       Run extractor (mocked LLM) against fixture PDF"
	@echo "  clean           Remove venv and caches"

install:
	$(PY) -m venv $(VENV)
	$(PIP) install --upgrade pip
	$(PIP) install -e ".[dev]"

lint:
	$(RUFF) check src tests

typecheck:
	$(MYPY) src

test:
	$(PYTEST) -q

test-fixtures:
	$(PYTEST) -q tests/integration -k fixture

review-digest:
	$(VENV)/bin/uni-db review-digest

crawl-snu-fixture:
	$(VENV)/bin/uni-db crawl --source snu --fixture

parse-fixture:
	$(VENV)/bin/uni-db parse --fixture sample_pdf

clean:
	rm -rf $(VENV) .pytest_cache .mypy_cache .ruff_cache **/__pycache__ build dist *.egg-info
