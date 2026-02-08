import { execSync, spawn, type ChildProcess } from 'node:child_process'
import { chmod, mkdir, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'

const PROXY_PORT = 8317
const PROXY_REPO = 'router-for-me/CLIProxyAPI'
const BINARY_NAME = 'cli-proxy-api'
const HEALTH_CHECK_INTERVAL_MS = 300
const HEALTH_CHECK_TIMEOUT_MS = 15_000

function getProxyDir(dataDir: string): string {
  return join(dataDir, '.proxy')
}

function getBinaryPath(dataDir: string): string {
  return join(getProxyDir(dataDir), BINARY_NAME)
}

function getAuthDir(dataDir: string): string {
  return join(getProxyDir(dataDir), 'auth')
}

function getConfigPath(dataDir: string): string {
  return join(getProxyDir(dataDir), 'config.yaml')
}

function getPlatformAsset(version: string): string {
  const platform = process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'amd64'
  return `CLIProxyAPI_${version}_${platform}_${arch}.tar.gz`
}

async function binaryExists(dataDir: string): Promise<boolean> {
  try {
    await stat(getBinaryPath(dataDir))
    return true
  } catch {
    return false
  }
}

/**
 * Write a minimal config.yaml for CLIProxyAPI.
 */
async function ensureConfig(dataDir: string): Promise<void> {
  const authDir = resolve(getAuthDir(dataDir))
  const configPath = getConfigPath(dataDir)
  const config = [
    `port: ${PROXY_PORT}`,
    `host: "127.0.0.1"`,
    `auth-dir: "${authDir}"`,
    `api-keys:`,
    `  - "proxy"`,
    `debug: false`,
    '',
  ].join('\n')
  await writeFile(configPath, config, 'utf-8')
}

/**
 * Download CLIProxyAPI binary from GitHub releases if not present.
 */
export async function ensureProxyBinary(dataDir: string): Promise<void> {
  const proxyDir = getProxyDir(dataDir)
  await mkdir(proxyDir, { recursive: true })
  await mkdir(getAuthDir(dataDir), { recursive: true })

  if (await binaryExists(dataDir)) {
    await ensureConfig(dataDir)
    return
  }

  // Get latest release version
  const releaseRes = await fetch(
    `https://api.github.com/repos/${PROXY_REPO}/releases/latest`,
  )
  if (!releaseRes.ok) {
    throw new Error(`Failed to fetch latest release: ${releaseRes.status}`)
  }
  const release = (await releaseRes.json()) as { tag_name: string }
  const version = release.tag_name.replace(/^v/, '')
  const asset = getPlatformAsset(version)

  console.log(`  Downloading CLIProxyAPI ${version}...`)
  const url = `https://github.com/${PROXY_REPO}/releases/download/${release.tag_name}/${asset}`
  const downloadRes = await fetch(url)
  if (!downloadRes.ok || !downloadRes.body) {
    throw new Error(`Failed to download ${asset}: ${downloadRes.status}`)
  }

  // Save tar.gz to temp file and extract with system tar
  const tarPath = join(proxyDir, `${asset}`)
  const fileStream = createWriteStream(tarPath)
  await pipeline(downloadRes.body as unknown as NodeJS.ReadableStream, fileStream)
  execSync(`tar xzf "${tarPath}" -C "${proxyDir}" ${BINARY_NAME}`)
  execSync(`rm -f "${tarPath}"`)

  await chmod(getBinaryPath(dataDir), 0o755)
  await ensureConfig(dataDir)
  console.log(`  CLIProxyAPI installed to ${proxyDir}`)
}

/**
 * Run CLIProxyAPI login flow (opens browser for OAuth).
 */
export async function loginProxy(
  provider: 'claude' | 'codex',
  dataDir: string,
): Promise<void> {
  const binaryPath = getBinaryPath(dataDir)
  const configPath = getConfigPath(dataDir)

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(binaryPath, [`-${provider}-login`, '-config', configPath], {
      stdio: 'inherit',
    })

    proc.on('error', (err) => reject(new Error(`Failed to run proxy login: ${err.message}`)))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Proxy login exited with code ${code}`))
    })
  })
}

/**
 * Start CLIProxyAPI as a background subprocess.
 * Returns the child process handle (call stopProxy to shut down).
 */
export async function startProxy(dataDir: string): Promise<ChildProcess> {
  const binaryPath = getBinaryPath(dataDir)
  const configPath = getConfigPath(dataDir)

  const proc = spawn(binaryPath, ['-config', configPath], {
    stdio: 'pipe',
    detached: false,
  })

  proc.stdout?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.log(`[proxy] ${msg}`)
  })

  proc.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString().trim()
    if (msg) console.error(`[proxy] ${msg}`)
  })

  proc.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`[proxy] CLIProxyAPI exited with code ${code}`)
    }
  })

  // Wait for proxy to be ready
  const start = Date.now()
  while (Date.now() - start < HEALTH_CHECK_TIMEOUT_MS) {
    try {
      const res = await fetch(`http://127.0.0.1:${PROXY_PORT}/v1/models`, {
        headers: { Authorization: 'Bearer proxy' },
      })
      if (res.ok) return proc
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL_MS))
  }

  proc.kill('SIGTERM')
  throw new Error(`CLIProxyAPI failed to start within ${HEALTH_CHECK_TIMEOUT_MS / 1000}s`)
}

/**
 * Stop the proxy subprocess gracefully.
 */
export function stopProxy(proc: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!proc.pid || proc.killed) {
      resolve()
      return
    }
    proc.on('close', () => resolve())
    proc.kill('SIGTERM')
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL')
      resolve()
    }, 5000)
  })
}

export const PROXY_BASE_URL = `http://127.0.0.1:${PROXY_PORT}`
