import { SignUp } from "@clerk/nextjs"

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/30">
            <span className="text-2xl">🏪</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Inventory Management System</h1>
            <p className="text-sm text-muted-foreground mt-1">Create your account</p>
          </div>
        </div>
        <SignUp
          appearance={{
            elements: {
              rootBox: "shadow-xl",
              card: "border border-border bg-card shadow-none",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              formFieldLabel: "text-foreground text-sm",
              formFieldInput: "bg-background border-input text-foreground",
              footerActionLink: "text-primary hover:text-primary/80",
              formButtonPrimary: "bg-primary hover:bg-primary/90 text-primary-foreground",
            },
          }}
        />
      </div>
    </div>
  )
}
