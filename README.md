# Clawssify

**Your AI librarian.** Share links, articles, or ideas — Clawssify reads them, synthesizes them into organized wiki pages, creates blog articles, and generates a daily changelog. All while you sleep.

Self-hosted. Open source. Your data stays on your machine.

## Quick Start

```bash
git clone https://github.com/jterrazz/clawssify.git
cd clawssify
pnpm install
pnpm dev
```

That's it. On first run, the interactive CLI walks you through:

1. **Pick your AI provider** — Claude, OpenAI, or Gemini (arrow keys to select)
2. **Pick a model** — each provider offers fast, balanced, and capable options
3. **Sign in** — browser-based OAuth for Claude/OpenAI, or paste an API key for Gemini

Once configured, the dev CLI starts both the API server and the knowledge base UI, and gives you an interactive prompt to ingest content directly.

## Dev CLI

`pnpm dev` launches an interactive terminal with:

- **Live logs** — server and proxy output, formatted and truncated to fit your terminal
- **Inline ingestion** — paste a URL or type a note, hit Enter to ingest
- **Progress tracking** — animated progress bar while AI classifies your content
- **Queue status** — see what's processing, what's done, and what failed

### Commands

| Command | Description |
|---------|-------------|
| `https://...` | Ingest a URL |
| `any text` | Ingest as a note |
| `/help` | Show available commands |
| `/logout` | Remove AI credentials |
| `/quit` | Exit dev mode |

## AI Providers

### Claude (Anthropic)

Use your existing Claude Pro/Max subscription (OAuth) or an API key.

```bash
AI_PROVIDER=anthropic
AI_AUTH_METHOD=oauth          # uses your subscription, no extra cost
# or
AI_AUTH_METHOD=api-key
AI_API_KEY=sk-ant-...         # pay-per-token from console.anthropic.com
```

Models: `claude-sonnet-4-5-20250929`, `claude-opus-4-6`, `claude-haiku-4-5-20251001`

### OpenAI

Use your ChatGPT Plus/Pro subscription (OAuth) or an API key.

```bash
AI_PROVIDER=openai
AI_AUTH_METHOD=oauth          # uses your subscription
# or
AI_AUTH_METHOD=api-key
AI_API_KEY=sk-...             # pay-per-token from platform.openai.com
```

Models: `gpt-5.2`, `gpt-5-mini`, `gpt-5`

### Gemini (Google)

Use your Google account (OAuth) or an API key from [aistudio.google.com](https://aistudio.google.com).

```bash
AI_PROVIDER=gemini
AI_AUTH_METHOD=oauth          # uses your Google account
# or
AI_AUTH_METHOD=api-key
AI_API_KEY=...                # from aistudio.google.com
```

Models: `gemini-2.5-pro`, `gemini-2.5-flash`, `gemini-3-flash-preview`

### Local models (Ollama, LM Studio, etc.)

```bash
AI_PROVIDER=openai
AI_AUTH_METHOD=api-key
AI_API_KEY=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3
```

## API

You can also ingest content programmatically:

```bash
curl -X POST http://localhost:3000/ingest \
  -H "Authorization: Bearer <your-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"type": "url", "content": "https://example.com/article"}'
```

The API key is auto-generated on first setup and stored in `packages/server/.env`.

## Architecture

```
packages/
  shared/          Shared types and utilities
  server/          Fastify API + interactive dev CLI (ink)
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

- **Runtime**: Node.js 22, TypeScript 5, pnpm, ESM
- **API**: Fastify 5
- **AI**: Anthropic SDK, OpenAI SDK, Gemini (via OpenAI-compatible API)
- **Dev CLI**: Ink (React for terminals)
- **Auth**: CLIProxyAPI for OAuth (Claude/OpenAI subscriptions)
- **Site**: Next.js 15, React 19, Tailwind CSS 4, shadcn/ui
- **Storage**: Markdown + JSON files (no database, git-versioned)
- **Deploy**: Docker (multi-stage, node:22-alpine)

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Interactive dev CLI (server + site + ingestion prompt) |
| `pnpm dev:site` | Site only at http://localhost:5173 |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint with Biome |
| `pnpm test` | Run tests |

## License

MIT
