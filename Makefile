# Day-Off demo. Run `make` to see the commands.
# Needs: Node 20+ (or Docker), and make. No other dependencies to run the demo.

PORT ?= 4173

.DEFAULT_GOAL := help
.PHONY: help env start dev test test-install docker-build docker-up docker-down docker-logs clean

help:
	@node scripts/help.mjs

env:
	node scripts/init-env.mjs

start: env
	node server.mjs

dev: start

test-install:
	npm install
	npx playwright install chromium

test:
	npx playwright test

docker-build:
	docker build -t day-off .

docker-up: env
	docker compose up --build -d
	@node -e "console.log('Day-Off is running at http://localhost:$(PORT)')"

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

clean:
	node -e "require('fs').rmSync('test-results',{recursive:true,force:true})"
