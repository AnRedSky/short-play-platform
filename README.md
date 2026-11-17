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

依赖就绪探针（PostgreSQL、Redis，降级时返回 503）：http://localhost:8000/api/v1/health/ready

前端开发服务使用 development profile：

```bash
docker compose --profile development up --build
```

前端: http://localhost:5173

## 工程检查

依赖版本以锁文件为准：`backend/uv.lock`、`frontend/package-lock.json`。后端解释器由 `backend/.python-version` 固定为 3.12，与生产镜像一致。

Backend: `cd backend && uv sync --locked --all-groups && uv run ruff check . && uv run pytest -q`

Frontend: `cd frontend && npm ci --no-audit --no-fund && npm run typecheck && npm run lint && npm run test && npm run build`

Compose: `docker compose config --quiet`

以上命令即 CI 中强制执行的项目，仓库不存在因缺少文件而跳过测试或构建的条件逻辑。

详细架构和里程碑见 [docs/README.md](docs/README.md)。
