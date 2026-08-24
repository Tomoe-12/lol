export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
        </div>
        <div>
          <p className="font-bold text-foreground">Loading SMARTPOS</p>
          <p className="mt-1 text-sm text-muted-foreground">Please wait…</p>
        </div>
      </div>
    </div>
  )
}
