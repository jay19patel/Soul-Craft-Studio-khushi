.PHONY: dev prod dev-down prod-down dev-logs prod-logs

dev:
	docker compose -f docker-compose.dev.yml up --build

prod:
	docker compose --env-file ./backend/.env -f docker-compose.prod.yml up --build -d

dev-down:
	docker compose -f docker-compose.dev.yml down

prod-down:
	docker compose --env-file ./backend/.env -f docker-compose.prod.yml down

dev-logs:
	docker compose -f docker-compose.dev.yml logs -f

prod-logs:
	docker compose --env-file ./backend/.env -f docker-compose.prod.yml logs -f
