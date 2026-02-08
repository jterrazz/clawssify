# Clawssify

**Your AI librarian.** Share links, articles, or ideas — Clawssify reads them, synthesizes them into organized wiki pages, creates blog articles, and generates a daily changelog. All while you sleep.

Self-hosted. Open source. Your data stays on your machine.

## Quick Start

```bash
git clone https://github.com/jterrazz/clawssify.git
cd clawssify
pnpm install
pnpm dev          # Runs interactive setup, then starts the API server
pnpm dev:site     # Starts the knowledge base UI at http://localhost:5173
```

The setup wizard will guide you through choosing an AI provider and authentication method on first run.

## AI Provider Setup

Clawssify supports multiple authentication methods:

### Use your existing subscription (free)

The setup wizard can authenticate through your Claude Pro/Max or ChatGPT Plus subscription using OAuth — no API key needed.

```bash
# Anthropic (Claude Pro/Max)
AI_PROVIDER=anthropic
AI_AUTH_METHOD=oauth

# OpenAI (ChatGPT Plus/Pro)
AI_PROVIDER=openai
AI_AUTH_METHOD=oauth
```

### Use an API key (pay-per-token)

```bash
# Anthropic
AI_PROVIDER=anthropic
AI_AUTH_METHOD=api-key
AI_API_KEY=sk-ant-...

# OpenAI
AI_PROVIDER=openai
AI_AUTH_METHOD=api-key
AI_API_KEY=sk-...
```

### Use a local model (Ollama, LM Studio, etc.)

```bash
AI_PROVIDER=openai
AI_AUTH_METHOD=api-key
AI_API_KEY=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3
```

## Usage

### Ingest content

```bash
# Ingest a URL
curl -X POST http://localhost:3000/ingest \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{"type": "url", "content": "https://example.com/article"}'

# Ingest a note
curl -X POST http://localhost:3000/ingest \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{"type": "note", "content": "TIL that k3s uses flannel for CNI by default..."}'
```

### View your knowledge base

```bash
pnpm dev:site
# Opens at http://localhost:5173
```

## Docker

```bash
docker compose up -d
```

Or manually:

```bash
docker run -d \
  -p 3000:3000 \
  -v ./data:/data \
  -e AI_PROVIDER=anthropic \
  -e AI_AUTH_METHOD=api-key \
  -e AI_API_KEY=sk-ant-... \
  -e API_KEY=your-secret \
  clawssify
```

## Architecture

```
packages/
  shared/          Shared types and utilities
  server/          Fastify API — ingestion pipeline + agentic AI loop
  site/            Next.js knowledge base UI

data/
  .brain/          AI operating memory (preferences, structure, decisions)
  .sources/        Source tracking (provenance, raw analyses)
  knowledge/
    wiki/          Topic pages that evolve over time
    posts/         One article per ingested source
    digest/        Daily changelog of changes
```

The AI processes content using an **agentic tool-use loop** — it can read, write, search, and edit files in the knowledge base autonomously. Every action is logged.

## Tech Stack

- **Runtime**: Node.js 22, TypeScript 5, ESM
- **API**: Fastify 5
- **AI**: Anthropic SDK + OpenAI SDK (agentic tool-use)
- **Site**: Next.js 15, React 19, Tailwind CSS 4, shadcn/ui
- **Storage**: Markdown + JSON files (no database, git-versioned)
- **Deploy**: Docker (multi-stage, node:22-alpine)

## License

MIT
