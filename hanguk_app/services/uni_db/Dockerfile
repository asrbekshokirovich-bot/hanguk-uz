# Phase 0: Dockerfile is provided so the VPS deploy is ready,
# but the image is NOT built or pushed in this pass.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential ghostscript poppler-utils libgl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml README.md ./
COPY src ./src

RUN pip install --upgrade pip && pip install .

# Default command runs the discovery worker; override with `docker run ... uni-db <cmd>`.
ENTRYPOINT ["uni-db"]
CMD ["discovery"]
