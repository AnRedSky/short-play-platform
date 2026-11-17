FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STORAGE_ROOT=/data/storage
WORKDIR /app
RUN apt-get update \
    && apt-get install --no-install-recommends -y ffmpeg curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv \
    && groupadd --gid 10001 shortplay \
    && useradd --uid 10001 --gid shortplay --home-dir /app --shell /usr/sbin/nologin shortplay
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY apps ./apps
COPY migrations ./migrations
COPY alembic.ini ./
RUN mkdir -p /data/storage && chown -R shortplay:shortplay /app /data
USER shortplay
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail --silent http://localhost:8000/api/v1/health/ready || exit 1
CMD ["uv", "run", "--no-sync", "uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
