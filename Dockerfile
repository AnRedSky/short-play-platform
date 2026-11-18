FROM python:3.12-slim

# One image serves all three backend processes: api, worker and beat.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    STORAGE_ROOT=/data/storage \
    PYTHONPATH=/app/src

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y ffmpeg curl \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv \
    && groupadd --gid 10001 shortplay \
    && useradd --uid 10001 --gid shortplay --home-dir /app --shell /usr/sbin/nologin shortplay

COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project

COPY alembic.ini ./
COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh \
    && mkdir -p /data/storage \
    && chown -R shortplay:shortplay /app /data

USER shortplay
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl --fail --silent http://localhost:8000/api/v1/health/ready || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
