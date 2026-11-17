.PHONY: help infra-up infra-down backend-install backend-lint backend-test frontend-install frontend-build

help:
	@echo "infra-up infra-down backend-install backend-lint backend-test frontend-install frontend-build"

infra-up:
	docker compose up -d postgres redis

infra-down:
	docker compose down

backend-install:
	cd backend && uv sync --all-groups

backend-lint:
	cd backend && uv run ruff check .

backend-test:
	cd backend && uv run pytest -q

frontend-install:
	cd frontend && npm install

frontend-build:
	cd frontend && npm run build
