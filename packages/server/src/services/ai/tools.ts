import { readFile, writeFile, readdir, appendFile, mkdir } from 'node:fs/promises'
import { join, resolve, relative, dirname } from 'node:path'
import type { ToolDefinition, ToolCall, ToolResult } from '@clawssify/shared'

export function getToolDefinitions(): ToolDefinition[] {
  return [
    {
      name: 'read_file',
      description: 'Read the contents of a file in the knowledge base.',
      parameters: {
        path: { type: 'string', description: 'Relative path from the data directory' },
      },
    },
    {
      name: 'write_file',
      description:
        'Create or overwrite a file. Parent directories are created automatically. Use this to create new wiki pages, posts, or any other file.',
      parameters: {
        path: { type: 'string', description: 'Relative path from the data directory' },
        content: { type: 'string', description: 'File content to write' },
      },
    },
    {
      name: 'edit_file',
      description: 'Find and replace text within a file. The old_text must match exactly.',
      parameters: {
        path: { type: 'string', description: 'Relative path from the data directory' },
        old_text: { type: 'string', description: 'Text to find (exact match)' },
        new_text: { type: 'string', description: 'Text to replace with' },
      },
    },
    {
      name: 'list_directory',
      description: 'List files and subdirectories in a directory.',
      parameters: {
        path: { type: 'string', description: 'Relative path from the data directory' },
      },
    },
    {
      name: 'grep_files',
      description:
        'Search for a pattern in files recursively. Returns matching lines with file paths and line numbers.',
      parameters: {
        pattern: { type: 'string', description: 'Search pattern (literal string)' },
        path: {
          type: 'string',
          description: 'Directory to search in (relative to data dir). Defaults to knowledge/',
        },
      },
    },
    {
      name: 'append_file',
      description: 'Append content to the end of a file. Useful for digest and decision logs.',
      parameters: {
        path: { type: 'string', description: 'Relative path from the data directory' },
        content: { type: 'string', description: 'Content to append' },
      },
    },
  ]
}

function safePath(dataDir: string, userPath: string): string {
  const resolved = resolve(dataDir, userPath)
  const normalizedDataDir = resolve(dataDir)
  if (!resolved.startsWith(normalizedDataDir)) {
    throw new Error(`Path escapes data directory: ${userPath}`)
  }
  return resolved
}

export function createToolExecutor(dataDir: string): (call: ToolCall) => Promise<ToolResult> {
  return async (call: ToolCall): Promise<ToolResult> => {
    try {
      switch (call.name) {
        case 'read_file': {
          const filePath = safePath(dataDir, call.arguments.path as string)
          const content = await readFile(filePath, 'utf-8')
          return { name: call.name, result: content }
        }

        case 'write_file': {
          const filePath = safePath(dataDir, call.arguments.path as string)
          await mkdir(dirname(filePath), { recursive: true })
          await writeFile(filePath, call.arguments.content as string, 'utf-8')
          return { name: call.name, result: `File written: ${call.arguments.path}` }
        }

        case 'edit_file': {
          const filePath = safePath(dataDir, call.arguments.path as string)
          const existing = await readFile(filePath, 'utf-8')
          const oldText = call.arguments.old_text as string
          const newText = call.arguments.new_text as string
          if (!existing.includes(oldText)) {
            return {
              name: call.name,
              result: 'Error: old_text not found in file',
              isError: true,
            }
          }
          await writeFile(filePath, existing.replace(oldText, newText), 'utf-8')
          return { name: call.name, result: `File edited: ${call.arguments.path}` }
        }

        case 'list_directory': {
          const dirPath = safePath(dataDir, call.arguments.path as string)
          const entries = await readdir(dirPath, { withFileTypes: true })
          const listing = entries
            .map((e) => `${e.isDirectory() ? '[dir] ' : ''}${e.name}`)
            .join('\n')
          return { name: call.name, result: listing || '(empty directory)' }
        }

        case 'grep_files': {
          const searchPath = call.arguments.path as string | undefined
          const dirPath = safePath(dataDir, searchPath ?? 'knowledge')
          const pattern = call.arguments.pattern as string
          const results = await grepRecursive(dirPath, pattern, dataDir)
          return {
            name: call.name,
            result: results.length > 0 ? results.join('\n') : 'No matches found',
          }
        }

        case 'append_file': {
          const filePath = safePath(dataDir, call.arguments.path as string)
          await appendFile(filePath, call.arguments.content as string, 'utf-8')
          return { name: call.name, result: `Content appended to: ${call.arguments.path}` }
        }

        default:
          return { name: call.name, result: `Unknown tool: ${call.name}`, isError: true }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return { name: call.name, result: `Error: ${message}`, isError: true }
    }
  }
}

async function grepRecursive(
  dir: string,
  pattern: string,
  dataDir: string,
): Promise<string[]> {
  const results: string[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        const nested = await grepRecursive(fullPath, pattern, dataDir)
        results.push(...nested)
      } else if (entry.name.endsWith('.md') || entry.name.endsWith('.json')) {
        const content = await readFile(fullPath, 'utf-8')
        const lines = content.split('\n')
        const relPath = relative(dataDir, fullPath)
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(pattern)) {
            results.push(`${relPath}:${i + 1}:${lines[i]}`)
          }
        }
      }

      if (results.length >= 100) break
    }
  } catch {
    // Directory doesn't exist
  }

  return results
}
