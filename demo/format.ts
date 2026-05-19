export type Trend = "up" | "down" | "flat";

export function fmtMoney(value: unknown, currency: string = "USD"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: Math.abs(value) >= 1000 ? 0 : 2
  }).format(value);
}

export function fmtPct(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value ?? "");
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function fmtSigned(value: number, currency: string = "USD"): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${fmtMoney(Math.abs(value), currency)}`;
}

export function trendOf(value: number): Trend {
  if (value > 0) return "up";
  if (value < 0) return "down";
  return "flat";
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}
