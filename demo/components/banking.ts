import { agent, prop, tag } from "../../src/index.js";
import { AgentElement } from "../element.js";
import { reactive } from "../reactive.js";
import { escapeHtml, fmtMoney, fmtSigned, trendOf } from "../format.js";
import type { AccountType, InvoiceStatus, TransactionItem } from "../types.js";

@agent("Bank or brokerage account card with current balance and available funds.")
@tag("account-balance")
export class AccountBalanceElement extends AgentElement {
  @prop("Account display name", { type: "string", required: true })
  @reactive accessor accountName: string = "";

  @prop("Account type", {
    values: ["checking", "savings", "credit", "brokerage", "retirement", "loan"],
    required: true
  })
  @reactive accessor accountType: AccountType = "checking";

  @prop("Last 4 digits of account number", { type: "string" })
  @reactive accessor mask: string = "";

  @prop("Current balance (negative for credit/loan)", { type: "number", required: true })
  @reactive accessor balance: number = 0;

  @prop("Available balance", { type: "number" })
  @reactive accessor available: number = 0;

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  protected override template(): string {
    return `
      <article class="card account-balance type-${this.accountType}">
        <header>
          <div>
            <h3>${escapeHtml(this.accountName)}</h3>
            <span class="muted">${this.accountType.toUpperCase()} •••• ${escapeHtml(this.mask)}</span>
          </div>
          <span class="badge">${escapeHtml(this.currency)}</span>
        </header>
        <div class="acct-balance">${fmtMoney(this.balance, this.currency)}</div>
        <div class="acct-available muted">Available ${fmtMoney(this.available, this.currency)}</div>
      </article>
    `;
  }
}

@agent("Chronological list of bank or card transactions with category and amount.")
@tag("transaction-list")
export class TransactionListElement extends AgentElement {
  @prop("Heading", { type: "string" })
  @reactive override accessor title: string = "Recent transactions";

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  @prop("Array of {date,merchant,category,amount}", { type: "array", items: "object", required: true })
  @reactive accessor items: readonly TransactionItem[] = [];

  protected override template(): string {
    const rows = this.items
      .map((t) => `
        <li class="tx-row trend-${trendOf(t.amount)}">
          <div class="tx-main">
            <span class="tx-merchant">${escapeHtml(t.merchant)}</span>
            <span class="tx-cat">${escapeHtml(t.category)}</span>
          </div>
          <div class="tx-meta">
            <span class="tx-date muted">${escapeHtml(t.date)}</span>
            <span class="tx-amount">${fmtSigned(t.amount, this.currency)}</span>
          </div>
        </li>
      `)
      .join("");
    return `
      <article class="card transaction-list">
        <header>
          <h3>${escapeHtml(this.title)}</h3>
          <span class="badge">${this.items.length}</span>
        </header>
        <ul class="tx-list">${rows}</ul>
      </article>
    `;
  }
}

@agent("Budget category progress bar showing spent vs budgeted with over/warn/ok states.")
@tag("budget-bar")
export class BudgetBarElement extends AgentElement {
  @prop("Category name", { type: "string", required: true })
  @reactive accessor category: string = "";

  @prop("Amount spent this period", { type: "number", required: true, min: 0 })
  @reactive accessor spent: number = 0;

  @prop("Budget for the period", { type: "number", required: true, min: 0 })
  @reactive accessor budget: number = 0;

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  @prop("Period label", { type: "string" })
  @reactive accessor period: string = "this month";

  protected override template(): string {
    const pct = this.budget > 0 ? Math.min(150, (this.spent / this.budget) * 100) : 0;
    const state = pct > 100 ? "over" : pct > 85 ? "warn" : "ok";
    const remaining = this.budget - this.spent;
    return `
      <article class="card budget-bar state-${state}">
        <header>
          <h4>${escapeHtml(this.category)}</h4>
          <span class="muted">${escapeHtml(this.period)}</span>
        </header>
        <div class="budget-track">
          <div class="budget-fill" style="width:${Math.min(100, pct)}%"></div>
          ${pct > 100 ? `<div class="budget-over" style="width:${Math.min(50, pct - 100)}%"></div>` : ""}
        </div>
        <footer>
          <span>${fmtMoney(this.spent, this.currency)} of ${fmtMoney(this.budget, this.currency)}</span>
          <span class="muted">${
            remaining >= 0
              ? `${fmtMoney(remaining, this.currency)} left`
              : `${fmtMoney(-remaining, this.currency)} over`
          }</span>
        </footer>
      </article>
    `;
  }
}

@agent("Outstanding or paid invoice with vendor, amount, due date, and status.")
@tag("invoice-card")
export class InvoiceCardElement extends AgentElement {
  @prop("Vendor name", { type: "string", required: true })
  @reactive accessor vendor: string = "";

  @prop("Invoice identifier", { type: "string", required: true })
  @reactive accessor invoiceNumber: string = "";

  @prop("Amount owed", { type: "number", required: true, min: 0 })
  @reactive accessor amount: number = 0;

  @prop("ISO currency code", { type: "string" })
  @reactive accessor currency: string = "USD";

  @prop("Due date as string", { type: "string" })
  @reactive accessor dueDate: string = "";

  @prop("Status", { values: ["paid", "unpaid", "overdue", "scheduled"], required: true })
  @reactive accessor status: InvoiceStatus = "unpaid";

  protected override template(): string {
    return `
      <article class="card invoice-card status-${this.status}">
        <header>
          <h3>${escapeHtml(this.vendor)}</h3>
          <span class="status-tag">${this.status}</span>
        </header>
        <div class="inv-amount">${fmtMoney(this.amount, this.currency)}</div>
        <footer>
          <span class="muted">Invoice ${escapeHtml(this.invoiceNumber)}</span>
          <span>Due ${escapeHtml(this.dueDate)}</span>
        </footer>
      </article>
    `;
  }
}
