.PHONY: help infra-up infra-down api worker beat web-install web-dev lint test build up down

help:
	@echo "infra-up infra-down api worker beat web-install web-dev lint test build up down"

infra-up:
	docker compose -f docker/docker-compose.infra.yml up -d

infra-down:
	docker compose -f docker/docker-compose.infra.yml down

api:
	uv run python start_api.py

worker:
	uv run python start_worker.py

beat:
	uv run python start_worker.py --beat

web-install:
	cd web && npm install

web-dev:
	cd web && npm run dev

lint:
	uv run ruff check .

test:
	uv run pytest -q

build:
	cd web && npm run build

up:
	docker compose up --build -d

down:
	docker compose down
