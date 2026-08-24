export default function DashboardLoading() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-6">
      <div className="flex flex-col items-center gap-4 text-center" role="status" aria-live="polite">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary" />
        </div>
        <div>
          <p className="font-bold text-foreground">Loading page</p>
          <p className="mt-1 text-sm text-muted-foreground">Preparing your workspace…</p>
        </div>
      </div>
    </div>
  )
}
