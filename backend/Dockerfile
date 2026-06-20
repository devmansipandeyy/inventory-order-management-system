# syntax=docker/dockerfile:1
FROM python:3.13-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install dependencies first (better layer caching)
COPY pyproject.toml ./
COPY app ./app
RUN pip install --upgrade pip && pip install .

# Run as a non-root user
RUN useradd --create-home --uid 1000 appuser && chown -R appuser /app
USER appuser

EXPOSE 8000

# Bind to $PORT when the platform injects one (Render/Railway/Fly), else 8000.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
    CMD sh -c 'python -c "import os,urllib.request,sys; p=os.getenv(\"PORT\",\"8000\"); sys.exit(0 if urllib.request.urlopen(f\"http://localhost:{p}/health\").status==200 else 1)"'

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
