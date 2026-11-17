# 后端工程

本目录承载 FastAPI 模块化单体后端。Python 3.12+，使用 uv 管理依赖。

当前为初始化配置骨架，业务应用入口、数据库会话、Celery Worker、Alembic env.py 和模块实现将在 M0/M1 任务中补齐。不要将尚未实现的能力描述为可用功能。

常用命令（工程文件补齐后启用）：
- `uv sync --all-groups`
- `uv run ruff check .`
- `uv run ruff format --check .`
- `uv run pytest -q`
