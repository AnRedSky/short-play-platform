FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN pip install --no-cache-dir uv
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev --no-install-project
COPY apps ./apps
COPY migrations ./migrations
COPY alembic.ini ./
CMD ["uv", "run", "--no-sync", "uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
