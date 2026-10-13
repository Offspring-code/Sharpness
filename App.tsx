import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BriefcaseBusiness,
  CalendarDays, Check, ChevronDown, CircleDollarSign, Download, LayoutDashboard,
  ListFilter, Plus, ReceiptText, Search, Trash2, Wallet, X, Pencil, TrendingUp,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Bar, BarChart,
} from "recharts";
import type { Transaction, TransactionDraft, TransactionType } from "./types";
import {
  DETAIL_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES, localDateString,
  DEFAULT_USD_RATES, convertCurrency, money, monthKey, monthLabel, normalizeSource, seedTransactions, sourceKey, sumAmounts,
} from "./utils";

type Page = "dashboard" | "transactions" | "freelance";
type Range = "daily" | "weekly" | "monthly";

const STORAGE_KEY = "budget-wise-transactions-v1";
const SETTINGS_KEY = "budget-wise-settings-v1";
const COLORS = ["#6c7cff", "#28c99a", "#f4b544", "#ed7c7c", "#a879e8", "#55b8d8", "#f29f67", "#7c879c"];

const blankDraft = (): TransactionDraft => ({
  type: "expense",
  amount: 0,
  currency: "KES",
  date: localDateString(),
  category: "Transport",
  description: "",
  detail: "",
  freelanceSource: "",
  paymentDetails: "",
});

function readTransactions(): Transaction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Transaction[];
      if (Array.isArray(parsed)) return parsed.map((item) => ({ ...item, currency: item.currency || "KES" }));
    }
  } catch {
    // Recover gracefully if stored data is invalid.
  }
  return seedTransactions();
}

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>(readTransactions);
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedMonth, setSelectedMonth] = useState(monthKey(localDateString()));
  const [range, setRange] = useState<Range>("daily");
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TransactionType>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [currency, setCurrency] = useState("KES");
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_USD_RATES);
  const total = (items: Transaction[]) => sumAmounts(items, currency, rates);
  const [draft, setDraft] = useState<TransactionDraft>(blankDraft());
  const [sourceFilter, setSourceFilter] = useState("all");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) { const settings = JSON.parse(saved); setCurrency(settings.currency || "KES"); if (settings.rates) setRates({ ...DEFAULT_USD_RATES, ...settings.rates }); }
    } catch { /* use default */ }
  }, []);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ currency, rates }));
  }, [currency]);

  const monthTransactions = useMemo(
    () => transactions.filter((item) => monthKey(item.date) === selectedMonth),
    [transactions, selectedMonth],
  );
  const income = total(transactions.filter((item) => item.type === "income"));
  const expenses = total(transactions.filter((item) => item.type === "expense"));
  const balance = income - expenses;
  const monthIncome = total(monthTransactions.filter((item) => item.type === "income"));
  const monthExpenses = total(monthTransactions.filter((item) => item.type === "expense"));
  const freelanceTransactions = transactions.filter((item) => item.type === "income" && item.category === "Freelance");
  const monthFreelance = freelanceTransactions.filter((item) => monthKey(item.date) === selectedMonth);
  const visibleTransactions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return transactions
      .filter((item) => monthKey(item.date) === selectedMonth)
      .filter((item) => filterType === "all" || item.type === filterType)
      .filter((item) => !query || [item.description, item.category, item.detail, item.freelanceSource, item.paymentDetails].some((value) => value.toLowerCase().includes(query)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [transactions, selectedMonth, filterType, search]);

  const sourceGroups = useMemo(() => {
    const map = new Map<string, { name: string; total: number; count: number; latest: string; items: Transaction[] }>();
    const filtered = freelanceTransactions.filter((item) => sourceFilter === "all" || sourceKey(item.freelanceSource) === sourceFilter);
    for (const item of filtered) {
      const name = normalizeSource(item.freelanceSource) || "Unspecified source";
      const key = sourceKey(name);
      const group = map.get(key) || { name, total: 0, count: 0, latest: item.date, items: [] };
      group.total += convertCurrency(item.amount, item.currency || "KES", currency, rates);
      group.count += 1;
      group.latest = group.latest > item.date ? group.latest : item.date;
      group.items.push(item);
      map.set(key, group);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [freelanceTransactions, sourceFilter, currency, rates]);

  const topSource = [...sourceGroups].sort((a, b) => b.total - a.total)[0];
  const selectedMonthName = monthLabel(selectedMonth);
  const monthFreelanceTotal = total(monthFreelance);

  const trendData = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    if (range === "daily") {
      return Array.from({ length: lastDay }, (_, index) => {
        const date = `${selectedMonth}-${String(index + 1).padStart(2, "0")}`;
        const items = monthTransactions.filter((item) => item.date === date);
        return { label: String(index + 1), income: total(items.filter((item) => item.type === "income")), expenses: total(items.filter((item) => item.type === "expense")) };
      });
    }
    if (range === "weekly") {
      return Array.from({ length: Math.ceil(lastDay / 7) }, (_, index) => {
        const start = index * 7 + 1;
        const end = Math.min(start + 6, lastDay);
        const items = monthTransactions.filter((item) => {
          const day = Number(item.date.slice(8, 10));
          return day >= start && day <= end;
        });
        return { label: `${start}–${end}`, income: total(items.filter((item) => item.type === "income")), expenses: total(items.filter((item) => item.type === "expense")) };
      });
    }
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date(year, month - 1 - (5 - index), 1);
      const key = monthKey(localDateString(date));
      const items = transactions.filter((item) => monthKey(item.date) === key);
      return { label: date.toLocaleDateString(undefined, { month: "short" }), income: total(items.filter((item) => item.type === "income")), expenses: total(items.filter((item) => item.type === "expense")) };
    });
  }, [transactions, monthTransactions, selectedMonth, range]);

  const expenseBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of monthTransactions.filter((transaction) => transaction.type === "expense")) {
      map.set(item.category, (map.get(item.category) || 0) + convertCurrency(item.amount, item.currency || "KES", currency, rates));
    }
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [monthTransactions, currency, rates]);

  const openNewForm = (type: TransactionType = "expense") => {
    setEditing(null);
    setDraft({ ...blankDraft(), type, category: type === "income" ? "Salary" : "Transport" });
    setShowForm(true);
  };

  const openEditForm = (transaction: Transaction) => {
    setEditing(transaction);
    const { id: _id, createdAt: _createdAt, ...rest } = transaction;
    void _id; void _createdAt;
    setDraft(rest);
    setShowForm(true);
  };

  const updateDraft = (field: keyof TransactionDraft, value: string | number) => {
    setDraft((current) => {
      const next = { ...current, [field]: value };
      if (field === "type") {
        next.type = value as TransactionType;
        next.category = value === "income" ? "Salary" : "Transport";
        next.detail = "";
        next.freelanceSource = "";
        next.paymentDetails = "";
      }
      if (field === "category" && value !== "Freelance") {
        next.freelanceSource = "";
        next.paymentDetails = "";
      }
      if (field === "category" && !DETAIL_CATEGORIES.has(String(value))) next.detail = "";
      return next;
    });
  };

  const saveTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
      setNotice("Enter an amount greater than zero.");
      return;
    }
    if (!draft.date || !draft.category) {
      setNotice("Please complete the required fields.");
      return;
    }
    if (draft.type === "income" && draft.category === "Freelance" && !draft.freelanceSource.trim()) {
      setNotice("Enter the freelance platform or client.");
      return;
    }
    const cleanDraft: TransactionDraft = {
      ...draft,
      description: draft.description.trim() || draft.detail.trim() || draft.category,
      detail: DETAIL_CATEGORIES.has(draft.category) ? draft.detail.trim() : "",
      freelanceSource: draft.category === "Freelance" ? normalizeSource(draft.freelanceSource) : "",
      paymentDetails: draft.category === "Freelance" ? draft.paymentDetails : "",
      amount: Math.round(draft.amount * 100) / 100,
      currency: draft.currency || "KES",
    };
    if (editing) {
      setTransactions((current) => current.map((item) => item.id === editing.id ? { ...item, ...cleanDraft } : item));
      setNotice("Transaction updated.");
    } else {
      setTransactions((current) => [{ ...cleanDraft, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...current]);
      setNotice("Transaction added.");
    }
    setShowForm(false);
    setEditing(null);
    window.setTimeout(() => setNotice(""), 2800);
  };

  const deleteTransaction = (id: string) => {
    if (!window.confirm("Delete this transaction? This cannot be undone.")) return;
    setTransactions((current) => current.filter((item) => item.id !== id));
    setNotice("Transaction deleted.");
    window.setTimeout(() => setNotice(""), 2800);
  };

  const exportCsv = () => {
    const rows = [
      ["Date", "Type", "Category", "Description", "Item or Details", "Platform or Client", "Payment Details", "Original Amount", "Original Currency", "Converted Amount", "Dashboard Currency"],
      ...transactions.map((item) => [item.date, item.type, item.category, item.description, item.detail, item.freelanceSource, item.paymentDetails, String(item.amount), currency]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "budget-wise-transactions.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "transactions", label: "Transactions", icon: ReceiptText },
    { id: "freelance", label: "Freelance", icon: BriefcaseBusiness },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Wallet size={21} /></div>
          <div><strong>budget-wise</strong><span>Personal finance</span></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? "active" : ""}`} onClick={() => setPage(id)}>
              <Icon size={18} /><span>{label}</span>{id === "freelance" && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="secure-note"><div className="secure-icon"><Activity size={16} /></div><div><strong>Your money, clearer.</strong><span>Track every shilling.</span></div></div>
          <div className="profile"><div className="avatar">BW</div><div className="profile-text"><strong>Personal account</strong><span>Local demo workspace</span></div><ChevronDown size={15} /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-separator">/</span><strong>{navItems.find((item) => item.id === page)?.label}</strong></div>
          <div className="topbar-actions">
            <label className="currency-picker"><span>Currency</span><select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Currency"><option value="KES">KES · KSh</option><option value="USD">USD · $</option><option value="EUR">EUR · €</option><option value="GBP">GBP · £</option><option value="CAD">CAD · C$</option><option value="AUD">AUD · A$</option><option value="INR">INR · ₹</option><option value="UGX">UGX</option><option value="TZS">TZS</option><option value="NGN">NGN · ₦</option></select></label>
            <button className="button button-primary button-small" onClick={() => openNewForm("expense")}><Plus size={16} /> Add transaction</button>
          </div>
        </header>

        <div className="page-content">
          {notice && <div className="toast" role="status"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15} /></button></div>}
          {page === "dashboard" && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR FINANCIAL OVERVIEW</div><h1>Good finances start with clarity.</h1><p>Here's what's happening with your money.</p></div>
                <div className="heading-actions"><label className="month-picker"><CalendarDays size={16} /><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Select month" /></label><button className="button button-primary" onClick={() => openNewForm("income")}><Plus size={17} /> Add income</button></div>
              </div>
              <section className="stat-grid">
                <StatCard title="Total balance" value={money(balance, currency)} note="All recorded income − expenses" icon={<Wallet size={18} />} tone="violet" />
                <StatCard title="Total income" value={money(income, currency)} note="Across all recorded transactions" icon={<ArrowDownLeft size={18} />} tone="green" />
                <StatCard title="Total expenses" value={money(expenses, currency)} note="Across all recorded transactions" icon={<ArrowUpRight size={18} />} tone="orange" />
                <StatCard title="Monthly transactions" value={String(monthTransactions.length)} note={selectedMonthName} icon={<ArrowLeftRight size={18} />} tone="blue" />
              </section>
              <section className="chart-grid">
                <div className="panel trend-panel">
                  <div className="panel-heading"><div><h2>Cash flow</h2><p>Income and expenses over time</p></div><div className="segmented">{(["daily", "weekly", "monthly"] as Range[]).map((value) => <button key={value} className={range === value ? "selected" : ""} onClick={() => setRange(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div></div>
                  <div className="chart-summary"><div><span className="legend-dot income-dot" /> Income <strong>{money(monthIncome, currency)}</strong></div><div><span className="legend-dot expense-dot" /> Expenses <strong>{money(monthExpenses, currency)}</strong></div></div>
                  <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 10, right: 5, left: -15, bottom: 0 }}><defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#28c99a" stopOpacity={0.22} /><stop offset="100%" stopColor="#28c99a" stopOpacity={0} /></linearGradient><linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ed7c7c" stopOpacity={0.17} /><stop offset="100%" stopColor="#ed7c7c" stopOpacity={0} /></linearGradient></defs><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9edf4" /><XAxis dataKey="label" tick={{ fill: "#8992a5", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={18} /><YAxis tick={{ fill: "#8992a5", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)} /><Tooltip formatter={(value) => money(Number(value), currency)} contentStyle={{ borderRadius: 12, border: "1px solid #e7eaf1", boxShadow: "0 8px 24px #15203b12" }} /><Area type="monotone" dataKey="income" name="Income" stroke="#28b98e" strokeWidth={2.5} fill="url(#incomeGradient)" /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ed7c7c" strokeWidth={2.5} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></div>
                </div>
                <div className="panel expense-panel">
                  <div className="panel-heading"><div><h2>Where it goes</h2><p>Expense breakdown · {selectedMonthName}</p></div><div className="small-icon"><ListFilter size={17} /></div></div>
                  {expenseBreakdown.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseBreakdown} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">{expenseBreakdown.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => money(Number(value), currency)} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{money(monthExpenses, currency)}</strong><span>Total spent</span></div></div><div className="category-legend">{expenseBreakdown.slice(0, 5).map((entry, index) => <div key={entry.name} className="category-row"><span className="category-color" style={{ background: COLORS[index % COLORS.length] }} /><span>{entry.name}</span><strong>{money(entry.value, currency)}</strong></div>)}</div></> : <EmptyState title="No expenses yet" text="Add an expense to see your spending breakdown." />}
                </div>
              </section>
              <section className="panel recent-panel">
                <div className="panel-heading"><div><h2>Recent transactions</h2><p>Your latest activity for {selectedMonthName}</p></div><button className="text-button" onClick={() => setPage("transactions")}>View all <span>→</span></button></div>
                <TransactionTable transactions={monthTransactions.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5)} currency={currency} onEdit={openEditForm} onDelete={deleteTransaction} />
              </section>
            </>
          )}

          {page === "transactions" && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow"><span className="eyebrow-dot" /> MONEY IN, MONEY OUT</div><h1>Transactions</h1><p>Every shilling has a story. Keep track of yours.</p></div>
                <div className="heading-actions"><button className="button button-secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button><button className="button button-primary" onClick={() => openNewForm()}><Plus size={17} /> Add transaction</button></div>
              </div>
              <div className="mini-stat-row"><div><span>Income · {selectedMonthName}</span><strong className="positive">{money(monthIncome, currency)}</strong></div><div><span>Expenses · {selectedMonthName}</span><strong className="negative">{money(monthExpenses, currency)}</strong></div><div><span>Transactions</span><strong>{monthTransactions.length}</strong></div></div>
              <section className="panel transactions-panel">
                <div className="filters-row"><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions..." /></label><label className="filter-select"><CalendarDays size={15} /><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Filter by month" /></label><select className="filter-select native-select" value={filterType} onChange={(event) => setFilterType(event.target.value as "all" | TransactionType)} aria-label="Filter by type"><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select></div>
                <TransactionTable transactions={visibleTransactions} currency={currency} onEdit={openEditForm} onDelete={deleteTransaction} />
                <div className="table-footer"><span>Showing {visibleTransactions.length} of {monthTransactions.length} transactions</span><span>Totals recalculate automatically</span></div>
              </section>
            </>
          )}

          {page === "freelance" && (
            <>
              <div className="page-heading">
                <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR INDEPENDENT INCOME</div><h1>Freelance earnings</h1><p>Every platform, every client, one clear picture.</p></div>
                <div className="heading-actions"><label className="month-picker"><CalendarDays size={16} /><input type="month" value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} aria-label="Select month" /></label><button className="button button-primary" onClick={() => openNewForm("income")}><Plus size={17} /> Add income</button></div>
              </div>
              <section className="stat-grid freelance-stats">
                <StatCard title="Total freelance income" value={money(total(freelanceTransactions), currency)} note="All platforms · all time" icon={<BriefcaseBusiness size={18} />} tone="violet" />
                <StatCard title="Earned this month" value={money(monthFreelanceTotal, currency)} note={selectedMonthName} icon={<TrendingUp size={18} />} tone="green" />
                <StatCard title="Payments this month" value={String(monthFreelance.length)} note="Freelance transactions received" icon={<ReceiptText size={18} />} tone="blue" />
                <StatCard title="Top earning source" value={topSource?.name || "—"} note={topSource ? money(topSource.total, currency) + " total" : "Add freelance income to begin"} icon={<CircleDollarSign size={18} />} tone="orange" compact />
              </section>
              <section className="chart-grid freelance-charts">
                <div className="panel trend-panel"><div className="panel-heading"><div><h2>Earnings by platform</h2><p>All-time freelance income</p></div></div>{sourceGroups.length ? <div className="chart-wrap bar-chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={sourceGroups} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}><CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#e9edf4" /><XAxis dataKey="name" tick={{ fill: "#8992a5", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#8992a5", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value: number) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)} /><Tooltip formatter={(value) => money(Number(value), currency)} /><Bar dataKey="total" name="Earnings" fill="#6c7cff" radius={[7, 7, 0, 0]} maxBarSize={46} /></BarChart></ResponsiveContainer></div> : <EmptyState title="No freelance income yet" text="Add an income transaction and choose Freelance." />}</div>
                <div className="panel expense-panel"><div className="panel-heading"><div><h2>Source share</h2><p>Share of freelance income</p></div></div>{sourceGroups.length ? <><div className="donut-wrap"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sourceGroups} dataKey="total" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} stroke="none">{sourceGroups.map((entry, index) => <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => money(Number(value), currency)} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>{money(total(freelanceTransactions), currency)}</strong><span>Freelance total</span></div></div><div className="category-legend">{sourceGroups.slice(0, 5).map((entry, index) => <div key={entry.name} className="category-row"><span className="category-color" style={{ background: COLORS[index % COLORS.length] }} /><span>{entry.name}</span><strong>{total(freelanceTransactions) ? `${Math.round(entry.total / total(freelanceTransactions) * 100)}%` : "0%"}</strong></div>)}</div></> : <EmptyState title="No source breakdown" text="Your platform share will appear here." />}</div>
              </section>
              <section className="panel recent-panel">
                <div className="panel-heading"><div><h2>Platforms & clients</h2><p>Income is automatically grouped by source name</p></div><label className="filter-select"><ListFilter size={15} /><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="Filter freelance source"><option value="all">All sources</option>{sourceGroups.map((group) => <option key={group.name} value={sourceKey(group.name)}>{group.name}</option>)}</select></label></div>
                {sourceGroups.length ? <div className="source-grid">{sourceGroups.filter((group) => sourceFilter === "all" || sourceKey(group.name) === sourceFilter).map((group, index) => <div className="source-card" key={group.name}><div className="source-card-top"><div className="source-icon" style={{ background: `${COLORS[index % COLORS.length]}18`, color: COLORS[index % COLORS.length] }}><BriefcaseBusiness size={18} /></div><span className="source-share">{total(freelanceTransactions) ? Math.round(group.total / total(freelanceTransactions) * 100) : 0}% of total</span></div><h3>{group.name}</h3><strong className="source-total">{money(group.total, currency)}</strong><div className="source-meta"><span>{group.count} {group.count === 1 ? "payment" : "payments"}</span><span>Last: {group.latest}</span></div><div className="source-progress"><span style={{ width: `${total(freelanceTransactions) ? group.total / total(freelanceTransactions) * 100 : 0}%`, background: COLORS[index % COLORS.length] }} /></div></div>)}</div> : <EmptyState title="Your freelance journey starts here" text="Record a Freelance income transaction and choose a platform or client." />}
                <div className="subsection-heading"><div><h3>Freelance payment history</h3><p>All freelance payments, newest first</p></div></div>
                <TransactionTable transactions={freelanceTransactions.filter((item) => sourceFilter === "all" || sourceKey(item.freelanceSource) === sourceFilter).slice().sort((a, b) => b.date.localeCompare(a.date))} currency={currency} onEdit={openEditForm} onDelete={deleteTransaction} />
              </section>
            </>
          )}
          <footer className="app-footer"><span>Budget-Wise <span className="footer-dot">·</span> Make every shilling count.</span><span>Local demo · Data stored in this browser</span></footer>
        </div>
      </main>

      {showForm && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}><section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title"><div className="modal-heading"><div><div className="eyebrow"><span className="eyebrow-dot" /> TRANSACTION DETAILS</div><h2 id="transaction-modal-title">{editing ? "Edit transaction" : "Add transaction"}</h2><p>Record the details so your dashboard stays accurate.</p></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form"><X size={19} /></button></div>
        <form onSubmit={saveTransaction}>
          <div className="type-toggle"><button type="button" className={draft.type === "expense" ? "expense-active" : ""} onClick={() => updateDraft("type", "expense")}><ArrowUpRight size={17} /> Expense</button><button type="button" className={draft.type === "income" ? "income-active" : ""} onClick={() => updateDraft("type", "income")}><ArrowDownLeft size={17} /> Income</button></div>
          <div className="form-grid"><label className="form-field"><span>Amount <em>*</em></span><div className="amount-input"><span>{draft.currency || "KES"}</span><input type="number" min="0.01" step="0.01" required value={draft.amount || ""} onChange={(event) => updateDraft("amount", Number(event.target.value))} placeholder="0.00" /></div></label>
            <label className="form-field"><span>Transaction currency <em>*</em></span><select required value={draft.currency || "KES"} onChange={(event) => updateDraft("currency", event.target.value)}>{["KES","USD","EUR","GBP","CAD","AUD","INR","UGX","TZS","NGN"].map((code) => <option key={code} value={code}>{code}</option>)}</select><small>Dashboard totals are converted to {currency} using the configured demo rates.</small></label>
            <label className="form-field"><span>Category <em>*</em></span><select required value={draft.category} onChange={(event) => updateDraft("category", event.target.value)}>{(draft.type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
            <label className="form-field"><span>Date <em>*</em></span><input type="date" required value={draft.date} onChange={(event) => updateDraft("date", event.target.value)} /></label>
            <label className="form-field full-field"><span>Description</span><input value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} placeholder={draft.type === "income" ? "e.g. Monthly salary" : "e.g. Weekly groceries"} /></label>
            {draft.type === "expense" && DETAIL_CATEGORIES.has(draft.category) && <label className="form-field full-field conditional-field"><span>Item or Details <em>*</em></span><input required value={draft.detail} onChange={(event) => updateDraft("detail", event.target.value)} placeholder={draft.category === "Sharpness" ? "e.g. Haircut or grooming" : `What did you pay for in ${draft.category.toLowerCase()}?`} /><small>Be specific so you can understand this expense later.</small></label>}
            {draft.type === "income" && draft.category === "Freelance" && <><label className="form-field full-field conditional-field"><span>Platform or Income Source <em>*</em></span><input list="freelance-sources" required value={draft.freelanceSource} onChange={(event) => updateDraft("freelanceSource", event.target.value)} placeholder="e.g. Upwork, Fiverr, direct client" /><datalist id="freelance-sources">{[...new Set(freelanceTransactions.map((item) => normalizeSource(item.freelanceSource)).filter(Boolean))].map((source) => <option key={source} value={source} />)}<option value="Upwork" /><option value="Fiverr" /><option value="Remotasks" /><option value="Direct client" /></datalist><small>Matching source names are automatically grouped on the Freelance dashboard.</small></label><label className="form-field full-field"><span>Payment Details</span><select value={draft.paymentDetails} onChange={(event) => updateDraft("paymentDetails", event.target.value)}><option value="">Choose payment type (optional)</option><option value="Platform payout">Platform payout</option><option value="Payment for services">Payment for services</option><option value="Bonus or incentive">Bonus or incentive</option><option value="Other freelance payment">Other freelance payment</option></select></label></>}
          </div>
          <div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="button button-primary"><Check size={16} /> {editing ? "Save changes" : "Save transaction"}</button></div>
        </form>
      </section></div>}
    </div>
  );
}

function StatCard({ title, value, note, icon, tone, compact = false }: { title: string; value: string; note: string; icon: React.ReactNode; tone: string; compact?: boolean }) {
  return <div className="stat-card"><div className="stat-top"><span>{title}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><strong className={`stat-value ${compact ? "compact-value" : ""}`} title={value}>{value}</strong><span className="stat-note">{note}</span></div>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div className="empty-icon"><ReceiptText size={22} /></div><strong>{title}</strong><span>{text}</span></div>;
}

function TransactionTable({ transactions, currency, onEdit, onDelete }: { transactions: Transaction[]; currency: string; onEdit: (transaction: Transaction) => void; onDelete: (id: string) => void }) {
  if (!transactions.length) return <EmptyState title="No transactions found" text="Add a transaction or adjust your filters to see activity here." />;
  return <div className="table-scroll"><table className="transaction-table"><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Amount</th><th aria-label="Actions" /></tr></thead><tbody>{transactions.map((item) => <tr key={item.id}><td><div className="transaction-name"><div className={`transaction-type-icon ${item.type}`} >{item.type === "income" ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}</div><div className="transaction-title"><strong>{item.description || item.category}</strong><span>{item.type === "income" && item.category === "Freelance" ? item.freelanceSource : item.detail || (item.type === "income" ? "Income received" : "Expense recorded")}</span></div></div></td><td><span className={`category-pill ${item.type}`}>{item.category}</span></td><td className="date-cell">{item.date}</td><td><strong className={`amount-cell ${item.type}`}>{item.type === "income" ? "+" : "−"}{money(item.amount, item.currency || "KES")}<small className="original-amount"> ≈ {money(convertCurrency(item.amount, item.currency || "KES", currency), currency)}</small></strong></td><td><div className="row-actions"><button className="icon-button" onClick={() => onEdit(item)} aria-label={`Edit ${item.description}`} title="Edit"><Pencil size={15} /></button><button className="icon-button danger-icon" onClick={() => onDelete(item.id)} aria-label={`Delete ${item.description}`} title="Delete"><Trash2 size={15} /></button></div></td></tr>)}</tbody></table></div>;
}

export default App;
