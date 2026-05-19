import { agent, prop, tag } from "../../src/index.js";
import { AgentElement } from "../element.js";
import { reactive } from "../reactive.js";
import { escapeHtml, fmtMoney, fmtPct, fmtSigned, trendOf } from "../format.js";
import type { AllocationSlice, HoldingRow, KpiTone } from "../types.js";

@agent("Headline portfolio value, day P&L, and asset allocation bar with legend.")
@tag("portfolio-summary")
export class PortfolioSummaryElement extends AgentElement {
  @prop("Portfolio label", { type: "string" })
  @reactive accessor label: string = "Portfolio";

  @prop("Total portfolio market value", { type: "number", required: true, min: 0 })
  @reactive accessor totalValue: number = 0;

  @prop("Day P&L absolute", { type: "number" })
  @reactive accessor dayChange: number = 0;

  @prop("Day P&L percent", { type: "number" })
  @reactive accessor dayChangePct: number = 0;

  @prop("Uninvested cash component", { type: "number" })
  @reactive accessor cash: number = 0;

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  @prop("Array of {label,weight}", { type: "array", items: "object", required: true })
  @reactive accessor allocation: readonly AllocationSlice[] = [];

  protected override template(): string {
    const trend = trendOf(this.dayChange);
    const total = this.allocation.reduce((s, a) => s + (a.weight ?? 0), 0) || 1;
    const bar = this.allocation
      .map((a, i) => `
        <div class="alloc-seg seg-${i % 6}"
             style="width:${((a.weight ?? 0) / total) * 100}%"
             title="${escapeHtml(a.label)}: ${((a.weight ?? 0) / total * 100).toFixed(1)}%"></div>
      `)
      .join("");
    const legend = this.allocation
      .map((a, i) => `
        <li>
          <span class="dot seg-${i % 6}"></span>${escapeHtml(a.label)}
          <strong>${((a.weight ?? 0) / total * 100).toFixed(1)}%</strong>
        </li>
      `)
      .join("");
    return `
      <article class="card portfolio-summary trend-${trend}">
        <header>
          <h3>${escapeHtml(this.label)}</h3>
          <span class="badge">${escapeHtml(this.currency)}</span>
        </header>
        <div class="port-value">${fmtMoney(this.totalValue, this.currency)}</div>
        <div class="port-change">
          <span>${fmtSigned(this.dayChange, this.currency)}</span>
          <span>${fmtPct(this.dayChangePct)}</span>
          <span class="muted">today</span>
        </div>
        <div class="alloc-bar">${bar}</div>
        <ul class="alloc-legend">${legend}</ul>
        <footer>
          <span class="muted">Cash: ${fmtMoney(this.cash, this.currency)}</span>
          <span class="muted">Invested: ${fmtMoney(this.totalValue - this.cash, this.currency)}</span>
        </footer>
      </article>
    `;
  }
}

@agent("Tabular holdings list with quantity, cost basis, market value, and unrealized P&L.")
@tag("holdings-table")
export class HoldingsTableElement extends AgentElement {
  @prop("Table heading", { type: "string" })
  @reactive accessor label: string = "Holdings";

  @prop("Reporting currency", { type: "string" })
  @reactive accessor currency: string = "USD";

  @prop("Array of {ticker,quantity,avgCost,last,marketValue,pnl,pnlPct}", { type: "array", items: "object", required: true })
  @reactive accessor rows: readonly HoldingRow[] = [];

  protected override template(): string {
    const body = this.rows
      .map((r) => `
        <tr class="trend-${trendOf(r.pnl)}">
          <td class="tk">${escapeHtml(r.ticker)}</td>
          <td class="qty">${r.quantity}</td>
          <td class="avg">${fmtMoney(r.avgCost, this.currency)}</td>
          <td class="last">${fmtMoney(r.last, this.currency)}</td>
          <td class="mv">${fmtMoney(r.marketValue, this.currency)}</td>
          <td class="pnl">${fmtSigned(r.pnl, this.currency)} <span class="muted">(${fmtPct(r.pnlPct)})</span></td>
        </tr>
      `)
      .join("");
    return `
      <article class="card holdings-table">
        <header>
          <h3>${escapeHtml(this.label)}</h3>
          <span class="badge">${this.rows.length} positions</span>
        </header>
        <table>
          <thead>
            <tr>
              <th>Symbol</th><th>Qty</th><th>Avg cost</th><th>Last</th><th>Market value</th><th>Unrealized P&L</th>
            </tr>
          </thead>
          <tbody>${body}</tbody>
        </table>
      </article>
    `;
  }
}

@agent("Compact KPI tile: label, big value, optional delta percent and caption.")
@tag("kpi-card")
export class KpiCardElement extends AgentElement {
  @prop("Metric label", { type: "string", required: true })
  @reactive accessor label: string = "";

  @prop("Display value (pre-formatted)", { type: "string", required: true })
  @reactive accessor value: string = "";

  @prop("Percent change for tone & arrow", { type: "number" })
  @reactive accessor delta: number | null = null;

  @prop("Sub-label like 'vs last month'", { type: "string" })
  @reactive accessor deltaLabel: string = "";

  @prop("Force tone instead of inferring from delta", { values: ["up", "down", "flat", "neutral"] })
  @reactive accessor tone: KpiTone = "neutral";

  protected override template(): string {
    const inferred = this.tone === "neutral" ? trendOf(this.delta ?? 0) : this.tone;
    return `
      <article class="card kpi-card trend-${inferred}">
        <span class="kpi-label">${escapeHtml(this.label)}</span>
        <div class="kpi-value">${escapeHtml(this.value)}</div>
        <div class="kpi-delta">
          ${typeof this.delta === "number" ? `<span>${fmtPct(this.delta)}</span>` : ""}
          <span class="muted">${escapeHtml(this.deltaLabel)}</span>
        </div>
      </article>
    `;
  }
}

@agent("Simple labeled bar chart, ideal for cash flow, monthly returns, or category totals.")
@tag("chart-bars")
export class ChartBarsElement extends AgentElement {
  @prop("Chart title", { type: "string", required: true })
  @reactive override accessor title: string = "";

  @prop("X-axis labels", { type: "array", items: "string", required: true })
  @reactive accessor labels: readonly string[] = [];

  @prop("Numeric value per label", { type: "array", items: "number", required: true })
  @reactive accessor values: readonly number[] = [];

  @prop("If set, render values as money", { type: "string" })
  @reactive accessor currency: string = "";

  @prop("Optional unit suffix when no currency", { type: "string" })
  @reactive accessor unit: string = "";

  protected override template(): string {
    const max = Math.max(...this.values, 1);
    const min = Math.min(...this.values, 0);
    const range = max - min || 1;
    const bars = this.values
      .map((v, i) => {
        const pos = v >= 0;
        const h = (Math.abs(v) / range) * 100;
        const label = this.labels[i] ?? "";
        const display = this.currency ? fmtMoney(v, this.currency) : `${v}${this.unit}`;
        return `
          <div class="bar-col">
            <div class="bar-val">${display}</div>
            <div class="bar-wrap"><div class="bar ${pos ? "pos" : "neg"}" style="height:${h}%"></div></div>
            <div class="bar-label">${escapeHtml(label)}</div>
          </div>
        `;
      })
      .join("");
    return `
      <article class="card chart-bars">
        <header><h3>${escapeHtml(this.title)}</h3></header>
        <div class="bars">${bars}</div>
      </article>
    `;
  }
}
