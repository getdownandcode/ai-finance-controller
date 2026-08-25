import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  CreditCard,
  Database,
  DollarSign,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FileUp,
  FileWarning,
  History,
  Menu,
  MessageSquare,
  Play,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  UploadCloud,
  Sun,
  Moon,
  X,
} from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

const btn =
  'inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold leading-none transition-all duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = cx(btn, 'bg-primary text-primary-foreground shadow-sm hover:opacity-90 active:translate-y-px');
const btnSecondary = cx(btn, 'bg-secondary text-secondary-foreground shadow-sm hover:opacity-90 active:translate-y-px');
const btnOutline = cx(btn, 'border border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-accent/40');
const btnMuted = cx(btn, 'border border-border bg-muted text-foreground hover:border-primary/50 hover:text-primary');
const btnGhost = cx(btn, 'text-muted-foreground hover:bg-muted hover:text-foreground');
const btnDanger = cx(btn, 'border border-border bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive');
const surface = 'rounded-2xl border border-border bg-card shadow-sm';
const field =
  'w-full rounded-xl border border-input bg-card px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring';

function MatchMindLogo({ className = "h-8 w-auto", showWordmark = true }) {
  return (
    <div className={cx("flex items-center gap-3 select-none", className)}>
      <svg
        className="h-8 w-8 shrink-0"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="MatchMind"
      >
        <defs>
          <linearGradient id="mm-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e78a53" />
            <stop offset="100%" stopColor="#5f8787" />
          </linearGradient>
        </defs>
        <rect width="48" height="48" rx="12" fill="url(#mm-brand-grad)" />
        <g opacity="0.95">
          <rect x="11" y="14" width="18" height="22" rx="3" fill="white" />
          <rect x="19" y="10" width="18" height="22" rx="3" fill="none" stroke="white" strokeWidth="1.6" />
        </g>
        <path
          d="M17 24.5 L21.5 29 L31 18.5"
          stroke="#e78a53"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="34.5" cy="13.5" r="1.7" fill="white" opacity="0.95" />
        <circle cx="36.5" cy="19" r="1.2" fill="white" opacity="0.85" />
        <circle cx="32" cy="9.5" r="1.2" fill="white" opacity="0.85" />
        <line x1="34.5" y1="13.5" x2="36.5" y2="19" stroke="white" strokeWidth="0.9" opacity="0.7" />
        <line x1="34.5" y1="13.5" x2="32" y2="9.5" stroke="white" strokeWidth="0.9" opacity="0.7" />
      </svg>
      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <span className="font-mono text-[16px] font-extrabold tracking-tight text-foreground">
            Match<span className="text-primary">Mind</span>
          </span>
          <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
            Autonomous Financial Controller
          </span>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, badge }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-sm transition-all duration-200 hover:border-primary/40 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 dark:text-slate-200">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border transition-colors duration-200 group-hover:text-primary group-hover:ring-primary/40">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-2xl font-bold tracking-tight tabular-nums leading-none text-foreground">{value}</span>
        {badge}
      </div>
      <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

function RunwayForecasterChart({ timeline, formatHeadlineMoney }) {
  if (!timeline || timeline.length === 0) return null;

  const width = 640;
  const height = 150;
  const padLeft = 50;
  const padRight = 50;
  const padTop = 26;
  const padBottom = 28;

  const cashValues = timeline.map((t) => t.cash);
  const minCash = Math.min(...cashValues);
  const maxCash = Math.max(...cashValues);
  const range = maxCash === minCash ? 1 : maxCash - minCash;
  const paddedMin = Math.max(0, minCash - range * 0.12);
  const paddedMax = maxCash + range * 0.18;
  const paddedRange = paddedMax - paddedMin || 1;

  const points = timeline.map((pt, i) => {
    const x = padLeft + (i / (timeline.length - 1)) * (width - padLeft - padRight);
    const y = padTop + (1 - (pt.cash - paddedMin) / paddedRange) * (height - padTop - padBottom);
    return { ...pt, x, y };
  });

  const linePath = points.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padBottom} L ${points[0].x.toFixed(1)} ${height - padBottom} Z`;

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border/80 bg-muted/20 p-4">
      <div className="mb-2.5 flex items-center justify-between px-1 text-xs">
        <span className="font-bold uppercase tracking-wider text-foreground/80 dark:text-slate-200">Forward Liquidity Trajectory Chart</span>
        <span className="font-mono text-xs font-bold text-secondary">
          +{formatHeadlineMoney(timeline[timeline.length - 1].cash - timeline[0].cash)} Projected Cash Net Growth
        </span>
      </div>
      <div className="relative w-full aspect-[4/1] min-h-[140px] max-h-[175px]">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-full w-full overflow-visible font-mono"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="runway-area-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.30" />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          <line
            x1={padLeft}
            y1={padTop}
            x2={width - padRight}
            y2={padTop}
            stroke="var(--border)"
            strokeDasharray="4 4"
            strokeOpacity="0.6"
          />
          <line
            x1={padLeft}
            y1={height - padBottom}
            x2={width - padRight}
            y2={height - padBottom}
            stroke="var(--border)"
            strokeOpacity="0.8"
          />

          {/* Gradient Area */}
          <path d={areaPath} fill="url(#runway-area-gradient)" />

          {/* Trend Line */}
          <path
            d={linePath}
            fill="none"
            stroke="var(--chart-1)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Milestone markers and values */}
          {points.map((p, i) => (
            <g key={i} className="group pointer-events-none select-none">
              {/* Vertical guideline */}
              <line
                x1={p.x}
                y1={p.y}
                x2={p.x}
                y2={height - padBottom}
                stroke="var(--chart-1)"
                strokeDasharray="2 3"
                strokeOpacity="0.35"
              />

              {/* Data point dot */}
              <circle
                cx={p.x}
                cy={p.y}
                r="4.5"
                fill="var(--card)"
                stroke="var(--chart-1)"
                strokeWidth="2.5"
              />

              {/* Amount label above dot */}
              <text
                x={p.x}
                y={Math.max(14, p.y - 8)}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-bold font-mono select-none pointer-events-none"
              >
                {formatHeadlineMoney(p.cash)}
              </text>

              {/* Time milestone label below baseline */}
              <text
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px] font-bold uppercase tracking-wider select-none pointer-events-none"
              >
                {p.label}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      {Icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground/70 ring-1 ring-border">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      {subtitle && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

const CATEGORIES = [
  { id: 'bank', label: 'Bank Account (HDFC/ICICI/SBI)', icon: Building2, desc: 'Current A/c, NEFT/RTGS & UPI bank feeds' },
  { id: 'ledger', label: 'General Ledger (Tally/Zoho)', icon: FileSpreadsheet, desc: 'TallyPrime, Zoho Books, QuickBooks India journals' },
  { id: 'invoice', label: 'GST Invoices / TDS Bills', icon: Receipt, desc: 'B2B GST e-Invoices, TDS payable/receivable' },
  { id: 'gateway', label: 'Razorpay Gateway & Payouts', icon: CreditCard, desc: 'Razorpay Route, Smart Collect, UPI settlements' },
];

function detectCategoryAndLabel(filename) {
  const clean = filename.replace(/\.[^/.]+$/, "");
  const lower = clean.toLowerCase();
  if (lower.includes("bank") || lower.includes("hdfc") || lower.includes("icici") || lower.includes("sbi") || lower.includes("axis") || lower.includes("kotak") || lower.includes("neft") || lower.includes("rtgs") || lower.includes("imps") || lower.includes("statement") || lower.includes("feed") || lower.includes("current")) {
    return { category: 'bank', label: clean.replace(/[-_]/g, ' ') };
  }
  if (lower.includes("ledger") || lower.includes("tally") || lower.includes("zoho") || lower.includes("quickbooks") || lower.includes("journal") || lower.includes("gl") || lower.includes("erp") || lower.includes("books")) {
    return { category: 'ledger', label: clean.replace(/[-_]/g, ' ') };
  }
  if (lower.includes("inv") || lower.includes("gst") || lower.includes("tds") || lower.includes("bill") || lower.includes("ar") || lower.includes("ap") || lower.includes("receipt") || lower.includes("einvoice")) {
    return { category: 'invoice', label: clean.replace(/[-_]/g, ' ') };
  }
  if (lower.includes("razorpay") || lower.includes("rzp") || lower.includes("smart_collect") || lower.includes("payout") || lower.includes("upi") || lower.includes("paytm") || lower.includes("phonepe") || lower.includes("gateway")) {
    return { category: 'gateway', label: clean.replace(/[-_]/g, ' ') };
  }
  return { category: 'bank', label: clean.replace(/[-_]/g, ' ') };
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const LS_KEY = 'afc_session';
const LS_TAB = 'afc_activeTab';
const LS_SIDEBAR = 'afc_sidebarOpen';
const LS_TOKEN = 'afc_token';
const LS_USER = 'afc_user';

export default function App() {
  // --- Auth ---
  const [token, setToken] = useState(() => localStorage.getItem(LS_TOKEN) || null);
  const [user, setUser] = useState(() => localStorage.getItem(LS_USER) || null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authUser, setAuthUser] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);

  const authHeaders = () => token ? { 'Authorization': `Bearer ${token}` } : {};
  const authFetch = (url, opts = {}) => {
    const h = { ...authHeaders(), ...(opts.headers || {}) };
    return fetch(url, { ...opts, headers: h });
  };

  useEffect(() => {
    // verify token on mount
    if (!token) { setAuthChecked(true); return; }
    fetch('/api/auth/me', { headers: authHeaders() }).then(async r => {
      if (r.ok) { const j = await r.json(); setUser(j.username); localStorage.setItem(LS_USER, j.username); }
      else { setToken(null); setUser(null); localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); }
    }).catch(() => {}).finally(() => setAuthChecked(true));
  }, []);

  const handleAuth = async (e) => {
    if (e) e.preventDefault();
    setAuthLoading(true); setAuthError(null);
    try {
      const endpoint = authMode === 'register' ? '/api/auth/register' : '/api/auth/login';
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: authUser, password: authPass }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.detail || 'Auth failed');
      setToken(j.token); setUser(j.username);
      localStorage.setItem(LS_TOKEN, j.token); localStorage.setItem(LS_USER, j.username);
      setAuthError(null);
    } catch (err) { setAuthError(err.message); }
    finally { setAuthLoading(false); }
  };
  const handleLogout = async () => {
    try { await authFetch('/api/auth/logout', { method: 'POST' }); } catch {}
    setToken(null); setUser(null); localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER);
    setResults(null); localStorage.removeItem(LS_KEY); setSessions([]); setActiveTab('ingest');
  };

  const LS_THEME = "matchmind_theme";
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_THEME);
      if (saved) return saved;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch {
      return "dark";
    }
  });

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
        root.classList.remove("light");
      } else {
        root.classList.remove("dark");
        root.classList.add("light");
      }
      localStorage.setItem(LS_THEME, theme);
    } catch {}
  }, [theme]);

  const [activeTab, setActiveTab] = useState(() => localStorage.getItem(LS_TAB) || 'ingest');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(() => {
    try { const raw = localStorage.getItem(LS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [error, setError] = useState(null);
  const [filesList, setFilesList] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [exceptionFilter, setExceptionFilter] = useState('ALL');
  const [exceptionSearch, setExceptionSearch] = useState('');
  const [clusterSearch, setClusterSearch] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.innerWidth < 1024) return false;
      return localStorage.getItem(LS_SIDEBAR) !== '0';
    } catch {
      return true;
    }
  });
  const isMobileLayout = () => typeof window !== 'undefined' && window.innerWidth < 1024;
  const closeSidebarIfMobile = () => { if (isMobileLayout()) setSidebarOpen(false); };

  const addFiles = (newFiles, defaultCategory = null) => {
    if (!newFiles || newFiles.length === 0) return;
    const items = Array.from(newFiles).map((file, idx) => {
      const detected = detectCategoryAndLabel(file.name);
      const category = defaultCategory || detected.category;
      return {
        id: `${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        file,
        name: file.name,
        size: file.size,
        category,
        label: detected.label,
        openingBalance: '0.00',
      };
    });
    setFilesList((prev) => [...prev, ...items]);
  };

  const removeFile = (id) => {
    setFilesList((prev) => prev.filter((f) => f.id !== id));
  };

  const updateFileItem = (id, key, value) => {
    setFilesList((prev) =>
      prev.map((f) => (f.id === id ? { ...f, [key]: value } : f))
    );
  };

  // persist activeTab
  useEffect(() => { localStorage.setItem(LS_TAB, activeTab); }, [activeTab]);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      localStorage.setItem(LS_SIDEBAR, sidebarOpen ? '1' : '0');
    }
  }, [sidebarOpen]);

  // persist results to localStorage (survives refresh)
  useEffect(() => {
    try {
      if (results) localStorage.setItem(LS_KEY, JSON.stringify(results));
      else localStorage.removeItem(LS_KEY);
    } catch {}
  }, [results]);

  // fetch session history from backend on mount and after each reconcile
  const fetchSessions = async () => {
    if (!token) return;
    try {
      const r = await authFetch('/api/sessions');
      if (r.ok) { const j = await r.json(); setSessions(j.sessions || []); }
    } catch {}
  };
  useEffect(() => { if (user) fetchSessions(); }, [user, token]);

  const persistAndShow = (data) => {
    setResults(data);
    setActiveTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    fetchSessions();
    closeSidebarIfMobile();
  };

  const handleCustomReconcile = async (e) => {
    if (e) e.preventDefault();
    if (filesList.length === 0) {
      setError('Please upload at least one CSV file (Bank Statement, General Ledger, Invoices, or Gateway).');
      return;
    }
    setLoading(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const formData = new FormData();
      const meta = [];
      filesList.forEach((item) => {
        formData.append('files', item.file);
        meta.push({
          category: item.category,
          label: item.label,
          opening_balance: parseFloat(item.openingBalance) || 0.0,
          source_key: `${item.category}:${item.label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        });
      });
      formData.append('metadata', JSON.stringify(meta));
      formData.append('llm_mode', 'auto');
      formData.append('goal', 'reconcile');
      const res = await authFetch('/api/reconcile', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Reconciliation execution failed');
      }
      const data = await res.json();
      persistAndShow(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRunSampleData = async () => {
    setLoading(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const formData = new FormData();
      formData.append('seed', 42);
      formData.append('llm_mode', 'auto');
      formData.append('goal', 'reconcile');
      const res = await authFetch('/api/reconcile-demo', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Sample batch reconciliation failed');
      }
      const data = await res.json();
      persistAndShow(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSession = async (batchId) => {
    setLoading(true);
    setError(null);
    try {
      if (results?.batch_id === batchId) {
        setActiveTab('dashboard');
        closeSidebarIfMobile();
        setLoading(false);
        return;
      }
      const r = await authFetch(`/api/session/${encodeURIComponent(batchId)}`);
      if (!r.ok) {
        try {
          const cached = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
          if (cached && cached.batch_id === batchId) {
            setResults(cached);
            setActiveTab('dashboard');
            closeSidebarIfMobile();
            return;
          }
        } catch {}
        throw new Error('Session not found — it may have been deleted. Run a new reconciliation.');
      }
      const data = await r.json();
      setResults(data);
      setActiveTab('dashboard');
      localStorage.setItem(LS_KEY, JSON.stringify(data));
      closeSidebarIfMobile();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleDeleteSession = async (batchId, e) => {
    if (e) e.stopPropagation();
    try {
      await authFetch(`/api/session/${encodeURIComponent(batchId)}`, { method: 'DELETE' });
      setSessions(prev => prev.filter(s => s.batch_id !== batchId));
      if (results?.batch_id === batchId) { setResults(null); localStorage.removeItem(LS_KEY); setActiveTab('ingest'); }
    } catch {}
  };

  const handleNewChat = () => {
    setResults(null);
    setFilesList([]);
    localStorage.removeItem(LS_KEY);
    setActiveTab('ingest');
    setError(null);
    closeSidebarIfMobile();
  };

  const handleDownload = async (type) => {
    try {
      const r = await authFetch(`/api/download/${type}`);
      if (!r.ok) throw new Error('Download failed');
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'markdown' ? 'recon_report.md' : type === 'csv' ? 'exceptions.csv' : type === 'json' ? 'recon_report.json' : 'audit_log.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  };

  const formatMoney = (val) => {
    if (val === undefined || val === null) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(val);
  };
  const formatHeadlineMoney = (val) => {
    if (val === undefined || val === null) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };
  const formatPercent = (val) => {
    if (val === undefined || val === null) return 'N/A';
    return `${(val * 100).toFixed(1)}%`;
  };
  const formatTime = (iso) => {
    try { const d = new Date(iso); return d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }); } catch { return iso; }
  };

  const filteredExceptions = (results?.exceptions || []).filter((item) => {
    const matchesFilter = exceptionFilter === 'ALL' || item.reason === exceptionFilter;
    const matchesSearch =
      exceptionSearch === '' ||
      item.record_id.toLowerCase().includes(exceptionSearch.toLowerCase()) ||
      (item.explanation && item.explanation.toLowerCase().includes(exceptionSearch.toLowerCase())) ||
      (item.best_candidate_id && item.best_candidate_id.toLowerCase().includes(exceptionSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const filteredClusters = (results?.matched_clusters || []).filter((c) => {
    if (!clusterSearch) return true;
    const q = clusterSearch.toLowerCase();
    return (
      c.group_id.toLowerCase().includes(q) ||
      c.method.toLowerCase().includes(q) ||
      c.members.some((m) => m.record_id.toLowerCase().includes(q) || (m.reference || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q))
    );
  });

  const getReasonBadge = (reason) => {
    const map = {
      POSSIBLE_DUPLICATE: { label: 'Double-Post Conflict', cls: 'bg-destructive/15 text-destructive border-destructive/30', dot: 'bg-destructive' },
      DUPLICATE_CANDIDATE: { label: 'Near-Tie Conflict', cls: 'bg-chart-2/15 text-chart-2 border-chart-2/30', dot: 'bg-chart-2' },
      LOW_CONFIDENCE: { label: 'Low Confidence', cls: 'bg-primary/15 text-primary border-primary/30', dot: 'bg-primary' },
      NO_COUNTERPART: { label: 'Unmatched Record', cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
      AMOUNT_MISMATCH: { label: 'Amount Variance', cls: 'bg-chart-3/15 text-chart-3 border-chart-3/30', dot: 'bg-chart-3' },
    };
    const t = map[reason] || { label: reason, cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
    return (
      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none font-mono', t.cls)}>
        <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} />
        {t.label}
      </span>
    );
  };

  const getMethodBadge = (method) => {
    const map = {
      exact: { label: 'Tier 1 · Exact', cls: 'bg-secondary/15 text-secondary border-secondary/30', dot: 'bg-secondary' },
      fuzzy: { label: 'Tier 2 · Fuzzy', cls: 'bg-chart-2/15 text-chart-2 border-chart-2/30', dot: 'bg-chart-2' },
      llm: { label: 'Tier 3 · AI Reasoner', cls: 'bg-primary/15 text-primary border-primary/30', dot: 'bg-primary' },
    };
    const t = map[method] || { label: method, cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
    return (
      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none font-mono', t.cls)}>
        <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} />
        {t.label}
      </span>
    );
  };

  const inputCls = field;
  const selectCls = cx(field, 'cursor-pointer');

  // --- Auth gate (ChatGPT-like: must log in to see own sessions) ---
  if (!authChecked) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background text-foreground">
        <MatchMindLogo />
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }
  if (!user || !token) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4 sm:p-6">
        <div className="pointer-events-none fixed inset-0 bg-aurora" />
        <div className="pointer-events-none fixed inset-0 bg-grid" />
        <div className="relative w-full max-w-[420px] rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <MatchMindLogo className="h-10" showWordmark={true} />
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">Sign in to access your private reconciliation workspace</p>
          </div>
          <div className="mt-7 flex rounded-xl border border-border bg-muted p-1">
            <button type="button" onClick={() => setAuthMode('login')} className={cx('flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all duration-200', authMode==='login' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Log in</button>
            <button type="button" onClick={() => setAuthMode('register')} className={cx('flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all duration-200', authMode==='register' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Create account</button>
          </div>
          <form onSubmit={handleAuth} className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Username</label>
              <input value={authUser} onChange={e=>setAuthUser(e.target.value)} placeholder="e.g. alice" className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring" required minLength={3} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">Password</label>
              <input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Min 8 chars, letter + number + special" className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring" required minLength={8} />
              {authMode === 'register' && (
                <div className="rounded-xl border border-border bg-muted/50 px-3.5 py-2.5">
                  <p className="text-[11px] font-semibold text-muted-foreground">Password must contain:</p>
                  <ul className="mt-1.5 space-y-1 text-[11px]">
                    <li className={authPass.length >= 8 ? "text-secondary" : "text-muted-foreground"}>• 8–128 characters {authPass.length >= 8 ? "✓" : ""}</li>
                    <li className={/[A-Za-z]/.test(authPass) ? "text-secondary" : "text-muted-foreground"}>• at least one letter {/[A-Za-z]/.test(authPass) ? "✓" : ""}</li>
                    <li className={/[0-9]/.test(authPass) ? "text-secondary" : "text-muted-foreground"}>• at least one number {/[0-9]/.test(authPass) ? "✓" : ""}</li>
                    <li className={/[^A-Za-z0-9]/.test(authPass) ? "text-secondary" : "text-muted-foreground"}>• at least one special (!@#$%) {/[^A-Za-z0-9]/.test(authPass) ? "✓" : ""}</li>
                  </ul>
                </div>
              )}
            </div>
            {authError && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs leading-relaxed text-destructive">{authError}</div>}
            <button type="submit" disabled={authLoading} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90 disabled:opacity-50">
              {authLoading ? 'Please wait…' : authMode==='register' ? 'Create account & log in' : 'Log in'}
            </button>
          </form>
          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">Demo: create any username/password — stored locally in <span className="font-mono">reports/users.json</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh overflow-hidden bg-background text-foreground font-mono">
      <div className="pointer-events-none fixed inset-0 bg-aurora" />
      <div className="pointer-events-none fixed inset-0 bg-grid" />

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      {/* Sidebar - session history */}
      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-30 flex w-[280px] flex-col overflow-hidden border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl transition-transform duration-300 ease-out',
          'lg:static lg:z-20 lg:transition-[width] lg:duration-300',
          sidebarOpen ? 'translate-x-0 lg:w-[280px]' : '-translate-x-full lg:w-0 lg:translate-x-0 lg:border-r-0'
        )}
      >
        <div className="flex h-full w-[280px] min-w-[280px] flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <History className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-foreground">Sessions</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{sessions.length}</span>
          </div>
          <button type="button" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} className={cx(btnGhost, 'h-8 w-8 p-0')}><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3">
          <button type="button" onClick={handleNewChat} className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2.5 text-xs font-semibold text-primary transition-all duration-200 hover:bg-primary hover:text-primary-foreground">
            <Plus className="h-4 w-4" /> New reconciliation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sessions.length === 0 && (
            <EmptyState
              icon={MessageSquare}
              title="No sessions yet"
              subtitle="Run a reconciliation to inspect, restore, and review past runs here."
            />
          )}
          <div className="space-y-2">
            {sessions.map(s => {
              const isActive = results?.batch_id === s.batch_id;
              return (
                <button key={s.batch_id} type="button" onClick={() => handleLoadSession(s.batch_id)} className={cx('group relative flex w-full flex-col rounded-xl border px-3 py-3 text-left transition-all duration-200', isActive ? 'border-primary/60 bg-primary/10 text-foreground shadow-sm' : 'border-border bg-card hover:border-primary/40 hover:bg-accent')}>
                  {isActive && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-primary" />}
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={cx('truncate font-mono text-xs font-bold', isActive ? 'text-primary' : 'text-foreground')}>{s.batch_id}</span>
                    <span
                      role="button"
                      tabIndex={0}
                      aria-label="Delete session"
                      onClick={(e) => handleDeleteSession(s.batch_id, e)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDeleteSession(s.batch_id, e); }}
                      className="hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive group-hover:flex"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" /><span className="truncate">{formatTime(s.saved_at)}</span><span>·</span><span className="shrink-0">{s.total_records} rec</span>
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-semibold text-secondary">{s.metrics?.matched_records || 0} matched</span>
                    {s.metrics?.f1 != null && <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">F1 {(s.metrics.f1*100).toFixed(0)}%</span>}
                    {s.metrics?.exceptions != null && <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">{s.metrics.exceptions} exc</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground">{user?.[0]?.toUpperCase()}</div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-foreground">{user}</p>
                <p className="text-[11px] text-muted-foreground">Private workspace</p>
              </div>
            </div>
            <button type="button" onClick={handleLogout} title="Log out" className={cx(btnDanger, 'h-8 px-2.5 text-[11px]')}>Log out</button>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3 w-3 shrink-0 text-secondary" /> {user}'s sessions — isolated per account</p>
        </div>
        </div>
      </aside>

      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              {!sidebarOpen && (
                <button
                  type="button"
                  aria-label="Open sessions"
                  onClick={() => setSidebarOpen(true)}
                  className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-200 hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md"
                >
                  <Menu className="h-4 w-4" />
                  {sessions.length > 0 && (
                    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold tabular-nums text-primary-foreground">
                      {sessions.length}
                    </span>
                  )}
                </button>
              )}
              <div className="min-w-0">
                <MatchMindLogo />
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              {!sidebarOpen && (
                <div className="hidden items-center gap-2 rounded-full border border-border bg-card py-1 pl-1 pr-1.5 sm:flex">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">{user?.[0]?.toUpperCase()}</div>
                  <span className="pr-1 text-xs font-semibold text-foreground">{user}</span>
                  <button type="button" onClick={handleLogout} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground transition-all duration-200 hover:bg-destructive hover:text-foreground">Log out</button>
                </div>
              )}
              <button
                type="button"
                onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-sm cursor-pointer"
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-chart-2" /> : <Moon className="h-4 w-4 text-primary" />}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ingest')}
                className={cx(
                  'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all duration-200 focus-ring sm:px-4',
                  activeTab === 'ingest'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'border border-border bg-card text-muted-foreground hover:border-primary hover:bg-primary hover:text-primary-foreground hover:shadow-md'
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Upload files</span>
                <span className="sm:hidden">Upload</span>
              </button>
              {results && (
                <button
                  type="button"
                  onClick={() => setActiveTab('dashboard')}
                  className={cx(
                    'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all duration-200 focus-ring sm:px-3.5',
                    activeTab === 'dashboard'
                      ? 'bg-secondary text-secondary-foreground shadow-sm'
                      : 'border border-border bg-card text-muted-foreground hover:border-secondary hover:bg-secondary hover:text-secondary-foreground hover:shadow-md'
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </button>
              )}
            </div>
          </div>

          <nav className="scrollbar-none -mx-1 flex items-center gap-1.5 overflow-x-auto border-t border-border py-2 sm:gap-2">
            {[
              { id: 'ingest', label: 'Ingest', sub: '1', icon: Database },
              { id: 'dashboard', label: 'Dashboard', sub: '2', icon: Activity, disabled: !results },
              { id: 'exceptions', label: `Exceptions ${results ? `· ${results.exceptions.length}` : ''}`, sub: '3', icon: FileWarning, disabled: !results },
              { id: 'clusters', label: `Reconciled ${results ? `· ${results.matched_clusters.length}` : ''}`, sub: '4', icon: CheckCircle2, disabled: !results },
              { id: 'audit', label: 'Audit', sub: '5', icon: FileText, disabled: !results },
              { id: 'export', label: 'Export', sub: '6', icon: Download, disabled: !results },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={cx(
                    'group flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-semibold transition-all duration-200 sm:px-3.5',
                    tab.disabled
                      ? 'cursor-not-allowed text-muted-foreground/30'
                      : isActive
                        ? 'border border-primary/50 bg-card text-primary shadow-sm'
                        : 'border border-transparent text-muted-foreground hover:border-border hover:bg-card hover:text-foreground'
                  )}
                >
                  <span className={cx('flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold transition-colors', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground')}>
                    {tab.sub}
                  </span>
                  <Icon className={cx('hidden h-3.5 w-3.5 transition-colors sm:block', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error && (
          <div className="animate-fade-in flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-wide text-destructive">Reconciliation error</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/80">{error}</p>
            </div>
            <button type="button" aria-label="Dismiss error" onClick={() => setError(null)} className={cx(btnGhost, 'h-8 w-8 shrink-0 p-0')}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="glass animate-fade-in flex flex-col items-center justify-center gap-4 rounded-2xl px-6 py-12 text-center sm:px-8">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-secondary" style={{ animationDuration: '0.8s' }} />
              <div className="absolute inset-2 rounded-full bg-primary/10 blur-[1px]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Reconciling financial records…</h3>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">Normalizing schemas, finding candidate pairs, executing multi-tier matching rules, and evaluating AI evidence.</p>
            </div>
            <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/5 rounded-full bg-primary animate-[indeterminate_1.2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {activeTab === 'ingest' && (
          <div className={cx('animate-fade-up space-y-6', loading && 'pointer-events-none opacity-40')}>
            {results && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">Active Session: {results.batch_id}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{results.total_records} records · {formatPercent(results.metrics.raw_match_rate)} matched</p>
                  </div>
                </div>
                <button type="button" onClick={() => setActiveTab('dashboard')} className={cx(btnPrimary, 'h-8 shrink-0 px-3.5 text-xs font-bold')}>View dashboard →</button>
              </div>
            )}
            <div className={cx(surface, 'p-5 sm:p-8')}>
              <div className="max-w-3xl">
                <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  Reconcile Financial Records
                </h2>
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Upload CSV statements from your bank, general ledger, or billing system to automatically match transactions, identify discrepancies, and balance your books.
                </p>
              </div>

              <form onSubmit={handleCustomReconcile} className="relative mt-8 space-y-6">
                {/* Primary Drag & Drop Zone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                  }}
                  className={cx(
                    'relative flex min-h-[240px] flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-all duration-200 sm:px-8 sm:py-10',
                    isDragging
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary shadow-sm ring-1 ring-primary/30">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <h3 className="mt-5 text-base font-bold text-foreground">
                    Drag &amp; drop CSV files here
                  </h3>
                  <p className="mt-2 max-w-md text-xs leading-relaxed text-muted-foreground">
                    Upload multiple bank statements, ledger journals, invoice exports, and processor feeds (1 to 50+ files supported).
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    <input
                      type="file"
                      id="bulk-csv-upload"
                      accept=".csv,text/csv"
                      multiple
                      onChange={(e) => {
                        if (e.target.files?.length) addFiles(e.target.files);
                        e.target.value = '';
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="bulk-csv-upload"
                      className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground shadow-sm transition-opacity duration-200 hover:opacity-90"
                    >
                      <FileUp className="h-4 w-4" /> Browse CSV Files
                    </label>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="mt-7 flex flex-wrap items-center justify-center gap-2 border-t border-border/60 pt-5 text-xs">
                    <span className="mr-1 text-[11px] font-semibold text-muted-foreground">Quick add:</span>
                    {CATEGORIES.map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <label
                          key={cat.id}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-semibold text-foreground transition-all duration-200 hover:border-primary/50 hover:text-primary"
                        >
                          <input
                            type="file"
                            accept=".csv,text/csv"
                            multiple
                            onChange={(e) => {
                              if (e.target.files?.length) addFiles(e.target.files, cat.id);
                              e.target.value = '';
                            }}
                            className="hidden"
                          />
                          <CatIcon className="h-3.5 w-3.5 text-primary" />
                          <span>+ {cat.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Attached Files List */}
                {filesList.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span className="text-sm font-bold text-foreground">Attached Statements &amp; Ledgers</span>
                        <span className="rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-xs font-bold tabular-nums text-primary">
                          {filesList.length} {filesList.length === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFilesList([])}
                        className="text-xs font-semibold text-muted-foreground transition-colors duration-200 hover:text-destructive"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {filesList.map((item) => {
                        const currentCat = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[0];
                        const Icon = currentCat.icon;
                        const isBalanceAccount = item.category === 'bank' || item.category === 'ledger' || item.category === 'gateway';

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-xl border border-border bg-muted/25 p-3.5 shadow-sm transition-all duration-200 hover:border-primary/30 sm:flex-row sm:items-center sm:justify-between sm:p-4"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={item.label}
                                    onChange={(e) => updateFileItem(item.id, 'label', e.target.value)}
                                    placeholder="Account or Feed Name"
                                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-bold text-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring sm:flex-none"
                                  />
                                  <select
                                    value={item.category}
                                    onChange={(e) => updateFileItem(item.id, 'category', e.target.value)}
                                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground outline-none transition-colors duration-200 focus:border-primary focus:bg-background"
                                  >
                                    {CATEGORIES.map((c) => (
                                      <option key={c.id} value={c.id} className="bg-card text-foreground">
                                        {c.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <p className="mt-1.5 truncate text-[11px] text-muted-foreground">
                                  {item.name} · {formatBytes(item.size)}
                                </p>
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
                              {isBalanceAccount ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-muted-foreground">Opening:</span>
                                  <div className="relative w-32">
                                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={item.openingBalance}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        if (v === '' || v === '-' || v === '.' || /^-?\d*\.?\d*$/.test(v)) {
                                          updateFileItem(item.id, 'openingBalance', v);
                                        }
                                      }}
                                      onFocus={(e) => e.target.select()}
                                      onBlur={() => {
                                        if (item.openingBalance === '' || item.openingBalance === '-' || item.openingBalance === '.') {
                                          updateFileItem(item.id, 'openingBalance', '0.00');
                                        }
                                      }}
                                      className="w-full rounded-lg border border-input bg-card py-1.5 pl-6 pr-2.5 font-mono text-xs font-semibold tabular-nums text-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring"
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="px-2 text-[11px] italic text-muted-foreground">No opening balance</div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeFile(item.id)}
                                title="Remove file"
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-all duration-200 hover:border-destructive hover:bg-destructive hover:text-foreground"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleRunSampleData}
                    disabled={loading}
                    className="inline-flex h-10 items-center justify-center gap-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:text-primary disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    ) : (
                      <Database className="h-3.5 w-3.5" />
                    )}
                    <span>{loading ? 'Reconciling sample data…' : 'Or run with benchmark sample data'}</span>
                  </button>
                  <button
                    type="submit"
                    disabled={loading || filesList.length === 0}
                    className={cx(
                      'inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition-all duration-200 focus-ring',
                      filesList.length === 0 || loading
                        ? 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground shadow-md hover:opacity-90'
                    )}
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        <span>Reconciling records…</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 fill-current" />
                        <span>Run autonomous reconciliation {filesList.length > 0 ? `(${filesList.length} files)` : ''}</span>
                        <ArrowRight className="h-4 w-4 opacity-70" />
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && results && (
          <div className="animate-fade-up space-y-6">
            {/* Status Strip */}
            {results.agent_trace && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                    <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary"></span>
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">
                      Autonomous Pipeline Complete · <span className="font-semibold text-secondary">{results.agent_status === 'complete' ? 'Reconciliation Verified' : results.agent_status}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {results.metrics?.matched_records || 0} of {results.total_records} records reconciled across 3 sources · {results.exceptions?.length || 0} exceptions cataloged
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setActiveTab('exceptions')} className={cx(btnMuted, 'h-8 px-3 text-xs')}>
                    View Exceptions ({results.exceptions?.length || 0}) →
                  </button>
                  <button type="button" onClick={() => setActiveTab('clusters')} className={cx(btnPrimary, 'h-8 px-3 text-xs')}>
                    View Reconciled Clusters →
                  </button>
                </div>
              </div>
            )}

            {/* Pending Approvals (if any) */}
            {results.pending_approvals && results.pending_approvals.length > 0 && (
              <div className="rounded-2xl border border-chart-2/30 bg-chart-2/5 p-5">
                <h4 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <ShieldAlert className="h-4 w-4 text-chart-2" /> Approvals Required — Review Pending Actions
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">Adjustments and high-value transactions require human sign-off before finalizing.</p>
                <div className="mt-4 space-y-2.5">
                  {results.pending_approvals.map(apr => (
                    <div key={apr.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-bold text-foreground">{apr.action} · <span className="text-chart-2">{apr.status}</span></p>
                          <p className="mt-1 text-xs text-muted-foreground">{apr.reason}</p>
                          {apr.amount ? <p className="mt-1 font-mono text-xs font-bold text-foreground">Amount: {formatMoney(apr.amount)}</p> : null}
                          {apr.evidence?.length ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">Evidence: {apr.evidence.join(', ')}</p> : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button type="button" onClick={async()=>{
                            const r = await authFetch(`/api/approve/${encodeURIComponent(results.batch_id)}/${encodeURIComponent(apr.id)}`,{method:'POST'});
                            if(r.ok){ setError(null); fetchSessions(); } else { const e=await r.json(); setError(e.detail); }
                          }} className={cx(btnSecondary, 'h-8 px-3 text-xs font-bold')}>Approve</button>
                          <button type="button" onClick={async()=>{
                            const r = await authFetch(`/api/reject/${encodeURIComponent(results.batch_id)}/${encodeURIComponent(apr.id)}`,{method:'POST'});
                            if(r.ok){ fetchSessions(); } else { const e=await r.json(); setError(e.detail); }
                          }} className={cx(btnDanger, 'h-8 px-3 text-xs font-bold')}>Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4 Hero KPI Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Match Rate"
                icon={CheckCircle2}
                value={
                  results.metrics.has_ground_truth
                    ? formatPercent(results.metrics.validated_match_rate)
                    : formatPercent(results.metrics.raw_match_rate)
                }
                badge={
                  results.metrics.has_ground_truth ? (
                    <span className="rounded-full border border-secondary/30 bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
                      Validated
                    </span>
                  ) : null
                }
                sub={
                  results.metrics.has_ground_truth
                    ? `Raw: ${formatPercent(results.metrics.raw_match_rate)} · ${results.metrics.matched_records}/${results.total_records} records`
                    : `${results.metrics.matched_records} of ${results.total_records} records reconciled`
                }
              />
              <StatCard
                label="Accuracy · F1 Score"
                icon={TrendingUp}
                value={results.metrics.f1 !== null ? formatPercent(results.metrics.f1) : 'N/A'}
                badge={
                  results.metrics.precision !== null ? (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Recall {formatPercent(results.metrics.recall)}
                    </span>
                  ) : null
                }
                sub={`Precision: ${results.metrics.precision !== null ? formatPercent(results.metrics.precision) : 'N/A'}`}
              />
              <StatCard
                label="Exception Exposure"
                icon={AlertCircle}
                value={formatHeadlineMoney(results.cash_position.exception_exposure_total)}
                badge={
                  results.exceptions.length > 0 ? (
                    <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                      Action Required
                    </span>
                  ) : null
                }
                sub={`${results.exceptions.length} unresolved · flagged for review`}
              />
              <StatCard
                label="Reconciled Variance"
                icon={DollarSign}
                value={formatHeadlineMoney(results.cash_position.reconciled_difference)}
                sub="Bank cash vs. ledger delta"
              />
            </div>

            {/* Cash Position Snapshot & Resolution Distribution */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className={cx(surface, 'p-5 sm:p-6 lg:col-span-2')}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
                      <DollarSign className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Cash-Position Snapshot</h3>
                      <p className="text-xs text-muted-foreground">Live bank vs. general ledger liquidity</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-secondary/30 bg-secondary/15 px-3 py-0.5 text-xs font-bold text-secondary">
                    Reconciled
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 dark:text-slate-200">Confirmed Bank Cash</span>
                    <p className="mt-2 text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.confirmed_bank_cash)}</p>
                    <div className="mt-3.5 space-y-1.5 border-t border-border/80 pt-2.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Opening Balance</span>
                        <span className="font-mono font-semibold tabular-nums text-foreground">{formatMoney(results.cash_position.bank_opening)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Matched Movements</span>
                        <span className="font-mono font-semibold tabular-nums text-secondary">+{formatMoney(results.cash_position.matched_bank_movements)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/80 dark:text-slate-200">Confirmed Ledger Cash</span>
                    <p className="mt-2 text-2xl font-bold font-mono tracking-tight tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.confirmed_ledger_cash)}</p>
                    <div className="mt-3.5 space-y-1.5 border-t border-border/80 pt-2.5 text-xs">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Opening Balance</span>
                        <span className="font-mono font-semibold tabular-nums text-foreground">{formatMoney(results.cash_position.ledger_opening)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Matched Movements</span>
                        <span className="font-mono font-semibold tabular-nums text-secondary">+{formatMoney(results.cash_position.matched_ledger_movements)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2 rounded-xl border border-border bg-muted/50 px-4 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-semibold text-foreground">Exposure by Source:</span>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                    <span className="text-muted-foreground">Bank <strong className="font-mono font-semibold tabular-nums text-foreground">{formatMoney(results.cash_position.exception_exposure_by_source?.bank || 0)}</strong></span>
                    <span className="text-muted-foreground">Ledger <strong className="font-mono font-semibold tabular-nums text-foreground">{formatMoney(results.cash_position.exception_exposure_by_source?.ledger || 0)}</strong></span>
                    <span className="text-muted-foreground">Invoices <strong className="font-mono font-semibold tabular-nums text-foreground">{formatMoney(results.cash_position.exception_exposure_by_source?.invoice || 0)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Resolution Breakdown */}
              <div className={cx(surface, 'flex flex-col justify-between p-5 sm:p-6')}>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Resolution Breakdown</h3>
                  <p className="text-xs text-muted-foreground">Distribution across matching tiers</p>

                  <div className="mt-5 space-y-4">
                    {[
                      { label: 'Tier 1 · Exact & Roundoff', value: results.metrics.method_counts.exact, color: 'bg-secondary', text: 'text-secondary' },
                      { label: 'Tier 2 · Fuzzy Match', value: results.metrics.method_counts.fuzzy, color: 'bg-chart-2', text: 'text-chart-2' },
                      { label: 'Tier 3 · AI Reasoner', value: results.metrics.method_counts.llm, color: 'bg-primary', text: 'text-primary' },
                      { label: 'Exceptions Queue', value: results.exceptions.length, color: 'bg-destructive', text: 'text-destructive' },
                    ].map((r) => {
                      const pct = results.total_records ? (r.value / results.total_records) * 100 : 0;
                      return (
                        <div key={r.label}>
                          <div className="mb-1.5 flex justify-between text-xs font-semibold">
                            <span className={r.text}>{r.label}</span>
                            <span className="font-mono tabular-nums text-foreground">{r.value}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className={cx('h-full rounded-full transition-all duration-700', r.color)} style={{ width: `${Math.max(pct, r.value ? 3 : 0)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs">
                  <span className="font-medium text-muted-foreground">{results.total_records} Total Records Audited</span>
                  <button type="button" onClick={() => setActiveTab('exceptions')} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                    View exceptions ({results.exceptions?.length || 0}) <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* 30 / 60 / 90-Day Forward Cash Runway Forecaster */}
            {results.cash_position?.forward_cash_forecast && (
              <div className={cx(surface, "p-5 sm:p-6 space-y-5")}>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-chart-1/15 text-chart-1 ring-1 ring-chart-1/30">
                      <TrendingUp className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">30 / 60 / 90-Day Forward Cash Runway Forecaster</h3>
                      <p className="text-xs text-muted-foreground">Reconciled liquidity + open receivables (AR) & payables (AP) aging model</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-secondary/30 bg-secondary/15 px-3 py-1 text-xs font-bold text-secondary">
                      Runway: {results.cash_position.forward_cash_forecast.runway_status}
                    </span>
                    <span className={cx(
                      "rounded-full border px-3 py-1 text-xs font-bold",
                      results.cash_position.forward_cash_forecast.net_monthly_delta >= 0
                        ? "border-chart-1/30 bg-chart-1/15 text-chart-1"
                        : "border-border bg-muted text-foreground/80"
                    )}>
                      {results.cash_position.forward_cash_forecast.net_monthly_delta >= 0 ? "+" : ""}
                      {formatHeadlineMoney(results.cash_position.forward_cash_forecast.net_monthly_delta)} / mo
                    </span>
                  </div>
                </div>

                {/* SVG Visual Runway Trend Chart */}
                <RunwayForecasterChart
                  timeline={results.cash_position.forward_cash_forecast.timeline}
                  formatHeadlineMoney={formatHeadlineMoney}
                />

                {/* 4 Trajectory Milestone Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {results.cash_position.forward_cash_forecast.timeline.map((pt, i) => (
                    <div key={i} className="relative overflow-hidden rounded-xl border border-border bg-muted/30 p-4 transition-all duration-150 hover:bg-muted/45">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-bold uppercase tracking-wider text-foreground/80 dark:text-slate-200">{pt.label}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold">T+{pt.days}d</span>
                      </div>
                      <p className="mt-2.5 font-mono text-xl font-bold tracking-tight tabular-nums text-foreground">{formatHeadlineMoney(pt.cash)}</p>
                      
                      {pt.days === 0 ? (
                        <div className="mt-3 space-y-1.5 border-t border-border/80 pt-2 text-xs">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Expected Inflows</span>
                            <span className="font-mono text-muted-foreground/80">— (Baseline)</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Expected Outflows</span>
                            <span className="font-mono text-muted-foreground/80">— (Baseline)</span>
                          </div>
                          <div className="border-t border-border/40 pt-1.5">
                            <p className="text-[11px] font-medium text-secondary">
                              Reconciled starting cash baseline
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              No forward movements due today
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 space-y-1 border-t border-border/80 pt-2 text-xs">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Expected Inflows</span>
                            <span className="font-mono font-semibold tabular-nums text-secondary">+{formatMoney(pt.inflows)}</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Expected Outflows</span>
                            <span className="font-mono font-semibold tabular-nums text-foreground/80">-{formatMoney(pt.outflows)}</span>
                          </div>
                          <div className="flex justify-between font-bold border-t border-border/40 pt-1">
                            <span className="text-muted-foreground">Net Delta</span>
                            <span className={cx("font-mono tabular-nums", pt.net >= 0 ? "text-secondary" : "text-foreground")}>
                              {pt.net >= 0 ? `+${formatMoney(pt.net)}` : formatMoney(pt.net)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Aging Pipeline Breakdown */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <span className="text-xs font-bold text-foreground/90">Receivables Pipeline (AR)</span>
                      <span className="font-mono text-xs font-bold text-secondary">
                        {formatHeadlineMoney(results.cash_position.forward_cash_forecast.total_receivables_pipeline)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-muted/50 p-2.5 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">0-30 Days</p>
                        <p className="mt-1 font-mono font-bold tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.forward_cash_forecast.receivables_aging.d0_30)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">31-60 Days</p>
                        <p className="mt-1 font-mono font-bold tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.forward_cash_forecast.receivables_aging.d31_60)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">61-90+ Days</p>
                        <p className="mt-1 font-mono font-bold tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.forward_cash_forecast.receivables_aging.d61_90 + results.cash_position.forward_cash_forecast.receivables_aging.d90_plus)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between border-b border-border pb-2.5">
                      <span className="text-xs font-bold text-foreground/90">Payables Pipeline (AP)</span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {formatHeadlineMoney(results.cash_position.forward_cash_forecast.total_payables_pipeline)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-lg bg-muted/50 p-2.5 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">0-30 Days</p>
                        <p className="mt-1 font-mono font-bold tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.forward_cash_forecast.payables_aging.d0_30)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">31-60 Days</p>
                        <p className="mt-1 font-mono font-bold tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.forward_cash_forecast.payables_aging.d31_60)}</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 p-2.5 border border-border/60">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground">61-90+ Days</p>
                        <p className="mt-1 font-mono font-bold tabular-nums text-foreground">{formatHeadlineMoney(results.cash_position.forward_cash_forecast.payables_aging.d61_90 + results.cash_position.forward_cash_forecast.payables_aging.d90_plus)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {activeTab === 'exceptions' && results && (
          <div className={cx(surface, 'animate-fade-up space-y-6 p-5 sm:p-6')}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-foreground">Exception Triage</h3>
                  <span className="rounded-full border border-destructive/30 bg-destructive/10 px-2.5 py-0.5 text-xs font-bold text-destructive">
                    {results.exceptions?.length || 0} {results.exceptions?.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
                  Every unresolved transaction cataloged with root cause and the next best candidate — nothing falls through the cracks.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search ID, explanation…"
                    value={exceptionSearch}
                    onChange={(e) => setExceptionSearch(e.target.value)}
                    className="w-48 rounded-xl border border-input bg-card py-2 pl-8 pr-3 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring sm:w-56"
                  />
                </div>
                <select
                  value={exceptionFilter}
                  onChange={(e) => setExceptionFilter(e.target.value)}
                  className="rounded-xl border border-input bg-card px-3 py-2 text-xs font-mono font-medium text-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring cursor-pointer"
                >
                  <option value="ALL" className="bg-card text-foreground">All Categories ({results.exceptions?.length || 0})</option>
                  <option value="POSSIBLE_DUPLICATE" className="bg-card text-foreground">Double-Post Conflict</option>
                  <option value="DUPLICATE_CANDIDATE" className="bg-card text-foreground">Near-Tie Conflict</option>
                  <option value="LOW_CONFIDENCE" className="bg-card text-foreground">Low Confidence</option>
                  <option value="NO_COUNTERPART" className="bg-card text-foreground">Unmatched Record</option>
                  <option value="AMOUNT_MISMATCH" className="bg-card text-foreground">Amount Variance</option>
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] border-collapse text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-4 py-3.5">Record ID</th>
                      <th className="px-3 py-3.5">Source</th>
                      <th className="px-4 py-3.5">Diagnosis</th>
                      <th className="px-4 py-3.5">Best Candidate</th>
                      <th className="px-3 py-3.5">Confidence</th>
                      <th className="px-4 py-3.5">Explanation</th>
                      <th className="px-4 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredExceptions.map((item, idx) => (
                      <tr key={idx} className="transition-colors duration-150 hover:bg-muted/30">
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-foreground whitespace-nowrap">{item.record_id}</td>
                        <td className="px-3 py-3.5 capitalize text-foreground whitespace-nowrap">{item.source}</td>
                        <td className="px-4 py-3.5 whitespace-nowrap">{getReasonBadge(item.reason)}</td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                          {item.best_candidate_id ? `${item.best_candidate_id} · ${item.best_candidate_source}` : '—'}
                        </td>
                        <td className="px-3 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                              <div
                                className={cx(
                                  'h-full rounded-full transition-all duration-500',
                                  item.confidence > 0.8 ? 'bg-secondary' : item.confidence > 0.5 ? 'bg-chart-2' : 'bg-destructive'
                                )}
                                style={{ width: `${(item.confidence * 100).toFixed(0)}%` }}
                              />
                            </div>
                            <span className="font-semibold tabular-nums text-foreground">{(item.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="max-w-[340px] px-4 py-3.5 leading-relaxed text-foreground/90">{item.explanation}</td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                            {item.recommended_action}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredExceptions.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-8">
                          <EmptyState
                            icon={FileWarning}
                            title="No exceptions match your filters"
                            subtitle="Try selecting a different diagnosis category or clearing your search keywords."
                          />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clusters' && results && (
          <div className={cx(surface, 'animate-fade-up space-y-6 p-5 sm:p-6')}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-foreground">Reconciled Groups</h3>
                  <span className="rounded-full border border-secondary/30 bg-secondary/10 px-2.5 py-0.5 text-xs font-bold text-secondary">
                    {results.matched_clusters?.length || 0} {results.matched_clusters?.length === 1 ? 'cluster' : 'clusters'}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Linked transaction clusters matched across bank feeds, general ledger journals, and billing records.
                </p>
              </div>
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search group, ID or reference…"
                  value={clusterSearch}
                  onChange={(e) => setClusterSearch(e.target.value)}
                  className="w-full rounded-xl border border-input bg-card py-2 pl-8 pr-3 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring sm:w-64"
                />
              </div>
            </div>

            <div className="space-y-3.5">
              {filteredClusters.map((cluster, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-border bg-muted/30 p-4 transition-all duration-200 hover:border-primary/40 hover:bg-muted/50 hover:shadow-sm sm:p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-foreground">{cluster.group_id}</span>
                      {getMethodBadge(cluster.method)}
                    </div>
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-semibold text-foreground">
                      {cluster.count} records linked
                    </span>
                  </div>
                  <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {cluster.members.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="flex flex-col justify-between rounded-xl border border-border bg-card p-3.5 transition-colors duration-150 hover:border-border/80"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-foreground truncate">{m.record_id}</span>
                            <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              {m.source}
                            </span>
                          </div>
                          <p className="mt-1.5 truncate text-[11px] leading-relaxed text-muted-foreground">
                            {m.description || m.counterparty || 'No description'}
                          </p>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2 text-xs">
                          <span className="font-mono text-[11px] text-muted-foreground">{m.date}</span>
                          <span className={cx('font-bold tabular-nums', m.amount >= 0 ? 'text-foreground' : 'text-foreground')}>
                            {formatMoney(m.amount)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredClusters.length === 0 && (
                <EmptyState
                  icon={CheckCircle2}
                  title="No reconciled groups match your search"
                  subtitle="Try searching with a different transaction ID, counterparty, or reference number."
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'audit' && results && (
          <div className={cx(surface, 'animate-fade-up space-y-5 p-5 sm:p-6')}>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-foreground">Audit Trail</h3>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-bold text-primary">
                    {results.audit_trail?.length || 0} events
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Every stage, policy check, and matching decision — fully traceable for compliance and audit teams.
                </p>
              </div>
            </div>
            <div className="max-h-[30rem] space-y-2.5 overflow-y-auto rounded-xl border border-border bg-background p-3.5 font-mono text-[11px]">
              {(results.audit_trail || []).map((entry, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-card p-3.5 shadow-sm">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono tabular-nums text-muted-foreground">{entry.ts}</span>
                    <span className="rounded-md border border-primary/30 bg-primary/15 px-2 py-0.5 font-bold uppercase tracking-wider text-primary">
                      {entry.stage} · {entry.event}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all rounded-lg bg-muted/40 p-2.5 font-mono text-[11px] leading-relaxed text-foreground/90">
                    {JSON.stringify(entry.detail, null, 2)}
                  </pre>
                </div>
              ))}
              {(!results.audit_trail || results.audit_trail.length === 0) && (
                <EmptyState
                  icon={FileText}
                  title="No audit events recorded"
                  subtitle="Audit events will automatically populate as reconciliation steps execute."
                />
              )}
            </div>
          </div>
        )}

        {activeTab === 'export' && results && (
          <div className={cx(surface, 'animate-fade-up space-y-6 p-5 sm:p-6')}>
            <div>
              <h3 className="text-base font-bold text-foreground">Export &amp; Reporting</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Auditable packages for finance ops, audit compliance, or ERP system write-back.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { type: 'markdown', icon: FileText, title: 'Executive Report', desc: 'Markdown summary with liquidity & cash snapshot.', cta: 'Download .md' },
                { type: 'csv', icon: FileSpreadsheet, title: 'Exceptions CSV', desc: 'Unresolved transactions & triage spreadsheet.', cta: 'Download .csv' },
                { type: 'json', icon: FileCheck, title: 'ERP Payload', desc: 'Machine-readable JSON data for journal write-back.', cta: 'Download .json' },
                { type: 'audit', icon: ShieldCheck, title: 'Audit Trail', desc: 'Full verification, policy, and reasoning logs.', cta: 'Download log' },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => handleDownload(card.type)}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-muted/30 p-5 text-left transition-all duration-200 hover:border-primary/50 hover:bg-card hover:shadow-md active:scale-[0.99] cursor-pointer"
                  >
                    <div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-muted-foreground ring-1 ring-border transition-colors duration-200 group-hover:text-primary group-hover:ring-primary/40">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="mt-3.5 text-sm font-bold text-foreground">{card.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
                    </div>
                    <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-primary">
                      <span className="underline decoration-primary/30 underline-offset-4 group-hover:decoration-primary">{card.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-70 transition-transform duration-200 group-hover:translate-x-1" />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Active Session:</span>
              <span className="rounded-lg border border-border bg-card px-2 py-0.5 font-mono font-semibold text-foreground">{results.batch_id}</span>
              <span className="hidden sm:inline text-border">·</span>
              <span>{results.total_records} records · {results.metrics?.matched_records || 0} matched · {results.exceptions?.length || 0} exceptions</span>
            </div>
          </div>
        )}
      </main>

      <footer className="relative border-t border-border py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-center text-xs font-medium text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <MatchMindLogo className="h-5 w-auto" showWordmark={false} />
            <span>MatchMind · Autonomous Financial Controller</span>
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            Multi-source bank &amp; ledger reconciliation with policy-gated controls
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
}
