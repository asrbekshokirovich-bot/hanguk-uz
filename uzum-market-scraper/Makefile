.PHONY: help install dev test lint fmt doctor clean

help:
	@echo "Targets:"
	@echo "  install   Install runtime dependencies"
	@echo "  dev       Install runtime + dev dependencies (editable)"
	@echo "  test      Run the test suite"
	@echo "  lint      Run ruff + mypy"
	@echo "  fmt       Auto-format with ruff"
	@echo "  doctor    Check connectivity & auth against Uzum"
	@echo "  clean     Remove caches and build artifacts"

install:
	python -m pip install -r requirements.txt

dev:
	python -m pip install -e ".[dev]"

test:
	python -m pytest

lint:
	ruff check uzum_scraper tests
	mypy uzum_scraper

fmt:
	ruff check --fix uzum_scraper tests
	ruff format uzum_scraper tests

doctor:
	python -m uzum_scraper doctor

clean:
	rm -rf .pytest_cache .ruff_cache .mypy_cache build dist *.egg-info
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
