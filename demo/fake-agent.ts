import type { UINode } from "../src/index.js";
import { syntheticSpark } from "./spark.js";

export interface AgentResponse {
  components: UINode[];
}

export interface Scenario {
  readonly id: string;
  readonly label: string;
  readonly match: RegExp;
  readonly build: () => AgentResponse;
}

const SCENARIOS: readonly Scenario[] = [
  {
    id: "portfolio",
    label: "Show me my portfolio",
    match: /(portfolio|net\s*worth|holdings|positions)/i,
    build: () => ({
      components: [
        {
          component: "alert-banner",
          props: {
            severity: "success",
            title: "Markets closed",
            message: "Snapshot as of today, 4:00pm ET. After-hours moves not yet reflected.",
            cta: "Enable streaming"
          }
        },
        {
          component: "portfolio-summary",
          props: {
            label: "Brokerage — Joint",
            totalValue: 482350.71,
            dayChange: 3214.55,
            dayChangePct: 0.67,
            cash: 18420,
            currency: "USD",
            allocation: [
              { label: "US Equities", weight: 58 },
              { label: "Intl Equities", weight: 14 },
              { label: "Bonds", weight: 12 },
              { label: "Crypto", weight: 6 },
              { label: "Real estate", weight: 6 },
              { label: "Cash", weight: 4 }
            ]
          }
        },
        { component: "kpi-card", props: { label: "YTD return", value: "+18.4%", delta: 18.4, deltaLabel: "vs S&P 500 +12.1%" } },
        { component: "kpi-card", props: { label: "1Y return", value: "+27.9%", delta: 27.9, deltaLabel: "outperforming benchmark" } },
        { component: "kpi-card", props: { label: "Dividend income", value: "$1,842", delta: 4.2, deltaLabel: "trailing 12 months" } },
        { component: "kpi-card", props: { label: "Sharpe ratio", value: "1.34", tone: "up", deltaLabel: "rolling 3Y" } },
        {
          component: "holdings-table",
          props: {
            label: "Top positions",
            currency: "USD",
            rows: [
              { ticker: "AAPL", quantity: 145, avgCost: 142.10, last: 232.55, marketValue: 33719.75, pnl: 13115.25, pnlPct: 63.65 },
              { ticker: "MSFT", quantity: 78, avgCost: 254.20, last: 415.40, marketValue: 32401.20, pnl: 12573.60, pnlPct: 63.45 },
              { ticker: "NVDA", quantity: 90, avgCost: 312.00, last: 945.80, marketValue: 85122.00, pnl: 57042.00, pnlPct: 203.15 },
              { ticker: "VTI", quantity: 320, avgCost: 198.55, last: 268.20, marketValue: 85824.00, pnl: 22288.00, pnlPct: 35.07 },
              { ticker: "TLT", quantity: 220, avgCost: 102.40, last: 88.10, marketValue: 19382.00, pnl: -3146.00, pnlPct: -13.96 }
            ]
          }
        },
        {
          component: "chart-bars",
          props: {
            title: "Monthly P&L (USD)",
            labels: ["Dec", "Jan", "Feb", "Mar", "Apr", "May"],
            values: [4820, -1240, 6310, 2940, -880, 5180],
            currency: "USD"
          }
        }
      ]
    })
  },
  {
    id: "quote",
    label: "What's NVDA doing today?",
    match: /(quote|price|stock|ticker|TSLA|AAPL|NVDA|MSFT)/i,
    build: () => ({
      components: [
        {
          component: "stock-quote",
          props: {
            ticker: "NVDA",
            name: "NVIDIA Corporation",
            price: 945.80,
            change: 21.45,
            changePct: 2.32,
            currency: "USD",
            exchange: "NASDAQ",
            spark: syntheticSpark(920, 2.2)
          }
        },
        {
          component: "news-headline",
          props: {
            source: "Reuters",
            headline: "NVIDIA tops Q1 estimates as data center revenue climbs 86%",
            summary: "Beats on both top and bottom line; raises guidance citing Blackwell ramp.",
            sentiment: "bullish",
            tickers: ["NVDA", "AMD", "AVGO"],
            published: "12 min ago"
          }
        },
        {
          component: "news-headline",
          props: {
            source: "Bloomberg",
            headline: "Hyperscaler capex commitments extend through 2027",
            summary: "Microsoft, Meta, and Google reaffirm AI infrastructure spend, sustaining GPU demand.",
            sentiment: "bullish",
            tickers: ["NVDA", "MSFT", "META", "GOOGL"],
            published: "1 hr ago"
          }
        },
        {
          component: "order-book",
          props: {
            symbol: "NVDA",
            currency: "USD",
            bids: [
              { price: 945.75, size: 1200 },
              { price: 945.70, size: 3400 },
              { price: 945.65, size: 800 },
              { price: 945.60, size: 5100 },
              { price: 945.55, size: 2200 }
            ],
            asks: [
              { price: 945.85, size: 900 },
              { price: 945.90, size: 4200 },
              { price: 945.95, size: 1600 },
              { price: 946.00, size: 6700 },
              { price: 946.05, size: 2900 }
            ]
          }
        }
      ]
    })
  },
  {
    id: "transactions",
    label: "Show my recent transactions",
    match: /(transaction|spending|recent|charges|activity)/i,
    build: () => ({
      components: [
        {
          component: "account-balance",
          props: {
            accountName: "Everyday Checking",
            accountType: "checking",
            mask: "4421",
            balance: 8420.55,
            available: 8190.00,
            currency: "USD"
          }
        },
        {
          component: "transaction-list",
          props: {
            title: "Last 10 transactions",
            currency: "USD",
            items: [
              { date: "May 18", merchant: "Whole Foods Market", category: "Groceries", amount: -84.22 },
              { date: "May 18", merchant: "Uber", category: "Transport", amount: -18.40 },
              { date: "May 17", merchant: "Payroll — Acme Corp", category: "Income", amount: 4321.05 },
              { date: "May 17", merchant: "Netflix", category: "Subscriptions", amount: -15.99 },
              { date: "May 16", merchant: "Shell", category: "Fuel", amount: -52.10 },
              { date: "May 16", merchant: "Apple", category: "Software", amount: -9.99 },
              { date: "May 15", merchant: "Costco", category: "Groceries", amount: -213.44 },
              { date: "May 14", merchant: "Venmo — Mia", category: "Transfer", amount: -75.00 },
              { date: "May 13", merchant: "Spotify Family", category: "Subscriptions", amount: -16.99 },
              { date: "May 12", merchant: "United Airlines", category: "Travel", amount: -612.40 }
            ]
          }
        }
      ]
    })
  },
  {
    id: "budget",
    label: "Am I on track with my budget?",
    match: /(budget|over\s*spend|on\s*track)/i,
    build: () => ({
      components: [
        {
          component: "alert-banner",
          props: {
            severity: "warning",
            title: "Dining is trending over",
            message: "At day 18 of the month you've used 91% of your dining budget. Trim ~$80/week to land on target.",
            cta: "Adjust budget"
          }
        },
        { component: "budget-bar", props: { category: "Groceries", spent: 412.66, budget: 600, currency: "USD", period: "May" } },
        { component: "budget-bar", props: { category: "Dining", spent: 318.10, budget: 350, currency: "USD", period: "May" } },
        { component: "budget-bar", props: { category: "Transport", spent: 142.50, budget: 250, currency: "USD", period: "May" } },
        { component: "budget-bar", props: { category: "Subscriptions", spent: 89.93, budget: 80, currency: "USD", period: "May" } },
        { component: "budget-bar", props: { category: "Entertainment", spent: 64.20, budget: 150, currency: "USD", period: "May" } },
        { component: "budget-bar", props: { category: "Travel", spent: 612.40, budget: 400, currency: "USD", period: "May" } }
      ]
    })
  },
  {
    id: "refinance",
    label: "Should I refinance my mortgage?",
    match: /(refinance|mortgage|loan|rate|refi)/i,
    build: () => ({
      components: [
        {
          component: "loan-summary",
          props: {
            loanType: "mortgage",
            principal: 480000,
            balance: 412350,
            rate: 6.75,
            termMonths: 360,
            monthlyPayment: 3115.42,
            remainingMonths: 318,
            currency: "USD"
          }
        },
        {
          component: "alert-banner",
          props: {
            severity: "info",
            title: "Refinance window looks favorable",
            message: "Three lenders are offering 80-150 bps below your current 6.75% APR. Recoup analysis below.",
            cta: "Start application"
          }
        },
        { component: "refinance-option", props: { lender: "Better Mortgage", rate: 5.25, term: "30y fixed", monthly: 2762.10, savings: 86400, breakEvenMonths: 26, recommended: true, currency: "USD" } },
        { component: "refinance-option", props: { lender: "Rocket", rate: 5.50, term: "30y fixed", monthly: 2825.50, savings: 71200, breakEvenMonths: 31, recommended: false, currency: "USD" } },
        { component: "refinance-option", props: { lender: "Local CU", rate: 4.95, term: "15y fixed", monthly: 3258.40, savings: 142300, breakEvenMonths: 18, recommended: false, currency: "USD" } },
        {
          component: "forecast-card",
          props: {
            metric: "10Y treasury yield",
            horizon: "Next 6 months",
            point: 4.05, low: 3.65, high: 4.55, confidence: 62,
            driver: "Fed dot plot + softening CPI prints"
          }
        }
      ]
    })
  },
  {
    id: "trade",
    label: "Confirm my BTC buy order",
    match: /(buy|sell|order|execute|trade|confirm)/i,
    build: () => ({
      components: [
        {
          component: "trade-confirmation",
          props: {
            side: "buy",
            ticker: "BTC-USD",
            assetName: "Bitcoin",
            quantity: 0.5,
            price: 68420.55,
            fees: 12.40,
            total: 34222.68,
            orderType: "limit",
            timeInForce: "gtc",
            status: "filled",
            executedAt: "2026-05-19 10:42 ET",
            currency: "USD"
          }
        },
        {
          component: "alert-banner",
          props: {
            severity: "success",
            title: "Order filled",
            message: "Average fill price $68,420.55 (limit met). Funds settle T+0. Tax lot: long-term eligibility starts 2027-05-19."
          }
        },
        {
          component: "stock-quote",
          props: {
            ticker: "BTC-USD",
            name: "Bitcoin",
            price: 68455.10,
            change: 234.55,
            changePct: 0.34,
            currency: "USD",
            exchange: "Coinbase",
            spark: syntheticSpark(68000, 80)
          }
        }
      ]
    })
  },
  {
    id: "invoices",
    label: "What invoices are due?",
    match: /(invoice|bill|payable|due|owe)/i,
    build: () => ({
      components: [
        {
          component: "alert-banner",
          props: {
            severity: "danger",
            title: "1 overdue invoice",
            message: "Pacific Power has been outstanding for 9 days. Late fee accrues at $25/week.",
            cta: "Pay now"
          }
        },
        { component: "invoice-card", props: { vendor: "Pacific Power", invoiceNumber: "PP-22841", amount: 218.40, dueDate: "May 10", status: "overdue", currency: "USD" } },
        { component: "invoice-card", props: { vendor: "Verizon Fios", invoiceNumber: "VZ-99124", amount: 89.99, dueDate: "May 24", status: "unpaid", currency: "USD" } },
        { component: "invoice-card", props: { vendor: "Acme Insurance", invoiceNumber: "AI-77013", amount: 612.00, dueDate: "Jun 01", status: "scheduled", currency: "USD" } },
        { component: "invoice-card", props: { vendor: "Stripe Atlas", invoiceNumber: "SA-00451", amount: 100.00, dueDate: "Apr 30", status: "paid", currency: "USD" } }
      ]
    })
  },
  {
    id: "movers",
    label: "Top market movers today",
    match: /(movers|gainers|losers|biggest)/i,
    build: () => ({
      components: [
        {
          component: "market-mover",
          props: {
            direction: "gainers",
            label: "S&P 500 — Top gainers",
            items: [
              { ticker: "SMCI", name: "Super Micro", price: 1042.10, changePct: 14.20 },
              { ticker: "PLTR", name: "Palantir", price: 28.55, changePct: 9.80 },
              { ticker: "NVDA", name: "NVIDIA", price: 945.80, changePct: 2.32 },
              { ticker: "AMD", name: "Advanced Micro", price: 178.20, changePct: 2.05 },
              { ticker: "META", name: "Meta Platforms", price: 612.40, changePct: 1.80 }
            ]
          }
        },
        {
          component: "market-mover",
          props: {
            direction: "losers",
            label: "S&P 500 — Top losers",
            items: [
              { ticker: "INTC", name: "Intel", price: 18.40, changePct: -7.15 },
              { ticker: "BA", name: "Boeing", price: 154.20, changePct: -4.60 },
              { ticker: "F", name: "Ford", price: 9.85, changePct: -3.20 },
              { ticker: "TGT", name: "Target", price: 102.50, changePct: -2.80 },
              { ticker: "PFE", name: "Pfizer", price: 24.10, changePct: -1.95 }
            ]
          }
        },
        {
          component: "watch-list",
          props: {
            label: "Your watchlist",
            currency: "USD",
            items: [
              { ticker: "TSLA", price: 314.20, changePct: 1.10 },
              { ticker: "AAPL", price: 232.55, changePct: 0.42 },
              { ticker: "GOOGL", price: 178.40, changePct: -0.30 },
              { ticker: "AMZN", price: 224.10, changePct: 0.95 },
              { ticker: "NFLX", price: 612.80, changePct: 1.40 }
            ]
          }
        }
      ]
    })
  },
  {
    id: "fx",
    label: "USD to EUR rate",
    match: /(usd|eur|gbp|jpy|dkk|currency|fx|exchange\s*rate)/i,
    build: () => ({
      components: [
        { component: "currency-rate", props: { base: "USD", quote: "EUR", rate: 0.9214, changePct: -0.14, asOf: "Today 10:45 ET" } },
        { component: "currency-rate", props: { base: "USD", quote: "GBP", rate: 0.7841, changePct: 0.22, asOf: "Today 10:45 ET" } },
        { component: "currency-rate", props: { base: "USD", quote: "JPY", rate: 156.32, changePct: 0.45, asOf: "Today 10:45 ET" } },
        { component: "currency-rate", props: { base: "USD", quote: "DKK", rate: 6.8721, changePct: -0.12, asOf: "Today 10:45 ET" } },
        {
          component: "chart-bars",
          props: {
            title: "USD index — 5-day change vs majors (%)",
            labels: ["EUR", "GBP", "JPY", "CHF", "CAD", "DKK"],
            values: [-0.14, 0.22, 0.45, -0.10, 0.08, -0.12],
            unit: "%"
          }
        }
      ]
    })
  },
  {
    id: "credit",
    label: "How is my credit score?",
    match: /(credit\s*score|fico|equifax|experian|transunion)/i,
    build: () => ({
      components: [
        { component: "credit-score", props: { score: 782, bureau: "Experian", delta: 12, tier: "very-good", asOf: "May 17, 2026" } },
        { component: "kpi-card", props: { label: "Credit utilization", value: "8.4%", delta: -2.1, deltaLabel: "ideal: <10%" } },
        { component: "kpi-card", props: { label: "Avg account age", value: "9.2 yr", tone: "up", deltaLabel: "history is a positive" } },
        { component: "kpi-card", props: { label: "Hard pulls (24mo)", value: "1", tone: "flat", deltaLabel: "no impact expected" } },
        {
          component: "alert-banner",
          props: {
            severity: "info",
            title: "Pre-qualified offers",
            message: "Based on your profile, 3 lenders are offering 0% intro APR cards. Soft pull only.",
            cta: "View offers"
          }
        }
      ]
    })
  },
  {
    id: "palette",
    label: "Show the design palette",
    match: /(palette|theme|tokens?|colou?rs?|swatch)/i,
    build: () => ({
      components: [
        {
          component: "alert-banner",
          props: {
            severity: "info",
            title: "Design tokens (DTCG)",
            message: "Each swatch's color is a dot-path the agent emits (e.g. \"color.brand.accent\"). The framework validates the reference and rewrites it to var(--…) before render."
          }
        },
        { component: "theme-swatch", props: { label: "Accent", color: "color.brand.accent" } },
        { component: "theme-swatch", props: { label: "Surface", color: "color.surface.elev-1" } },
        { component: "theme-swatch", props: { label: "Inset", color: "color.surface.elev-2" } },
        { component: "theme-swatch", props: { label: "Up", color: "color.state.up", caption: "positive movement" } },
        { component: "theme-swatch", props: { label: "Down", color: "color.state.down", caption: "negative movement" } },
        { component: "theme-swatch", props: { label: "Warn", color: "color.state.warn" } },
        { component: "theme-swatch", props: { label: "Chart 1", color: "color.chart.seg-1" } },
        { component: "theme-swatch", props: { label: "Chart 3", color: "color.chart.seg-3" } },
        { component: "theme-swatch", props: { label: "Chart 4", color: "color.chart.seg-4" } }
      ]
    })
  },
  {
    id: "dashboard",
    label: "Give me an end-of-day summary",
    match: /(dashboard|everything|overview|summary)/i,
    build: () => ({
      components: [
        {
          component: "alert-banner",
          props: {
            severity: "info",
            title: "End-of-day summary, May 19 2026",
            message: "Markets closed mixed; your portfolio outperformed the S&P by 32 bps. Two recurring bills paid automatically.",
            cta: "Open full report"
          }
        },
        { component: "kpi-card", props: { label: "Net worth", value: "$1,284,940", delta: 0.42, deltaLabel: "+$5,380 today" } },
        { component: "kpi-card", props: { label: "Cash on hand", value: "$26,840", tone: "flat", deltaLabel: "across 3 accounts" } },
        { component: "kpi-card", props: { label: "Debt", value: "$418,120", delta: -0.21, deltaLabel: "mortgage + auto" } },
        { component: "kpi-card", props: { label: "Savings rate", value: "31%", delta: 2.4, deltaLabel: "trailing 3 months" } },
        {
          component: "portfolio-summary",
          props: {
            label: "Combined investments",
            totalValue: 866820,
            dayChange: 5210,
            dayChangePct: 0.60,
            cash: 26840,
            currency: "USD",
            allocation: [
              { label: "Equities", weight: 64 },
              { label: "Bonds", weight: 14 },
              { label: "Real estate", weight: 10 },
              { label: "Crypto", weight: 6 },
              { label: "Cash", weight: 6 }
            ]
          }
        },
        {
          component: "watch-list",
          props: {
            label: "Watchlist movers",
            currency: "USD",
            items: [
              { ticker: "NVDA", price: 945.80, changePct: 2.32 },
              { ticker: "AAPL", price: 232.55, changePct: 0.42 },
              { ticker: "BTC-USD", price: 68455.10, changePct: 0.34 },
              { ticker: "TLT", price: 88.10, changePct: -0.85 }
            ]
          }
        },
        {
          component: "forecast-card",
          props: {
            metric: "End-of-year net worth",
            horizon: "Dec 31, 2026",
            point: 1402000,
            low: 1310000,
            high: 1498000,
            confidence: 71,
            driver: "Assumes current savings rate and 8% equity return",
            currency: "USD"
          }
        }
      ]
    })
  }
] as const;

export function listScenarios(): readonly { id: string; label: string }[] {
  return SCENARIOS.map((s) => ({ id: s.id, label: s.label }));
}

export function runScenarioById(id: string): AgentResponse | null {
  const s = SCENARIOS.find((sc) => sc.id === id);
  return s ? s.build() : null;
}

const FALLBACK_NOT_FOUND = (prompt: string): AgentResponse => ({
  components: [
    {
      component: "alert-banner",
      props: {
        severity: "info",
        title: "No matching scenario",
        message: `I couldn't match "${prompt}" to a finance scenario. Try one of the suggested prompts on the left.`
      }
    }
  ]
});

const EMPTY_PROMPT: AgentResponse = {
  components: [
    {
      component: "alert-banner",
      props: {
        severity: "info",
        title: "Ask me anything",
        message: "Try: 'show my portfolio', 'budget check', or 'refinance options'."
      }
    }
  ]
};

export async function fakeAgent(prompt: string): Promise<AgentResponse> {
  await new Promise<void>((resolve) => setTimeout(resolve, 350));
  const trimmed = String(prompt ?? "").trim();
  if (!trimmed) return EMPTY_PROMPT;
  for (const s of SCENARIOS) {
    if (s.match.test(trimmed)) return s.build();
  }
  return FALLBACK_NOT_FOUND(trimmed);
}
