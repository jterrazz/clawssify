.PHONY: install build test lint lint-fix dev

install:
	pnpm install

build:
	pnpm run build

test:
	pnpm run test

lint:
	pnpm run lint

lint-fix:
	pnpm run lint:fix

dev:
	pnpm run dev:site
