# Budget-Wise — React + TypeScript

A responsive personal finance tracker with an overview dashboard, income/expense management, transaction charts, conditional categories, HELB tracking, and a freelance income dashboard grouped by platform or client.

## Requirements

- Node.js 20 or newer (Node.js 18.18+ may work with compatible npm versions)
- npm
- A modern browser

## Run locally

1. Extract the ZIP file.
2. Open a terminal in the `budget-wise-source` directory.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open the local URL printed by Vite, usually `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

The production build is created in `dist/`.

## Features

- Total balance = all recorded income minus all recorded expenses.
- Total income and expenses across all dates.
- Monthly transaction count, monthly income, and monthly expenses.
- Daily, weekly, and recent-six-month cash-flow chart.
- Expense-category doughnut chart.
- Add, edit, search, filter, delete, and CSV-export transactions.
- Expense categories: Rent, Transport, Entertainment, Shopping, Sharpness, Bills, Subscriptions, Gift, Other.
- An "Item or Details" field appears for Entertainment, Shopping, Sharpness, Bills, and Subscriptions.
- Income categories include Salary, Freelance, HELB, Business, Gift, Other.
- Freelance entries require a platform/client and optionally accept payment type details.
- Freelance dashboard groups case-insensitive source names, totals payments, calculates source shares, and charts earnings.
- Currency display setting (KES, USD, EUR, GBP).
- Responsive layout for desktop and mobile.
- Data persists in the current browser using localStorage.
- CSV export includes transaction and freelance metadata.

## Important limitations

This is a self-contained front-end starter project. It does **not** include a server, hosted database, login system, or cloud synchronization. Browser localStorage is not secure for sensitive financial data and does not sync between devices or accounts. Clearing browser data can erase locally saved transactions.

The first run starts with a small set of demo transactions so charts and grouping can be explored immediately. To start from a blank slate, open the app and delete the demo transactions, or clear the `budget-wise-transactions-v1` key from browser localStorage.

For production use with real personal financial records, add authenticated server-side storage (for example, Supabase or another backend), enforce per-user access controls, and configure backups before entering sensitive information.

## Project structure

```text
budget-wise-source/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── src/
    ├── App.tsx
    ├── main.tsx
    ├── styles.css
    ├── types.ts
    └── utils.ts
```

## Category note

The expense category is spelled `Sharpness` to match the supplied requirements. If that was intended to mean `Self-care`, change the category in `src/utils.ts` and update the related label in `src/App.tsx`.

## Multi-currency support (updated)

Each transaction now stores its own currency. Dashboard totals, trend data, category breakdowns, freelance totals, and CSV export convert amounts into the selected dashboard currency. The original transaction amount/currency is retained. Currency conversion currently uses the editable demo rates in `src/utils.ts` (`DEFAULT_USD_RATES`) and is **not a live financial quote**. Update rates from a trusted exchange-rate provider before production use; for accurate historical reporting, save the rate and conversion date on each transaction.

Supported transaction currencies in the form: KES, USD, EUR, GBP, CAD, AUD, INR, UGX, TZS, NGN.

## ADMIN-ME secure onboarding backend scaffold

The `supabase/schema.sql` file provides a starting database schema for signup requests, profile fields, administrator roles, and one-time six-digit verification codes. It includes administrator-only code generation and single-use/expiry logic. The reload/regenerate action should call `admin_issue_code(request_id)` only after an authenticated administrator deliberately chooses to issue a code; no payment is required and no code is generated automatically. A successful user verification consumes the code.

**Important setup still required before public launch:**

1. Create a Supabase project and configure Auth and email delivery.
2. Run `supabase/schema.sql` in the SQL editor and add your own authenticated user UUID to `public.admin_roles`.
3. Build/deploy a trusted signup-request endpoint (e.g. Supabase Edge Function) with rate limiting, bot protection, validation, and email confirmation. Do not permit arbitrary browser inserts into `signup_requests`.
4. Connect a private ADMIN-ME page to list requests and invoke `admin_issue_code` only for admins. Display the returned code once; send it manually to the applicant. The database stores only a hash.
5. Connect signup verification to Supabase Auth user creation, and ensure account creation cannot be completed without a verified request. Rate-limit code attempts server-side.
6. Add privacy/terms text and obtain explicit consent for collecting username, email, phone and location. Keep the administrator dashboard limited to these profile/request fields. Do not create any admin policy for user transaction data.
7. Configure backups, HTTPS, logging without secrets or codes, and a privacy/deletion process appropriate to your jurisdiction.

The existing Budget-Wise app is still a local standalone demo using browser storage; this SQL is a backend scaffold, not a claim that live authentication, server-side signup, admin dashboard, or deployment has already been wired up. Never put Supabase service-role keys in frontend code. Have the signup and verification flow security-reviewed before collecting real user data.

## Run locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```
