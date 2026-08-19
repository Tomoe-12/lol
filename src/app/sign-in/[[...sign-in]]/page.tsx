"use client";

import * as React from "react";
import { useAuth } from "@/providers/auth-provider";
import { useLanguage } from "@/providers/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Store, ShieldCheck, UserCheck, KeyRound, Loader2, AlertCircle } from "lucide-react";

export default function SignInPage() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setLoading(true);
    try {
      await login(demoEmail, demoPass);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-8 text-foreground">
      <div className="w-full max-w-md space-y-8 bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="h-16 w-16 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Store className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">SMARTPOS</h1>
            <p className="text-sm text-slate-400 mt-1">Multi-Branch Retail Management System</p>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-3 text-xs font-semibold rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">{t("Staff Email", "ဝန်ထမ်းအီးမေးလ်")}</label>
            <Input
              type="email"
              placeholder="e.g. owner@smartpos.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">{t("Password", "စကားဝှက်")}</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-slate-800/80 border-slate-700 text-white placeholder:text-slate-500 rounded-xl"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-600/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Logging in...
              </span>
            ) : (
              t("Sign In", "အကောင့်ဝင်မည်")
            )}
          </Button>
        </form>

        {/* Demo Quick Login Buttons for FYP Presentation */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          <p className="text-xs font-semibold text-slate-400 text-center uppercase tracking-wider">
            ⚡ Quick Demo Logins (FYP Presentation)
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleQuickLogin("owner@smartpos.com", "owner123")}
              disabled={loading}
              className="flex flex-col items-center h-auto py-2.5 px-2 bg-slate-800/50 hover:bg-slate-800 border-slate-700 rounded-xl"
            >
              <ShieldCheck className="h-4 w-4 text-amber-400 mb-1" />
              <span className="text-[11px] font-bold text-white">Owner</span>
              <span className="text-[9px] text-slate-400">All Access</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleQuickLogin("manager@smartpos.com", "manager123")}
              disabled={loading}
              className="flex flex-col items-center h-auto py-2.5 px-2 bg-slate-800/50 hover:bg-slate-800 border-slate-700 rounded-xl"
            >
              <UserCheck className="h-4 w-4 text-indigo-400 mb-1" />
              <span className="text-[11px] font-bold text-white">Manager</span>
              <span className="text-[9px] text-slate-400">Branch Scoped</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => handleQuickLogin("cashier@smartpos.com", "cashier123")}
              disabled={loading}
              className="flex flex-col items-center h-auto py-2.5 px-2 bg-slate-800/50 hover:bg-slate-800 border-slate-700 rounded-xl"
            >
              <KeyRound className="h-4 w-4 text-emerald-400 mb-1" />
              <span className="text-[11px] font-bold text-white">Cashier</span>
              <span className="text-[9px] text-slate-400">POS Only</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
