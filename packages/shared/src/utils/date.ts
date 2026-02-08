export function toDatePrefix(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

export function toISO(date: Date = new Date()): string {
  return date.toISOString()
}
