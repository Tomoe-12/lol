export function normalizePhone(value: unknown): string {
  return String(value || "").replace(/\D/g, "").slice(0, 11)
}

export function isValidMyanmarPhone(value: unknown): boolean {
  return /^09\d{9}$/.test(String(value || ""))
}
