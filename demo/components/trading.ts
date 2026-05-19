import { agent, prop, tag } from "../../src/index.js";
import { AgentElement } from "../element.js";
import { reactive } from "../reactive.js";
import { escapeHtml, fmtMoney, fmtPct, trendOf } from "../format.js";
import type {
  AlertSeverity,
  OrderBookLevel,
  OrderType,
  TimeInForce,
  TradeSide,
  TradeStatus,
  WatchlistItem
} from "../types.js";

@agent("Trade ticket showing side, asset, quantity, price, fees, and execution status.")
@tag("trade-confirmation")
export class TradeConfirmationElement extends AgentElement {
  @prop("Buy or sell", { values: ["buy", "sell"], required: true })
  @reactive accessor side: TradeSide = "buy";

  @prop("Symbol", { type: "string", required: true })
  @reactive accessor ticker: string = "";

  @prop("Asset name", { type: "string" })
  @reactive accessor assetName: string = "";

  @prop("Units transacted", { type: "number", required: true, min: 0 })
  @reactive accessor quantity: number = 0;

  @prop("Execution price per unit", { type: "number", required: true, min: 0 })
  @reactive accessor price: number = 0;

  @prop("Total fees", { type: "number", min: 0 })
  @reactive accessor fees: number = 0;

  @prop("Net cash impact, sign per side", { type: "number", required: true })
  @reactive accessor total: number = 0;

  @prop("Order type", { values: ["market", "limit", "stop", "stop-limit"] })
  @reactive accessor orderType: OrderType = "market";

  @prop("Time in force", { values: ["day", "gtc", "ioc", "fok"] })
  @reactive accessor timeInForce: TimeInForce = "day";

  @prop("Lifecycle status", { values: ["pending", "filled", "partial", "rejected", "cancelled"], required: true })
  @reactive accessor status: TradeStatus = "pending";

  @prop("Timestamp label", { type: "string" })
  @reactive accessor executedAt: string = "";

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  protected override template(): string {
    return `
      <article class="card trade-confirmation side-${this.side} status-${this.status}">
        <header>
          <div>
            <span class="side-badge">${this.side.toUpperCase()}</span>
            <h3>${escapeHtml(this.ticker)} · ${escapeHtml(this.assetName)}</h3>
          </div>
          <span class="status-tag">${this.status}</span>
        </header>
        <dl class="trade-grid">
          <div><dt>Quantity</dt><dd>${this.quantity}</dd></div>
          <div><dt>Price</dt><dd>${fmtMoney(this.price, this.currency)}</dd></div>
          <div><dt>Fees</dt><dd>${fmtMoney(this.fees, this.currency)}</dd></div>
          <div><dt>Order</dt><dd>${this.orderType} · ${this.timeInForce}</dd></div>
        </dl>
        <footer>
          <span class="trade-total">Total ${fmtMoney(this.total, this.currency)}</span>
          <span class="muted">${escapeHtml(this.executedAt)}</span>
        </footer>
      </article>
    `;
  }
}

@agent("Inline alert/notice banner with severity, title, message, and optional CTA label.")
@tag("alert-banner")
export class AlertBannerElement extends AgentElement {
  @prop("Severity level", { values: ["info", "success", "warning", "danger"], required: true })
  @reactive accessor severity: AlertSeverity = "info";

  @prop("Bold lead-in", { type: "string", required: true })
  @reactive override accessor title: string = "";

  @prop("Body text", { type: "string", required: true })
  @reactive accessor message: string = "";

  @prop("Optional button label", { type: "string" })
  @reactive accessor cta: string = "";

  protected override template(): string {
    const icon = this.severity === "danger" ? "!" :
      this.severity === "warning" ? "⚠" :
      this.severity === "success" ? "✓" : "i";
    return `
      <div class="alert-banner sev-${this.severity}" role="${this.severity === "danger" ? "alert" : "status"}">
        <div class="alert-icon">${icon}</div>
        <div class="alert-body">
          <strong>${escapeHtml(this.title)}</strong>
          <p>${escapeHtml(this.message)}</p>
        </div>
        ${this.cta ? `<button class="alert-cta">${escapeHtml(this.cta)}</button>` : ""}
      </div>
    `;
  }
}

@agent("Point estimate with low/high band and confidence — for forecasted revenue, cashflow, or price targets.")
@tag("forecast-card")
export class ForecastCardElement extends AgentElement {
  @prop("What is being forecast", { type: "string", required: true })
  @reactive accessor metric: string = "";

  @prop("Time horizon label, e.g. 'Q4 2026'", { type: "string", required: true })
  @reactive accessor horizon: string = "";

  @prop("Central estimate", { type: "number", required: true })
  @reactive accessor point: number = 0;

  @prop("Low end of confidence band", { type: "number", required: true })
  @reactive accessor low: number = 0;

  @prop("High end of confidence band", { type: "number", required: true })
  @reactive accessor high: number = 0;

  @prop("Confidence percent 0-100", { type: "number", min: 0, max: 100 })
  @reactive accessor confidence: number = 0;

  @prop("Primary driver caption", { type: "string" })
  @reactive accessor driver: string = "";

  @prop("ISO currency code if monetary", { type: "string" })
  @reactive accessor currency: string = "";

  protected override template(): string {
    const fmt = (v: number): string => (this.currency ? fmtMoney(v, this.currency) : String(v));
    const range = this.high - this.low || 1;
    const pointPct = ((this.point - this.low) / range) * 100;
    return `
      <article class="card forecast-card">
        <header>
          <h3>${escapeHtml(this.metric)}</h3>
          <span class="badge">${escapeHtml(this.horizon)}</span>
        </header>
        <div class="forecast-point">${fmt(this.point)}</div>
        <div class="forecast-range">
          <span class="muted">${fmt(this.low)}</span>
          <div class="range-track">
            <div class="range-fill"></div>
            <div class="range-marker" style="left:${pointPct}%"></div>
          </div>
          <span class="muted">${fmt(this.high)}</span>
        </div>
        <footer>
          <span class="muted">Confidence ${this.confidence}%</span>
          <span class="muted">${escapeHtml(this.driver)}</span>
        </footer>
      </article>
    `;
  }
}

@agent("Level-2 order book showing top bids and asks with size depth.")
@tag("order-book")
export class OrderBookElement extends AgentElement {
  @prop("Instrument symbol", { type: "string", required: true })
  @reactive accessor symbol: string = "";

  @prop("Array of {price,size}", { type: "array", items: "object", required: true })
  @reactive accessor bids: readonly OrderBookLevel[] = [];

  @prop("Array of {price,size}", { type: "array", items: "object", required: true })
  @reactive accessor asks: readonly OrderBookLevel[] = [];

  @prop("Quote currency", { type: "string" })
  @reactive accessor currency: string = "USD";

  protected override template(): string {
    const maxSize = Math.max(
      ...this.bids.map((b) => b.size),
      ...this.asks.map((a) => a.size),
      1
    );
    const bidRows = this.bids
      .map((b) => `
        <li>
          <span class="depth depth-bid" style="width:${(b.size / maxSize) * 100}%"></span>
          <span class="ob-price">${fmtMoney(b.price, this.currency)}</span>
          <span class="ob-size">${b.size}</span>
        </li>
      `)
      .join("");
    const askRows = this.asks
      .map((a) => `
        <li>
          <span class="depth depth-ask" style="width:${(a.size / maxSize) * 100}%"></span>
          <span class="ob-price">${fmtMoney(a.price, this.currency)}</span>
          <span class="ob-size">${a.size}</span>
        </li>
      `)
      .join("");
    return `
      <article class="card order-book">
        <header><h3>${escapeHtml(this.symbol)} order book</h3></header>
        <div class="ob-grid">
          <div>
            <h4 class="trend-up">Bids</h4>
            <ul class="ob-list bids">${bidRows}</ul>
          </div>
          <div>
            <h4 class="trend-down">Asks</h4>
            <ul class="ob-list asks">${askRows}</ul>
          </div>
        </div>
      </article>
    `;
  }
}

@agent("Compact watchlist showing ticker, price, and percent change per row.")
@tag("watch-list")
export class WatchlistElement extends AgentElement {
  @prop("Heading", { type: "string" })
  @reactive accessor label: string = "Watchlist";

  @prop("Array of {ticker,price,changePct}", { type: "array", items: "object", required: true })
  @reactive accessor items: readonly WatchlistItem[] = [];

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  protected override template(): string {
    const rows = this.items
      .map((it) => `
        <li class="watch-row trend-${trendOf(it.changePct)}">
          <span class="tk">${escapeHtml(it.ticker)}</span>
          <span class="px">${fmtMoney(it.price, this.currency)}</span>
          <span class="pct">${fmtPct(it.changePct)}</span>
        </li>
      `)
      .join("");
    return `
      <article class="card watchlist">
        <header><h3>${escapeHtml(this.label)}</h3><span class="badge">${this.items.length}</span></header>
        <ul class="watch-list">${rows}</ul>
      </article>
    `;
  }
}
