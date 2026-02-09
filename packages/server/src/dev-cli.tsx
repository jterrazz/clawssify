import 'dotenv/config'
import { type ChildProcess, spawn } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { Box, Text, render, useApp, useInput } from 'ink'
import TextInput from 'ink-text-input'
import React, { useCallback, useEffect, useState } from 'react'
import { buildApp } from './app.js'
import { loadConfig } from './config.js'
import { initializeDataDirectory } from './services/storage/init.js'

// --- Log formatting ---

const LEVEL_NAMES: Record<number, string> = {
  10: 'TRACE',
  20: 'DEBUG',
  30: 'INFO',
  40: 'WARN',
  50: 'ERROR',
  60: 'FATAL',
}

interface LogEntry {
  id: number
  text: string
  level: string
}

let logCounter = 0

function formatParsedLog(obj: Record<string, unknown>): LogEntry {
  const levelName = LEVEL_NAMES[obj.level as number] || 'LOG'
  const time = new Date(obj.time as number).toLocaleTimeString()
  const msg = (obj.msg as string) || ''
  const {
    level: _,
    time: _t,
    pid: _p,
    hostname: _h,
    msg: _m,
    reqId: _r,
    req: _req,
    res: _res,
    responseTime: _rt,
    ...rest
  } = obj
  const extraStr = Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : ''
  const extra = extraStr.length > 80 ? `${extraStr.slice(0, 77)}...` : extraStr
  return {
    id: logCounter++,
    text: `${time}  ${levelName.padEnd(5)}  ${msg}${extra}`,
    level: levelName,
  }
}

function parsePlainLine(line: string, prefix: string): LogEntry {
  const trimmed = line.trim()
  if (!trimmed) return { id: logCounter++, text: '', level: 'LOG' }
  return { id: logCounter++, text: `${prefix} ${trimmed}`, level: 'LOG' }
}

// --- AI status check ---

function checkAIStatus(config: {
  ai: { authMethod: string; apiKey?: string; provider: string }
  dataDir: string
}): { connected: boolean; detail: string } {
  if (config.ai.authMethod === 'oauth') {
    if (hasOAuthCredentials(config.dataDir, config.ai.provider)) {
      return { connected: true, detail: 'oauth' }
    }
    return { connected: false, detail: 'oauth (no credentials)' }
  }

  if (config.ai.apiKey) return { connected: true, detail: 'api-key' }
  return { connected: false, detail: 'no api key' }
}

function deleteAICredentials(dataDir: string): number {
  const authDir = resolve(dataDir, '.proxy', 'auth')
  let deleted = 0
  try {
    const files = readdirSync(authDir)
    for (const f of files) {
      if (f.endsWith('.json')) {
        rmSync(resolve(authDir, f))
        deleted++
      }
    }
  } catch {
    // directory doesn't exist
  }
  return deleted
}

// --- Queue: poll sources.json for status ---

interface QueueItem {
  sourceId: string
  label: string
  type: 'url' | 'note'
  status: 'processing' | 'processed' | 'bookmarked' | 'failed'
  step: number // 0=queued, 1=extracting, 2=analyzing, 3=saving
  addedAt: number
  completedAt?: number
}

function readAllSources(dataDir: string): Map<string, { status: string; title?: string }> {
  try {
    const raw = readFileSync(resolve(dataDir, '.sources', 'sources.json'), 'utf-8')
    const sources = JSON.parse(raw) as Array<{ id: string; status: string; title?: string }>
    const map = new Map<string, { status: string; title?: string }>()
    for (const s of sources) {
      map.set(s.id, { status: s.status, title: s.title })
    }
    return map
  } catch {
    return new Map()
  }
}

// --- Log bridge (pino + child processes → ink) ---

class LogBridge extends EventEmitter {
  createStream(): Writable {
    return new Writable({
      write: (chunk, _encoding, callback) => {
        const lines = chunk.toString().split('\n').filter(Boolean)
        for (const line of lines) {
          let parsed: Record<string, unknown> | null = null
          try {
            parsed = JSON.parse(line)
          } catch {
            // not JSON
          }

          this.emit(
            'log',
            parsed ? formatParsedLog(parsed) : { id: logCounter++, text: line, level: 'LOG' },
          )

          // Detect pipeline step changes
          if (parsed?.sourceId && parsed?.msg) {
            const sourceId = parsed.sourceId as string
            const msg = parsed.msg as string
            if (msg === 'Starting ingestion') {
              this.emit('step', { sourceId, step: 1 })
            } else if (msg === 'Content extracted') {
              this.emit('step', { sourceId, step: 2 })
            } else if (msg === 'AI processing complete') {
              this.emit('step', { sourceId, step: 3 })
            }
          }
        }
        callback()
      },
    })
  }

  addLine(entry: LogEntry) {
    this.emit('log', entry)
  }

  addPlain(text: string, prefix: string) {
    this.emit('log', parsePlainLine(text, prefix))
  }
}

// --- Site process ---

function spawnSiteProcess(projectRoot: string, logBridge: LogBridge): ChildProcess {
  const proc = spawn('pnpm', ['--filter', '@clawssify/site', 'dev'], {
    cwd: projectRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })

  const handleData = (data: Buffer) => {
    const lines = data.toString().split('\n')
    for (const line of lines) {
      if (line.trim()) {
        logBridge.addLine(parsePlainLine(line, '[site]'))
      }
    }
  }

  proc.stdout?.on('data', handleData)
  proc.stderr?.on('data', handleData)
  proc.on('error', (err) => {
    logBridge.addLine({
      id: logCounter++,
      text: `[site] Failed to start: ${err.message}`,
      level: 'ERROR',
    })
  })

  return proc
}

// --- Ink components ---

type LevelColor = 'green' | 'yellow' | 'red' | 'gray' | 'white'

function levelColor(level: string): LevelColor {
  switch (level) {
    case 'INFO':
      return 'green'
    case 'WARN':
      return 'yellow'
    case 'ERROR':
    case 'FATAL':
      return 'red'
    case 'DEBUG':
    case 'TRACE':
      return 'gray'
    default:
      return 'white'
  }
}

const LogLine = React.memo(function LogLine({
  entry,
  maxWidth,
}: { entry: LogEntry; maxWidth: number }) {
  if (!entry.text) return <Text> </Text>

  const text =
    maxWidth > 0 && entry.text.length > maxWidth ? entry.text.slice(0, maxWidth) : entry.text

  const timeEnd = text.indexOf('  ')
  if (timeEnd === -1) return <Text dimColor>{text}</Text>

  const time = text.slice(0, timeEnd)
  const rest = text.slice(timeEnd)

  return (
    <Text wrap="truncate">
      <Text dimColor>{time}</Text>
      <Text color={levelColor(entry.level)}>{rest}</Text>
    </Text>
  )
})

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

const TOTAL_STEPS = 3
const BAR_WIDTH = 15
const STEP_LABELS = ['Starting...', 'Extracting', 'Analyzing', 'Saving']

function stepProgressBar(step: number): string {
  const filled = Math.round((step / TOTAL_STEPS) * BAR_WIDTH)
  const empty = BAR_WIDTH - filled
  return `${'█'.repeat(filled)}${'░'.repeat(empty)}`
}

function formatLabel(item: QueueItem): string {
  if (item.type === 'url') {
    try {
      const url = new URL(item.label)
      const path = url.pathname === '/' ? '' : url.pathname.slice(0, 30)
      return `${url.hostname}${path}`
    } catch {
      return item.label.slice(0, 50)
    }
  }
  return item.label.length > 50 ? `${item.label.slice(0, 47)}...` : item.label
}

function QueueSection({ items }: { items: QueueItem[] }) {
  const [spinnerFrame, setSpinnerFrame] = useState(0)
  const hasProcessing = items.some((i) => i.status === 'processing')

  // Spinner animation — only runs when there are processing items
  useEffect(() => {
    if (!hasProcessing) return
    const interval = setInterval(() => setSpinnerFrame((f) => f + 1), 80)
    return () => clearInterval(interval)
  }, [hasProcessing])

  if (items.length === 0) return null

  return (
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {items.map((item) => {
        const label = formatLabel(item)

        if (item.status === 'processing') {
          return (
            <Box key={item.sourceId} justifyContent="space-between">
              <Text>
                <Text color="cyan">{SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]}</Text>
                <Text bold>{` ${label}`}</Text>
              </Text>
              <Text>
                <Text color="white">{stepProgressBar(item.step)}</Text>
                <Text dimColor>{` ${item.step}/${TOTAL_STEPS}`}</Text>
                <Text dimColor>{`  ${STEP_LABELS[item.step]}`}</Text>
              </Text>
            </Box>
          )
        }

        if (item.status === 'processed' || item.status === 'bookmarked') {
          return (
            <Text key={item.sourceId}>
              <Text color="green">{'✓'}</Text>
              <Text>{` ${label}`}</Text>
              <Text dimColor>
                {item.status === 'bookmarked' ? ' — Bookmarked' : ' — Classified'}
              </Text>
            </Text>
          )
        }

        return (
          <Text key={item.sourceId}>
            <Text color="red">{'✗'}</Text>
            <Text>{` ${label}`}</Text>
            <Text dimColor> — Failed to process</Text>
          </Text>
        )
      })}
    </Box>
  )
}

// --- Provider / model selection ---

const PROVIDERS = [
  {
    id: 'anthropic' as const,
    name: 'Claude (Anthropic)',
    models: [
      { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5 — fast, great quality' },
      { id: 'claude-opus-4-6', name: 'Opus 4.6 — most capable' },
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5 — fastest' },
    ],
  },
  {
    id: 'openai' as const,
    name: 'OpenAI',
    models: [
      { id: 'gpt-5.2', name: 'GPT-5.2 — flagship, most capable' },
      { id: 'gpt-5-mini', name: 'GPT-5 Mini — fast, cost-efficient' },
      { id: 'gpt-5', name: 'GPT-5 — balanced' },
    ],
  },
  {
    id: 'gemini' as const,
    name: 'Gemini (Google)',
    models: [
      { id: 'gemini-2.5-pro', name: '2.5 Pro — most capable' },
      { id: 'gemini-2.5-flash', name: '2.5 Flash — fast' },
      { id: 'gemini-3-flash-preview', name: '3 Flash — latest preview' },
    ],
  },
]

function Selector({
  currentProvider,
  currentModel,
  onSelect,
}: {
  currentProvider: string
  currentModel: string
  onSelect: (result: { provider: string; model: string }) => void
}) {
  const [step, setStep] = useState<'provider' | 'model'>('provider')
  const defaultProviderIdx = Math.max(
    0,
    PROVIDERS.findIndex((p) => p.id === currentProvider),
  )
  const [providerIdx, setProviderIdx] = useState(defaultProviderIdx)
  const [modelIdx, setModelIdx] = useState(0)
  const [selectedProvider, setSelectedProvider] = useState<(typeof PROVIDERS)[number] | null>(null)

  useInput((_input, key) => {
    if (step === 'provider') {
      if (key.upArrow) setProviderIdx((i) => Math.max(0, i - 1))
      if (key.downArrow) setProviderIdx((i) => Math.min(PROVIDERS.length - 1, i + 1))
      if (key.return) {
        const provider = PROVIDERS[providerIdx]
        setSelectedProvider(provider)
        const currentIdx = provider.models.findIndex((m) => m.id === currentModel)
        setModelIdx(Math.max(0, currentIdx))
        setStep('model')
      }
    } else if (selectedProvider) {
      if (key.upArrow) setModelIdx((i) => Math.max(0, i - 1))
      if (key.downArrow) setModelIdx((i) => Math.min(selectedProvider.models.length - 1, i + 1))
      if (key.return) {
        onSelect({
          provider: selectedProvider.id,
          model: selectedProvider.models[modelIdx].id,
        })
      }
    }
  })

  return (
    <Box flexDirection="column" paddingLeft={1} paddingTop={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
      >
        <Text bold color="cyan">
          {'🐾 Clawssify Setup'}
        </Text>
        <Text dimColor>
          {step === 'provider'
            ? 'Pick an AI provider to power your knowledge base.'
            : 'Almost there — pick the model you want to use.'}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column" paddingLeft={2}>
        {step === 'provider' ? (
          <>
            <Text bold>AI Provider</Text>
            <Text dimColor>Which service should handle classification?</Text>
            <Box marginTop={1} flexDirection="column">
              {PROVIDERS.map((p, i) => (
                <Text
                  key={p.id}
                  color={i === providerIdx ? 'cyan' : undefined}
                  bold={i === providerIdx}
                >
                  {i === providerIdx ? '❯ ' : '  '}
                  {p.name}
                </Text>
              ))}
            </Box>
          </>
        ) : selectedProvider ? (
          <>
            <Text>
              <Text dimColor>Provider </Text>
              <Text bold color="cyan">
                {selectedProvider.name}
              </Text>
            </Text>
            <Box marginTop={1} flexDirection="column">
              <Text bold>Model</Text>
              <Text dimColor>Larger models are smarter but slower.</Text>
              <Box marginTop={1} flexDirection="column">
                {selectedProvider.models.map((m, i) => (
                  <Text
                    key={m.id}
                    color={i === modelIdx ? 'cyan' : undefined}
                    bold={i === modelIdx}
                  >
                    {i === modelIdx ? '❯ ' : '  '}
                    {m.name}
                  </Text>
                ))}
              </Box>
            </Box>
          </>
        ) : null}
        <Box marginTop={1}>
          <Text dimColor>Use arrow keys to navigate, Enter to confirm</Text>
        </Box>
      </Box>
    </Box>
  )
}

function selectProviderAndModel(
  currentProvider: string,
  currentModel: string,
): Promise<{ provider: string; model: string }> {
  return new Promise((resolve) => {
    const { unmount } = render(
      <Selector
        currentProvider={currentProvider}
        currentModel={currentModel}
        onSelect={(result) => {
          unmount()
          resolve(result)
        }}
      />,
    )
  })
}

function updateEnvFile(envPath: string, updates: Record<string, string>) {
  let content = ''
  try {
    content = readFileSync(envPath, 'utf-8')
  } catch {
    return
  }

  for (const [key, value] of Object.entries(updates)) {
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`)
    } else {
      content += `${key}=${value}\n`
    }
  }

  writeFileSync(envPath, content, 'utf-8')
}

function determineAuthMethod(_providerId: string): 'api-key' | 'oauth' {
  return 'oauth'
}

function getCredentialPrefix(provider: string): string {
  if (provider === 'anthropic') return 'claude-'
  if (provider === 'gemini') return 'gemini-'
  return 'codex-'
}

function hasOAuthCredentials(dataDir: string, provider: string): boolean {
  const authDir = resolve(dataDir, '.proxy', 'auth')
  const prefix = getCredentialPrefix(provider)
  try {
    const files = readdirSync(authDir)
    return files.some((f) => f.startsWith(prefix) && f.endsWith('.json'))
  } catch {
    return false
  }
}

async function promptForApiKey(provider: string): Promise<string> {
  const labels: Record<string, string> = {
    gemini: 'Gemini API key (from aistudio.google.com)',
    openai: 'OpenAI API key (sk-...)',
    anthropic: 'Anthropic API key (sk-ant-...)',
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((res) => {
    rl.question(`  ${labels[provider] || 'API key'}: `, (answer) => {
      rl.close()
      res(answer.trim())
    })
  })
}

function getLoginFlag(provider: string): string {
  if (provider === 'anthropic') return '-claude-login'
  if (provider === 'gemini') return '-login'
  return '-codex-login'
}

async function loginWithAutoDetect(dataDir: string, provider: string): Promise<void> {
  const { ensureProxyBinary } = await import('./services/proxy.js')
  await ensureProxyBinary(dataDir)

  const loginFlag = getLoginFlag(provider)
  const prefix = getCredentialPrefix(provider)
  const authDir = resolve(dataDir, '.proxy', 'auth')
  const binaryPath = resolve(dataDir, '.proxy', 'cli-proxy-api')
  const configPath = resolve(dataDir, '.proxy', 'config.yaml')

  // Snapshot existing credential files
  let existingFiles: Set<string>
  try {
    existingFiles = new Set(
      readdirSync(authDir).filter((f) => f.startsWith(prefix) && f.endsWith('.json')),
    )
  } catch {
    existingFiles = new Set()
  }

  // Pipe stdout/stderr so we can extract the browser URL and suppress the "Paste callback" prompt
  const proc = spawn(binaryPath, [loginFlag, '-config', configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  // Show browser URL when detected, suppress everything else
  const handleOutput = (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      const urlMatch = trimmed.match(/https?:\/\/\S+/)
      if (urlMatch) {
        console.log(`  If the browser didn't open, visit:\n  ${urlMatch[0]}`)
      }
    }
  }
  proc.stdout?.on('data', handleOutput)
  proc.stderr?.on('data', handleOutput)

  return new Promise<void>((pResolve, pReject) => {
    let done = false

    const finish = () => {
      if (done) return
      done = true
      clearInterval(interval)
      if (!proc.killed) proc.kill('SIGTERM')
    }

    // Poll for new credential files every second
    const interval = setInterval(() => {
      try {
        const files = readdirSync(authDir).filter(
          (f) => f.startsWith(prefix) && f.endsWith('.json'),
        )
        if (files.some((f) => !existingFiles.has(f))) {
          finish()
          pResolve()
        }
      } catch {
        // auth dir doesn't exist yet
      }
    }, 1000)

    proc.on('error', (err) => {
      if (!done) {
        finish()
        pReject(new Error(`Login failed: ${err.message}`))
      }
    })

    proc.on('close', (code) => {
      if (!done) {
        finish()
        if (code === 0 || code === null) pResolve()
        else pReject(new Error(`Login exited with code ${code}`))
      }
    })
  })
}

// --- Main DevCLI ---

function DevCLI({
  port,
  apiKey,
  logBridge,
  provider,
  model,
  aiStatus: initialAIStatus,
  dataDir,
}: {
  port: number
  apiKey: string
  logBridge: LogBridge
  provider: string
  model: string
  aiStatus: { connected: boolean; detail: string }
  dataDir: string
}) {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [input, setInput] = useState('')
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [aiStatus, setAIStatus] = useState(initialAIStatus)
  const [termRows, setTermRows] = useState(process.stdout.rows || 24)
  const [termCols, setTermCols] = useState(process.stdout.columns || 80)
  const { exit } = useApp()

  // Calculate visible log lines accounting for queue section
  // Header: 10 rows, Input: 3 rows, Log box borders: 2, queue section: variable
  const queueHeight = queue.length
  const logVisibleLines = Math.max(3, termRows - 15 - queueHeight)
  const visibleLogs = logs.slice(-logVisibleLines)

  const paddedLogs: LogEntry[] = [
    ...Array.from({ length: Math.max(0, logVisibleLines - visibleLogs.length) }, (_, i) => ({
      id: -(i + 1),
      text: ' ',
      level: 'LOG',
    })),
    ...visibleLogs,
  ]

  // Subscribe to log events
  useEffect(() => {
    const handler = (entry: LogEntry) => {
      setLogs((prev) => {
        const next = [...prev, entry]
        if (next.length > 500) return next.slice(-300)
        return next
      })
    }
    logBridge.on('log', handler)
    return () => {
      logBridge.off('log', handler)
    }
  }, [logBridge])

  // Subscribe to pipeline step events
  useEffect(() => {
    const handler = ({ sourceId, step }: { sourceId: string; step: number }) => {
      setQueue((prev) => {
        let changed = false
        const updated = prev.map((item) => {
          if (item.sourceId === sourceId && item.step < step) {
            changed = true
            return { ...item, step }
          }
          return item
        })
        return changed ? updated : prev
      })
    }
    logBridge.on('step', handler)
    return () => {
      logBridge.off('step', handler)
    }
  }, [logBridge])

  // Terminal resize
  useEffect(() => {
    const onResize = () => {
      setTermRows(process.stdout.rows || 24)
      setTermCols(process.stdout.columns || 80)
    }
    process.stdout.on('resize', onResize)
    return () => {
      process.stdout.off('resize', onResize)
    }
  }, [])

  // Poll sources.json for status changes — only when there are processing items
  const hasProcessing = queue.some((i) => i.status === 'processing')
  useEffect(() => {
    if (!hasProcessing) return

    const interval = setInterval(() => {
      const sources = readAllSources(dataDir)
      setQueue((prev) => {
        let changed = false
        const updated = prev.map((item) => {
          if (item.status !== 'processing') return item
          const source = sources.get(item.sourceId)
          if (source && source.status !== 'processing') {
            changed = true
            return {
              ...item,
              status: source.status as QueueItem['status'],
              label: source.title || item.label,
              completedAt: Date.now(),
            }
          }
          return item
        })
        return changed ? updated : prev
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [hasProcessing, dataDir])

  // Auto-remove completed items after 8 seconds
  useEffect(() => {
    if (queue.length === 0) return

    const interval = setInterval(() => {
      setQueue((prev) => {
        const filtered = prev.filter(
          (i) => i.status === 'processing' || !i.completedAt || Date.now() - i.completedAt <= 5000,
        )
        return filtered.length === prev.length ? prev : filtered
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [queue.length])

  useInput((_input, key) => {
    if (key.ctrl && _input === 'c') {
      exit()
    }
  })

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      setInput('')

      if (trimmed === '/quit' || trimmed === '/exit') {
        exit()
        return
      }

      if (trimmed === '/help') {
        const helpLines = [
          '  Commands:',
          '    <url>        Ingest a URL (auto-detected)',
          '    <text>       Ingest as a note',
          '    /help        Show this help',
          '    /logout      Remove AI credentials',
          '    /quit        Exit dev mode',
        ]
        setLogs((prev) => [
          ...prev,
          ...helpLines.map((text) => ({ id: logCounter++, text, level: 'LOG' })),
        ])
        return
      }

      if (trimmed === '/logout') {
        const count = deleteAICredentials(dataDir)
        if (count > 0) {
          setLogs((prev) => [
            ...prev,
            {
              id: logCounter++,
              text: `  Deleted ${count} credential file(s). Restart to re-authenticate.`,
              level: 'WARN',
            },
          ])
          setAIStatus({ connected: false, detail: 'logged out' })
        } else {
          setLogs((prev) => [
            ...prev,
            { id: logCounter++, text: '  No credentials found.', level: 'LOG' },
          ])
        }
        return
      }

      const type = trimmed.startsWith('http://') || trimmed.startsWith('https://') ? 'url' : 'note'
      const label = trimmed

      try {
        const res = await fetch(`http://localhost:${port}/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ type, content: trimmed, impact: 'auto' }),
        })
        if (res.ok) {
          const data = (await res.json()) as { id: string; message: string }
          setQueue((prev) => [
            ...prev,
            { sourceId: data.id, label, type, status: 'processing', step: 0, addedAt: Date.now() },
          ])
        } else {
          const err = (await res.json().catch(() => ({ error: res.statusText }))) as {
            error?: string
            message?: string
          }
          setLogs((prev) => [
            ...prev,
            {
              id: logCounter++,
              text: `  Error ${res.status}: ${err.error || err.message || 'Unknown'}`,
              level: 'ERROR',
            },
          ])
        }
      } catch (err) {
        setLogs((prev) => [
          ...prev,
          {
            id: logCounter++,
            text: `  Error: ${err instanceof Error ? err.message : String(err)}`,
            level: 'ERROR',
          },
        ])
      }
    },
    [port, apiKey, exit, dataDir],
  )

  return (
    <Box flexDirection="column" height={termRows}>
      {/* Header */}
      <Box
        borderStyle="round"
        borderColor="cyan"
        flexDirection="column"
        paddingLeft={1}
        paddingRight={1}
      >
        <Text>
          <Text bold color="cyan">
            {'🐾 Clawssify'}
          </Text>
          <Text dimColor> — Dev Mode</Text>
        </Text>
        <Text> </Text>
        <Text>
          <Text dimColor>{'  Website  '}</Text>
          <Text bold color="green">
            http://localhost:5173
          </Text>
        </Text>
        <Text>
          <Text dimColor>{'  AI       '}</Text>
          <Text bold>{provider}</Text>
          <Text dimColor>{' · '}</Text>
          <Text>{model}</Text>
          <Text dimColor>{' · '}</Text>
          {aiStatus.connected ? (
            <Text color="green">connected</Text>
          ) : (
            <Text color="red">not connected</Text>
          )}
        </Text>
        <Text> </Text>
        <Text dimColor>
          {'  Paste a URL or type a note below to ingest content. Try /help for commands.'}
        </Text>
      </Box>

      {/* Logs */}
      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        flexGrow={1}
        paddingLeft={1}
        paddingRight={1}
        overflowY="hidden"
      >
        {paddedLogs.map((entry) => (
          <LogLine key={entry.id} entry={entry} maxWidth={termCols - 6} />
        ))}
      </Box>

      {/* Queue */}
      <QueueSection items={queue} />

      {/* Input */}
      <Box borderStyle="round" borderColor="magenta" paddingLeft={1} paddingRight={1}>
        <Text bold color="magenta">
          {'> '}
        </Text>
        <TextInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder="Type a URL or message to ingest..."
        />
      </Box>
    </Box>
  )
}

// --- Main ---

async function main() {
  const config = loadConfig()
  config.dataDir = resolve(config.dataDir)
  await initializeDataDirectory(config.dataDir)

  // Phase 1: Skip selector if already authenticated, otherwise pick provider/model
  const envPath = resolve(process.cwd(), '.env')
  const alreadyConnected = checkAIStatus(config).connected

  if (!alreadyConnected) {
    const selection = await selectProviderAndModel(config.ai.provider, config.ai.model)

    // Apply selection
    config.ai.provider = selection.provider as typeof config.ai.provider
    config.ai.model = selection.model
    config.ai.authMethod = determineAuthMethod(selection.provider)

    // Persist to .env
    updateEnvFile(envPath, {
      AI_PROVIDER: config.ai.provider,
      AI_AUTH_METHOD: config.ai.authMethod,
      AI_MODEL: config.ai.model,
    })

    // Ensure authentication
    if (config.ai.authMethod === 'oauth') {
      console.log('\n  Signing in to your account...')
      console.log('  A browser window should open — complete the login there.\n')
      await loginWithAutoDetect(config.dataDir, selection.provider)
      console.log('\n  Signed in successfully!\n')
    } else {
      console.log('\n  One last step — enter your API key to connect.\n')
      const apiKey = await promptForApiKey(selection.provider)
      config.ai.apiKey = apiKey
      updateEnvFile(envPath, { AI_API_KEY: apiKey })
    }
  }

  // Phase 2: Start server
  process.stdout.write('\x1b[2J\x1b[H')

  const logBridge = new LogBridge()
  const logStream = logBridge.createStream()

  const onProxyLog = (line: string) => {
    logBridge.addLine(parsePlainLine(line, ''))
  }

  const app = await buildApp(config, { loggerDestination: logStream, onProxyLog })

  await app.listen({ port: config.port, host: '0.0.0.0' })

  // Spawn the site dev server
  const __dirname = fileURLToPath(new URL('.', import.meta.url))
  const projectRoot = resolve(__dirname, '../../..')
  const siteProc = spawnSiteProcess(projectRoot, logBridge)

  const aiStatus = checkAIStatus(config)
  const providerNames: Record<string, string> = {
    anthropic: 'Claude',
    openai: 'OpenAI',
    gemini: 'Gemini',
  }
  const providerLabel = providerNames[config.ai.provider] || config.ai.provider

  // Phase 3: Main interactive CLI
  const { waitUntilExit } = render(
    <DevCLI
      port={config.port}
      apiKey={config.apiKey}
      logBridge={logBridge}
      provider={providerLabel}
      model={config.ai.model}
      aiStatus={aiStatus}
      dataDir={config.dataDir}
    />,
  )

  await waitUntilExit()

  siteProc.kill()
  await app.close()
  process.exit(0)
}

main().catch((err) => {
  console.error('Failed to start:', err)
  process.exit(1)
})
