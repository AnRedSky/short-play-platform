# 企业级 AI 短剧智能生产平台

企业内部多用户短剧生产管理平台，采用 Linux + Docker Compose 私有化部署。不是 SaaS 多租户产品。

## 技术栈

- Backend: Python 3.12+, FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, Celery
- Frontend: Vue 3, TypeScript, Vite, Pinia, Vue Router（`web/`）
- Infrastructure: PostgreSQL, Redis, RabbitMQ, Docker Compose
- Media: FFmpeg / ffprobe

## 目录结构

```text
src/app/          # 分层后端：config / public / dependencies / domains / middleware
                  #          bootstrap / infrastructure / workers / router / utils / packages
migrations/       # Alembic 迁移脚本与环境
tests/            # 与 src/app 镜像对齐的测试
web/              # Vue 3 + Vite 前端
docker/           # nginx / entrypoint / infra 与生产 compose
scripts/          # 运维与开发脚本
```

依赖方向单向：`config`、`public`、`utils`、`infrastructure` → `dependencies` → `domains` →
`bootstrap`、`router`、`workers`。业务域之间不引用其他域的 router / service 内部实现。

## 本地启动

基础服务（PostgreSQL / Redis / RabbitMQ）与项目服务分开编排，基础服务可被同主机其他项目复用：

```bash
docker compose -f docker/docker-compose.infra.yml up -d
docker compose up --build -d
```

配置无需额外文件即可启动：应用按 `.env.example` → `.env` → `.env.{APP_ENV}` → 进程环境变量
逐层叠加，后者覆盖前者，任一键在前一层缺失时才回落到后一层；`.env` 与其环境专属文件按需创建，
只写需要改的键（`cp .env.example .env`）。本机直接运行 `python start_api.py` 时，启动日志会打印
实际生效的配置文件与监听端口。
```

API: http://localhost:8000/api/v1/health

依赖就绪探针（PostgreSQL、Redis，降级时返回 503）：http://localhost:8000/api/v1/health/ready

前端容器（静态构建 + 同源 `/api` 反代）：http://localhost:5173

前端本地开发（Vite dev server，代理 `/api` 到 8000）：

```bash
cd web && npm ci --no-audit --no-fund && npm run dev
```

## 工程检查

依赖版本以锁文件为准：`uv.lock`、`web/package-lock.json`。后端解释器由 `.python-version`
固定为 3.12，与生产镜像一致。

Backend：`uv sync --locked --all-groups && uv run ruff check . && uv run pytest -q`（源码根通过
`PYTHONPATH=src` / pytest `pythonpath` 注入，无需 `cd`）

Frontend：`cd web && npm ci --no-audit --no-fund && npm run typecheck && npm run lint && npm run test && npm run build`

Compose：`docker compose config --quiet`

以上命令即 CI 中强制执行的项目，仓库不存在因缺少文件而跳过测试或构建的条件逻辑。

常用本地任务见 `Makefile`（`make help`）：`infra-up`、`api`、`worker`、`beat`、`web-dev`、
`lint`、`test`、`build`、`up`、`down`。

详细架构和里程碑见 [docs/README.md](docs/README.md)。
