# 企业级 AI 短剧智能生产平台

企业内部多用户短剧生产管理平台，采用 Linux + Docker Compose 私有化部署。不是 SaaS 多租户产品。

## 技术栈

- Backend: Python 3.12+, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, Celery
- Frontend: Vue 3, TypeScript, Vite, Pinia, Vue Router
- Infrastructure: PostgreSQL, Redis, Docker Compose
- Media: FFmpeg / ffprobe（后续里程碑接入）

## 本地启动

```bash
cp .env.example .env
docker compose up --build
```

API: http://localhost:8000/api/v1/health

前端开发服务使用 development profile：

```bash
docker compose --profile development up --build
```

前端: http://localhost:5173

## 工程检查

Backend: `cd backend && uv sync --all-groups && uv run ruff check . && uv run pytest -q`

Frontend: `cd frontend && npm install && npm run typecheck && npm run lint && npm run test && npm run build`

详细架构和里程碑见 [docs/README.md](docs/README.md)。
