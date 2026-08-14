"use client";

import { useState, useEffect } from "react";
import { Save, Printer, Receipt, Settings2, Wifi, TestTube } from "lucide-react";
import { useLanguage } from "@/providers/language-provider";

// ── Types ──────────────────────────────────────────────────────────────────
interface GeneralSettings {
  appName: string;
  currency: string;
  defaultExchangeRate: number;
  timezone: string;
}

interface ReceiptSettings {
  headerLine1: string;
  headerLine2: string;
  headerLine3: string;
  footerMessage: string;
  showBarcode: boolean;
  showLogo: boolean;
  showTaxId: boolean;
  taxId: string;
}

interface PrinterSettings {
  printerIp: string;
  printerPort: number;
  paperWidth: "58mm" | "80mm";
  cashDrawerEnabled: boolean;
}

const STORAGE_KEYS = {
  general: "pos_settings_general",
  receipt: "pos_settings_receipt",
  printer: "pos_settings_printer",
};

const defaultGeneral: GeneralSettings = {
  appName: "Inventory Management System",
  currency: "MMK",
  defaultExchangeRate: 2100,
  timezone: "Asia/Rangoon",
};

const defaultReceipt: ReceiptSettings = {
  headerLine1: "Inventory Management System",
  headerLine2: "Multi-Branch Retail",
  headerLine3: "Yangon, Myanmar",
  footerMessage: "Thank you for shopping!",
  showBarcode: true,
  showLogo: false,
  showTaxId: false,
  taxId: "",
};

const defaultPrinter: PrinterSettings = {
  printerIp: "192.168.1.100",
  printerPort: 9100,
  paperWidth: "80mm",
  cashDrawerEnabled: true,
};

// ── Helpers ────────────────────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Tab Component ──────────────────────────────────────────────────────────
type Tab = "general" | "receipt" | "printer";

export default function SettingsPage() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [saved, setSaved] = useState(false);

  const [general, setGeneral] = useState<GeneralSettings>(defaultGeneral);
  const [receipt, setReceipt] = useState<ReceiptSettings>(defaultReceipt);
  const [printer, setPrinter] = useState<PrinterSettings>(defaultPrinter);

  // Load from localStorage on mount
  useEffect(() => {
    setGeneral(load(STORAGE_KEYS.general, defaultGeneral));
    setReceipt(load(STORAGE_KEYS.receipt, defaultReceipt));
    setPrinter(load(STORAGE_KEYS.printer, defaultPrinter));
  }, []);

  const handleSave = () => {
    save(STORAGE_KEYS.general, general);
    save(STORAGE_KEYS.receipt, receipt);
    save(STORAGE_KEYS.printer, printer);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const [testPrintMessage, setTestPrintMessage] = useState<string | null>(null);

  const handleTestPrint = () => {
    setTestPrintMessage(
      `Test print signal sent to ${printer.printerIp}:${printer.printerPort}. Please ensure your thermal printer is connected to the same local network.`
    );
    setTimeout(() => setTestPrintMessage(null), 5000);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "general", label: t("General", "အထွေထွေ"), icon: Settings2 },
    { id: "receipt", label: t("Receipt", "ငွေရှင်းစာ"), icon: Receipt },
    { id: "printer", label: t("Printer", "ပရင်တာ"), icon: Printer },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("Settings", "ဆက်တင်များ")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure app, receipt, and hardware settings
          </p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
            saved
              ? "bg-emerald-600 text-white"
              : "bg-indigo-600 hover:bg-indigo-500 text-white"
          }`}
        >
          <Save className="w-4 h-4" />
          {saved ? t("Saved!", "သိမ်းပြီး!") : t("Save", "သိမ်းမည်")}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── General Tab ── */}
      {activeTab === "general" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">General Settings</h2>

          <Field label={t("App Name", "အက်ပ်အမည်")}>
            <input
              type="text"
              value={general.appName}
              onChange={(e) =>
                setGeneral({ ...general, appName: e.target.value })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label={t("Default Currency", "ငွေကြေး")}>
            <select
              value={general.currency}
              onChange={(e) =>
                setGeneral({ ...general, currency: e.target.value })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="MMK">MMK — Myanmar Kyat</option>
              <option value="USD">USD — US Dollar</option>
              <option value="THB">THB — Thai Baht</option>
              <option value="SGD">SGD — Singapore Dollar</option>
            </select>
          </Field>

          <Field label="Default USD Exchange Rate (1 USD = ? MMK)">
            <input
              type="number"
              value={general.defaultExchangeRate}
              onChange={(e) =>
                setGeneral({
                  ...general,
                  defaultExchangeRate: Number(e.target.value),
                })
              }
              min={1}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Timezone">
            <select
              value={general.timezone}
              onChange={(e) =>
                setGeneral({ ...general, timezone: e.target.value })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="Asia/Rangoon">Asia/Rangoon (UTC+6:30)</option>
              <option value="Asia/Bangkok">Asia/Bangkok (UTC+7)</option>
              <option value="Asia/Singapore">Asia/Singapore (UTC+8)</option>
            </select>
          </Field>
        </div>
      )}

      {/* ── Receipt Tab ── */}
      {activeTab === "receipt" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">Receipt Settings</h2>

          <Field label="Header Line 1 (Shop name)">
            <input
              type="text"
              value={receipt.headerLine1}
              onChange={(e) =>
                setReceipt({ ...receipt, headerLine1: e.target.value })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Header Line 2 (Branch / tagline)">
            <input
              type="text"
              value={receipt.headerLine2}
              onChange={(e) =>
                setReceipt({ ...receipt, headerLine2: e.target.value })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Header Line 3 (Address / phone)">
            <input
              type="text"
              value={receipt.headerLine3}
              onChange={(e) =>
                setReceipt({ ...receipt, headerLine3: e.target.value })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label={t("Footer Message", "အောက်ပြောစကား")}>
            <textarea
              value={receipt.footerMessage}
              onChange={(e) =>
                setReceipt({ ...receipt, footerMessage: e.target.value })
              }
              rows={2}
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Toggle
              label="Show barcode on receipt"
              value={receipt.showBarcode}
              onChange={(v) => setReceipt({ ...receipt, showBarcode: v })}
            />
            <Toggle
              label="Print logo on receipt"
              value={receipt.showLogo}
              onChange={(v) => setReceipt({ ...receipt, showLogo: v })}
            />
            <Toggle
              label="Show Tax ID"
              value={receipt.showTaxId}
              onChange={(v) => setReceipt({ ...receipt, showTaxId: v })}
            />
          </div>

          {receipt.showTaxId && (
            <Field label={t("Tax ID", "ကုမ္ပဏီနံပါတ်")}>
              <input
                type="text"
                value={receipt.taxId}
                onChange={(e) =>
                  setReceipt({ ...receipt, taxId: e.target.value })
                }
                placeholder="e.g. 12345678"
                className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </Field>
          )}

          {/* Receipt Preview */}
          <div className="border border-border rounded-xl p-4 bg-muted/30">
            <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">
              Preview
            </p>
            <div className="font-mono text-xs text-center space-y-0.5 text-foreground">
              <p className="font-bold">{receipt.headerLine1 || "—"}</p>
              <p>{receipt.headerLine2 || "—"}</p>
              <p>{receipt.headerLine3 || "—"}</p>
              <p className="text-muted-foreground">
                ─────────────────────
              </p>
              <p>Item 1 × 2 .................. 700 Ks</p>
              <p>Item 2 × 1 ................ 1,100 Ks</p>
              <p className="text-muted-foreground">
                ─────────────────────
              </p>
              <p className="font-bold">TOTAL: 2,500 Ks</p>
              <p>Payment: CASH | Change: 500 Ks</p>
              {receipt.showTaxId && receipt.taxId && (
                <p>Tax ID: {receipt.taxId}</p>
              )}
              <p className="text-muted-foreground">
                ─────────────────────
              </p>
              <p className="italic text-muted-foreground">
                {receipt.footerMessage || "Thank you!"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Printer Tab ── */}
      {activeTab === "printer" && (
        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="font-semibold text-foreground">
            Printer &amp; Hardware Settings
          </h2>

          <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <Wifi className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-300">
              Your thermal printer must be connected to the same Wi-Fi network
              as this device. Use ESC/POS over TCP (port 9100).
            </p>
          </div>

          <Field label="Printer IP Address">
            <input
              type="text"
              value={printer.printerIp}
              onChange={(e) =>
                setPrinter({ ...printer, printerIp: e.target.value })
              }
              placeholder="192.168.1.100"
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Printer Port">
            <input
              type="number"
              value={printer.printerPort}
              onChange={(e) =>
                setPrinter({ ...printer, printerPort: Number(e.target.value) })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </Field>

          <Field label="Paper Width">
            <select
              value={printer.paperWidth}
              onChange={(e) =>
                setPrinter({
                  ...printer,
                  paperWidth: e.target.value as "58mm" | "80mm",
                })
              }
              className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="58mm">58mm (Compact)</option>
              <option value="80mm">80mm (Standard)</option>
            </select>
          </Field>

          <Toggle
            label="Enable cash drawer trigger on sale"
            value={printer.cashDrawerEnabled}
            onChange={(v) =>
              setPrinter({ ...printer, cashDrawerEnabled: v })
            }
          />

          <button
            onClick={handleTestPrint}
            className="flex items-center gap-2 px-4 py-2 bg-muted border border-border hover:bg-muted/80 text-foreground text-sm font-medium rounded-lg transition-colors"
          >
            <TestTube className="w-4 h-4" />
            {t("Send Test Print", "စမ်းပုံနှိပ်မည်")}
          </button>

          {testPrintMessage && (
            <div className="p-3 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              {testPrintMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center justify-between p-3 bg-muted border border-border rounded-lg w-full hover:bg-muted/80 transition-colors"
    >
      <span className="text-sm text-foreground">{label}</span>
      <div
        className={`relative w-10 h-5 rounded-full transition-colors ${
          value ? "bg-indigo-600" : "bg-slate-600"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            value ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </div>
    </button>
  );
}
