import lockfile from 'proper-lockfile'

export async function withFileLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
  const release = await lockfile.lock(filePath, { retries: { retries: 3, minTimeout: 100 } })
  try {
    return await fn()
  } finally {
    await release()
  }
}
