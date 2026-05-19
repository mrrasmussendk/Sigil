/** Demo-only shared types. The framework's own types live under ../src. */

export interface MoverItem {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
}

export interface WatchlistItem {
  ticker: string;
  price: number;
  changePct: number;
}

export interface AllocationSlice {
  label: string;
  weight: number;
}

export interface HoldingRow {
  ticker: string;
  quantity: number;
  avgCost: number;
  last: number;
  marketValue: number;
  pnl: number;
  pnlPct: number;
}

export interface TransactionItem {
  date: string;
  merchant: string;
  category: string;
  amount: number;
}

export interface OrderBookLevel {
  price: number;
  size: number;
}

export type Sentiment = "bullish" | "bearish" | "neutral";

export type AccountType =
  | "checking"
  | "savings"
  | "credit"
  | "brokerage"
  | "retirement"
  | "loan";

export type InvoiceStatus = "paid" | "unpaid" | "overdue" | "scheduled";

export type CreditTier = "poor" | "fair" | "good" | "very-good" | "exceptional";

export type Bureau = "Equifax" | "Experian" | "TransUnion" | "FICO" | "VantageScore";

export type LoanType = "mortgage" | "auto" | "student" | "personal" | "heloc";

export type TradeSide = "buy" | "sell";

export type OrderType = "market" | "limit" | "stop" | "stop-limit";

export type TimeInForce = "day" | "gtc" | "ioc" | "fok";

export type TradeStatus = "pending" | "filled" | "partial" | "rejected" | "cancelled";

export type AlertSeverity = "info" | "success" | "warning" | "danger";

export type KpiTone = "up" | "down" | "flat" | "neutral";

export type MoverDirection = "gainers" | "losers";
