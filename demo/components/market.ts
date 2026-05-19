import { agent, prop, tag } from "../../src/index.js";
import { AgentElement } from "../element.js";
import { reactive } from "../reactive.js";
import { escapeHtml, fmtMoney, fmtPct, trendOf } from "../format.js";
import { sparkPath } from "../spark.js";
import type { MoverDirection, MoverItem, Sentiment } from "../types.js";

@agent("Live equity quote with ticker, price, day change, and 30-point sparkline.")
@tag("stock-quote")
export class StockQuoteElement extends AgentElement {
  @prop("Ticker symbol", { type: "string", required: true })
  @reactive accessor ticker: string = "";

  @prop("Company name", { type: "string", required: true })
  @reactive accessor name: string = "";

  @prop("Last price", { type: "number", required: true, min: 0 })
  @reactive accessor price: number = 0;

  @prop("Absolute change since open", { type: "number", required: true })
  @reactive accessor change: number = 0;

  @prop("Percent change since open", { type: "number", required: true })
  @reactive accessor changePct: number = 0;

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  @prop("Exchange code, e.g. NASDAQ", { type: "string" })
  @reactive accessor exchange: string = "";

  @prop("Intraday price points for the sparkline", { type: "array", items: "number" })
  @reactive accessor spark: readonly number[] = [];

  protected override template(): string {
    const trend = trendOf(this.change);
    const path = sparkPath(this.spark, 120, 36);
    return `
      <article class="card stock-quote trend-${trend}">
        <header>
          <div class="stock-id">
            <span class="ticker">${escapeHtml(this.ticker)}</span>
            <span class="exchange">${escapeHtml(this.exchange)}</span>
          </div>
          <span class="name">${escapeHtml(this.name)}</span>
        </header>
        <div class="stock-body">
          <div class="price-block">
            <div class="price">${fmtMoney(this.price, this.currency)}</div>
            <div class="change">
              <span class="change-abs">${this.change > 0 ? "+" : ""}${this.change.toFixed(2)}</span>
              <span class="change-pct">${fmtPct(this.changePct)}</span>
            </div>
          </div>
          <svg class="spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden="true">
            <path d="${path}" fill="none" stroke="currentColor" stroke-width="1.6" />
          </svg>
        </div>
      </article>
    `;
  }
}

@agent("Ranked list of top gainers or losers across an index or watchlist.")
@tag("market-mover")
export class MarketMoverElement extends AgentElement {
  @prop("Which side to show", { values: ["gainers", "losers"], required: true })
  @reactive accessor direction: MoverDirection = "gainers";

  @prop("Optional heading override", { type: "string" })
  @reactive accessor label: string = "";

  @prop("Array of {ticker,name,price,changePct}", { type: "array", items: "object", required: true })
  @reactive accessor items: readonly MoverItem[] = [];

  protected override template(): string {
    const rows = this.items
      .map((it) => `
        <li class="mover-row trend-${trendOf(it.changePct)}">
          <span class="mover-tk">${escapeHtml(it.ticker)}</span>
          <span class="mover-name">${escapeHtml(it.name)}</span>
          <span class="mover-pct">${fmtPct(it.changePct)}</span>
          <span class="mover-price">${fmtMoney(it.price)}</span>
        </li>
      `)
      .join("");
    const heading = this.label || (this.direction === "gainers" ? "Top gainers" : "Top losers");
    return `
      <article class="card market-mover mover-${this.direction}">
        <header>
          <h3>${escapeHtml(heading)}</h3>
          <span class="badge">${this.direction}</span>
        </header>
        <ul class="mover-list">${rows}</ul>
      </article>
    `;
  }
}

@agent("Market news item with source, summary, sentiment label, and impacted tickers.")
@tag("news-headline")
export class NewsHeadlineElement extends AgentElement {
  @prop("Publisher name", { type: "string", required: true })
  @reactive accessor source: string = "";

  @prop("Headline text", { type: "string", required: true })
  @reactive accessor headline: string = "";

  @prop("One-line summary", { type: "string" })
  @reactive accessor summary: string = "";

  @prop("Sentiment", { values: ["bullish", "bearish", "neutral"], required: true })
  @reactive accessor sentiment: Sentiment = "neutral";

  @prop("Tickers the story impacts", { type: "array", items: "string" })
  @reactive accessor tickers: readonly string[] = [];

  @prop("Human-friendly timestamp", { type: "string" })
  @reactive accessor published: string = "";

  protected override template(): string {
    const chips = this.tickers.map((t) => `<span class="chip">${escapeHtml(t)}</span>`).join("");
    return `
      <article class="card news-headline sentiment-${this.sentiment}">
        <header>
          <span class="news-source">${escapeHtml(this.source)}</span>
          <span class="news-time">${escapeHtml(this.published)}</span>
        </header>
        <h3 class="news-title">${escapeHtml(this.headline)}</h3>
        <p class="news-summary">${escapeHtml(this.summary)}</p>
        <footer>
          <div class="news-tickers">${chips}</div>
          <span class="sentiment-tag">${this.sentiment}</span>
        </footer>
      </article>
    `;
  }
}

@agent("FX rate between two currencies with daily change.")
@tag("currency-rate")
export class CurrencyRateElement extends AgentElement {
  @prop("Base currency, ISO 4217", { type: "string", required: true })
  @reactive accessor base: string = "USD";

  @prop("Quote currency, ISO 4217", { type: "string", required: true })
  @reactive accessor quote: string = "EUR";

  @prop("Quote per 1 unit of base", { type: "number", required: true, min: 0 })
  @reactive accessor rate: number = 1;

  @prop("24h percent change", { type: "number" })
  @reactive accessor changePct: number = 0;

  @prop("Timestamp label", { type: "string" })
  @reactive accessor asOf: string = "";

  protected override template(): string {
    return `
      <article class="card currency-rate trend-${trendOf(this.changePct)}">
        <header>
          <h3>${escapeHtml(this.base)} → ${escapeHtml(this.quote)}</h3>
          <span class="as-of">${escapeHtml(this.asOf)}</span>
        </header>
        <div class="fx-body">
          <div class="fx-rate">${this.rate.toFixed(4)}</div>
          <div class="fx-change">${fmtPct(this.changePct)}</div>
        </div>
        <p class="fx-eg">1 ${escapeHtml(this.base)} = ${this.rate.toFixed(4)} ${escapeHtml(this.quote)}</p>
      </article>
    `;
  }
}
