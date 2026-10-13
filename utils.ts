import type { Transaction } from "./types";

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Transport",
  "Entertainment",
  "Shopping",
  "Sharpness",
  "Bills",
  "Subscriptions",
  "Gift",
  "Other",
] as const;

export const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "HELB",
  "Business",
  "Gift",
  "Other",
] as const;

export const DETAIL_CATEGORIES = new Set([
  "Entertainment",
  "Shopping",
  "Sharpness",
  "Bills",
  "Subscriptions",
]);

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function monthKey(date: string): string {
  return date.slice(0, 7);
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export function money(amount: number, currency = "KES"): string {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

// Rates express one unit of currency in USD. These are editable demo rates; configure live rates for production.
export const DEFAULT_USD_RATES: Record<string, number> = { USD: 1, KES: 1 / 129, EUR: 1.09, GBP: 1.28, CAD: 0.73, AUD: 0.66, INR: 0.012, UGX: 1 / 3750, TZS: 1 / 2650, NGN: 1 / 1600 };

export function convertCurrency(amount: number, from: string, to: string, usdRates: Record<string, number> = DEFAULT_USD_RATES): number {
  if (from === to) return amount;
  const fromRate = usdRates[from];
  const toRate = usdRates[to];
  if (!fromRate || !toRate) return amount;
  return amount * fromRate / toRate;
}

export function sumAmounts(items: Transaction[], dashboardCurrency = "KES", usdRates: Record<string, number> = DEFAULT_USD_RATES): number {
  return items.reduce((sum, transaction) => sum + convertCurrency(transaction.amount, transaction.currency || "KES", dashboardCurrency, usdRates), 0);
}

export function normalizeSource(source: string): string {
  return source.trim().replace(/\s+/g, " ");
}

export function sourceKey(source: string): string {
  return normalizeSource(source).toLocaleLowerCase();
}

export function seedTransactions(): Transaction[] {
  const today = new Date();
  const day = (offset: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() + offset);
    return localDateString(date);
  };
  const seed = [
    { type: "income", amount: 18000, currency: "KES", date: day(-25), category: "Freelance", description: "Writing and annotation tasks", detail: "", freelanceSource: "Upwork", paymentDetails: "Platform payout" },
    { type: "expense", amount: 6500, currency: "KES", date: day(-22), category: "Rent", description: "Monthly rent", detail: "", freelanceSource: "", paymentDetails: "" },
    { type: "income", amount: 7200, currency: "KES", date: day(-17), category: "HELB", description: "HELB disbursement", detail: "", freelanceSource: "", paymentDetails: "" },
    { type: "expense", amount: 850, currency: "KES", date: day(-12), category: "Transport", description: "Travel to town", detail: "", freelanceSource: "", paymentDetails: "" },
    { type: "income", amount: 9500, currency: "KES", date: day(-8), category: "Freelance", description: "AI evaluation work", detail: "", freelanceSource: "Upwork", paymentDetails: "Platform payout" },
    { type: "expense", amount: 1400, currency: "KES", date: day(-5), category: "Shopping", description: "Household items", detail: "Household items", freelanceSource: "", paymentDetails: "" },
    { type: "income", amount: 4500, currency: "KES", date: day(-2), category: "Freelance", description: "Captioning task", detail: "", freelanceSource: "Direct client", paymentDetails: "Payment for services" },
    { type: "expense", amount: 600, currency: "KES", date: day(-1), category: "Subscriptions", description: "Monthly subscription", detail: "Monthly subscription", freelanceSource: "", paymentDetails: "" },
  ] satisfies Omit<Transaction, "id" | "createdAt">[];
  return seed.map((item, index) => ({
    ...item,
    id: `demo-${index + 1}`,
    createdAt: new Date().toISOString(),
  }));
}
