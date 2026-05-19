import { agent, prop, tag } from "../../src/index.js";
import { AgentElement } from "../element.js";
import { reactive } from "../reactive.js";
import { escapeHtml, fmtMoney, trendOf } from "../format.js";
import type { Bureau, CreditTier, LoanType } from "../types.js";

@agent("Credit score gauge (300-850) with tier label and point change.")
@tag("credit-score")
export class CreditScoreElement extends AgentElement {
  @prop("Score 300-850", { type: "number", required: true, min: 300, max: 850 })
  @reactive accessor score: number = 700;

  @prop("Reporting bureau", { values: ["Equifax", "Experian", "TransUnion", "FICO", "VantageScore"] })
  @reactive accessor bureau: Bureau = "Equifax";

  @prop("Point change since last pull", { type: "number" })
  @reactive accessor delta: number = 0;

  @prop("Quality tier", { values: ["poor", "fair", "good", "very-good", "exceptional"], required: true })
  @reactive accessor tier: CreditTier = "good";

  @prop("Date label", { type: "string" })
  @reactive accessor asOf: string = "";

  protected override template(): string {
    const minScore = 300;
    const maxScore = 850;
    const pct = Math.max(0, Math.min(1, (this.score - minScore) / (maxScore - minScore)));
    const angle = pct * 180;
    const r = 70;
    const cx = 80;
    const cy = 80;
    const rad = (deg: number): number => (deg - 180) * (Math.PI / 180);
    const x = cx + r * Math.cos(rad(angle));
    const y = cy + r * Math.sin(rad(angle));
    const largeArc = angle > 180 ? 1 : 0;
    const arc = `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${x.toFixed(2)} ${y.toFixed(2)}`;
    return `
      <article class="card credit-score tier-${this.tier}">
        <header>
          <h3>Credit score</h3>
          <span class="muted">${escapeHtml(this.bureau)} • ${escapeHtml(this.asOf)}</span>
        </header>
        <div class="cs-gauge">
          <svg viewBox="0 0 160 90" aria-hidden="true">
            <path d="M 10 80 A 70 70 0 0 1 150 80" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="12" stroke-linecap="round"/>
            <path d="${arc}" fill="none" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>
          </svg>
          <div class="cs-readout">
            <span class="cs-num">${this.score}</span>
            <span class="cs-tier">${this.tier}</span>
          </div>
        </div>
        <footer class="cs-foot">
          <span class="muted">300</span>
          <span class="cs-delta trend-${trendOf(this.delta)}">${this.delta > 0 ? "+" : ""}${this.delta} pts</span>
          <span class="muted">850</span>
        </footer>
      </article>
    `;
  }
}

@agent("Loan or mortgage overview with rate, monthly payment, and pay-down progress.")
@tag("loan-summary")
export class LoanSummaryElement extends AgentElement {
  @prop("Loan type", { values: ["mortgage", "auto", "student", "personal", "heloc"], required: true })
  @reactive accessor loanType: LoanType = "mortgage";

  @prop("Original principal", { type: "number", required: true, min: 0 })
  @reactive accessor principal: number = 0;

  @prop("Current outstanding balance", { type: "number", required: true, min: 0 })
  @reactive accessor balance: number = 0;

  @prop("Annual interest rate percent", { type: "number", required: true, min: 0, max: 50 })
  @reactive accessor rate: number = 0;

  @prop("Original term in months", { type: "number", min: 1 })
  @reactive accessor termMonths: number = 0;

  @prop("Scheduled monthly payment", { type: "number", required: true, min: 0 })
  @reactive accessor monthlyPayment: number = 0;

  @prop("Months remaining", { type: "number", min: 0 })
  @reactive accessor remainingMonths: number = 0;

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  protected override template(): string {
    const paidPct = this.principal > 0
      ? Math.min(100, ((this.principal - this.balance) / this.principal) * 100)
      : 0;
    const yrs = Math.floor(this.remainingMonths / 12);
    const mos = this.remainingMonths % 12;
    const label = this.loanType.charAt(0).toUpperCase() + this.loanType.slice(1);
    return `
      <article class="card loan-summary type-${this.loanType}">
        <header>
          <h3>${escapeHtml(label)}</h3>
          <span class="badge">${this.rate.toFixed(2)}% APR</span>
        </header>
        <dl class="loan-grid">
          <div><dt>Balance</dt><dd>${fmtMoney(this.balance, this.currency)}</dd></div>
          <div><dt>Monthly</dt><dd>${fmtMoney(this.monthlyPayment, this.currency)}</dd></div>
          <div><dt>Original</dt><dd>${fmtMoney(this.principal, this.currency)}</dd></div>
          <div><dt>Remaining</dt><dd>${yrs}y ${mos}m</dd></div>
        </dl>
        <div class="loan-track">
          <div class="loan-fill" style="width:${paidPct}%"></div>
        </div>
        <footer class="muted">${paidPct.toFixed(1)}% paid down</footer>
      </article>
    `;
  }
}

@agent("Single refinance offer comparing rate, monthly payment, and lifetime savings vs current loan.")
@tag("refinance-option")
export class RefinanceOptionElement extends AgentElement {
  @prop("Lender name", { type: "string", required: true })
  @reactive accessor lender: string = "";

  @prop("Offered APR percent", { type: "number", required: true, min: 0, max: 50 })
  @reactive accessor rate: number = 0;

  @prop("Term label like '30y fixed'", { type: "string", required: true })
  @reactive accessor term: string = "";

  @prop("New monthly payment", { type: "number", required: true, min: 0 })
  @reactive accessor monthly: number = 0;

  @prop("Lifetime savings vs current loan", { type: "number" })
  @reactive accessor savings: number = 0;

  @prop("Months to recoup closing costs", { type: "number", min: 0 })
  @reactive accessor breakEvenMonths: number = 0;

  @prop("Highlight as recommended", { type: "boolean" })
  @reactive accessor recommended: boolean = false;

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  protected override template(): string {
    return `
      <article class="card refi-option ${this.recommended ? "recommended" : ""}">
        <header>
          <h4>${escapeHtml(this.lender)}</h4>
          ${this.recommended ? `<span class="badge badge-good">Recommended</span>` : ""}
        </header>
        <div class="refi-row">
          <div><span class="muted">Rate</span><strong>${this.rate.toFixed(2)}%</strong></div>
          <div><span class="muted">Term</span><strong>${escapeHtml(this.term)}</strong></div>
          <div><span class="muted">Monthly</span><strong>${fmtMoney(this.monthly, this.currency)}</strong></div>
        </div>
        <footer>
          <span class="trend-up">Lifetime savings ${fmtMoney(this.savings, this.currency)}</span>
          <span class="muted">Break-even ${this.breakEvenMonths} mo</span>
        </footer>
      </article>
    `;
  }
}
