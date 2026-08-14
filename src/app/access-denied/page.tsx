"use client"

import React from "react"
import { SignOutButton } from "@/providers/auth-provider"
import { ShieldAlert, LogOut, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col items-center text-center">
          {/* Warning Icon with a subtle pulse animation */}
          <div className="mb-6 rounded-full bg-destructive/10 p-4 text-destructive dark:bg-destructive/20 animate-pulse">
            <ShieldAlert className="h-12 w-12" />
          </div>

          {/* Bilingual Warning Header */}
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
            Access Denied
          </h1>
          <h2 className="mt-1 text-lg font-bold text-destructive/95">
            ဝင်ရောက်ခွင့်မရှိပါ
          </h2>

          <div className="mt-6 border-t border-border/60 pt-6 w-full text-left space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>English:</strong> Your email address is not registered in this Inventory Management system. Please contact the owner or store manager to register your account in the Staff Directory.
            </p>
            <p className="text-sm text-muted-foreground/80 leading-relaxed font-medium">
              <strong>Myanmar:</strong> သင်၏အီးမေးလ်သည် ဤ POS စနစ်တွင် စာရင်းသွင်းထားခြင်းမရှိပါ။ သင်၏အကောင့်အား ဝန်ထမ်းစာရင်းတွင် ထည့်သွင်းပေးရန် ဆိုင်ပိုင်ရှင် သို့မဟုတ် မန်နေဂျာထံ ဆက်သွယ်ပါ။
            </p>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 w-full">
            {/* Sign Out button */}
            <SignOutButton>
              <Button 
                variant="destructive" 
                className="w-full font-bold flex items-center justify-center gap-2 hover:bg-destructive/90"
              >
                <LogOut className="h-4 w-4" />
                Sign Out / အကောင့်ထွက်ရန်
              </Button>
            </SignOutButton>

            <Button 
              variant="outline" 
              className="w-full font-semibold border-border hover:bg-muted"
              onClick={() => { window.location.href = "/sign-in" }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </div>
      </div>
      <p className="mt-8 text-xs text-muted-foreground/60">
        Inventory Management System Multi-Branch Security Firewall
      </p>
    </div>
  )
}
