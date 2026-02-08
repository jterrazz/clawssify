# Clawssify

**Your AI librarian.** Share links, articles, or ideas — Clawssify reads them, synthesizes them into organized wiki pages, creates blog articles, and generates a daily changelog. All while you sleep.

Self-hosted. Open source. Your data stays on your machine.

## Quick Start

```bash
git clone https://github.com/jterrazz/clawssify.git
cd clawssify
cp .env.example .env
# Edit .env with your AI provider credentials
pnpm install
pnpm dev
```

## AI Provider Setup

Clawssify supports 5 authentication methods:

### Use your existing subscription (free)

**Claude Pro/Max:**
```bash
# Generate an OAuth token from your subscription
claude setup-token
# Copy the token into .env:
AI_PROVIDER=anthropic
AI_AUTH_METHOD=oauth
CLAUDE_OAUTH_TOKEN=<paste token>
```

**ChatGPT Plus/Pro:**
```bash
# Sign in with Codex CLI
codex login
# Token auto-read from ~/.codex/auth.json, or set manually:
AI_PROVIDER=openai
AI_AUTH_METHOD=oauth
OPENAI_OAUTH_TOKEN=<paste token>
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
  -d '{
    "type": "url",
    "content": "https://example.com/article",
    "impact": "standard"
  }'

# Ingest a note
curl -X POST http://localhost:3000/ingest \
  -H "Authorization: Bearer your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "note",
    "content": "TIL that k3s uses flannel for CNI by default...",
    "impact": "auto"
  }'
```

### Impact levels

| Level | Behavior |
|-------|----------|
| `auto` | AI decides based on content complexity |
| `bookmark` | Quick save — short summary post, no wiki changes |
| `standard` | Full rewritten article + wiki page create/merge |
| `deep` | Thorough analysis + detailed wiki updates |

### View your knowledge base

```bash
pnpm --filter @clawssify/site dev
# Opens VitePress at http://localhost:5173
```

## Docker

```bash
# Build and run
docker compose up -d

# Or with docker run
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

- **Runtime**: Node.js 22, TypeScript, ESM
- **API**: Fastify 5
- **AI**: Anthropic SDK + OpenAI SDK (agentic tool-use loop)
- **Knowledge site**: VitePress
- **Storage**: Markdown + JSON (no database)
- **Deploy**: Docker

## License

MIT
