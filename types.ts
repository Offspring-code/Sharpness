export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  date: string;
  category: string;
  description: string;
  detail: string;
  freelanceSource: string;
  paymentDetails: string;
  createdAt: string;
};

export type TransactionDraft = Omit<Transaction, "id" | "createdAt">;
