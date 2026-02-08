import { nanoid } from 'nanoid'

export function generateSourceId(): string {
  return `src_${nanoid(12)}`
}

export function generateAnalysisId(): string {
  return `analysis_${nanoid(12)}`
}

export function generatePendingId(): string {
  return `pending_${nanoid(12)}`
}
