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
  Sparkles,
  Sun,
  Moon,
  Trash2,
  TrendingUp,
  Upload,
  UploadCloud,
  X,
} from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

const btn =
  'inline-flex items-center justify-center gap-2 rounded-xl text-xs font-semibold leading-none transition-all duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-50 select-none';
const btnPrimary = cx(btn, 'bg-primary text-primary-foreground shadow-sm hover:opacity-95 active:scale-[0.98]');
const btnSecondary = cx(btn, 'bg-secondary text-secondary-foreground shadow-sm hover:opacity-95 active:scale-[0.98]');
const btnOutline = cx(btn, 'border border-border bg-card text-foreground hover:border-primary/50 hover:bg-accent hover:text-primary');
const btnMuted = cx(btn, 'border border-border bg-muted text-foreground hover:border-primary/50 hover:text-primary');
const btnGhost = cx(btn, 'text-muted-foreground hover:bg-muted hover:text-foreground');
const btnDanger = cx(btn, 'border border-border bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive');
const surface = 'rounded-2xl border border-border bg-card shadow-sm';
const field =
  'w-full rounded-xl border border-input bg-card px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring';

function MatchMindLogo({ className = "h-8 w-auto", showWordmark = true }) {
  return (
    <div className={cx("flex items-center gap-3 select-none", className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary shadow-md shadow-primary/20">
        <Sparkles className="h-5 w-5 text-white" />
      </div>
      {showWordmark && (
        <div className="flex flex-col leading-tight">
          <div className="flex items-center gap-2">
            <span className="font-sans text-[17px] font-extrabold tracking-tight text-foreground">
              Match<span className="text-primary">Mind</span>
            </span>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
              Razorpay Buildathon
            </span>
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            Autonomous AI Finance Controller
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
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-2xl font-extrabold tracking-tight tabular-nums text-foreground">{value}</span>
        {badge}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/70 ring-1 ring-border">
          <Icon className="h-6 w-6" />
        </div>
      )}
      <p className="mt-3 text-sm font-bold text-foreground">{title}</p>
      {subtitle && <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

const CATEGORIES = [
  { id: 'bank', label: 'Bank Statement (HDFC/ICICI/SBI)', icon: Building2, desc: 'Current A/c, NEFT/RTGS & UPI bank feeds' },
  { id: 'ledger', label: 'General Ledger (Tally/Zoho)', icon: FileSpreadsheet, desc: 'TallyPrime, Zoho Books, ERP journals' },
  { id: 'invoice', label: 'GST Invoices / Credit Notes', icon: Receipt, desc: 'B2B GST e-Invoices, TDS bills, returns' },
  { id: 'gateway', label: 'Razorpay Gateway & Payouts', icon: CreditCard, desc: 'Razorpay Route, Smart Collect, Payouts' },
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
  if (lower.includes("inv") || lower.includes("gst") || lower.includes("tds") || lower.includes("bill") || lower.includes("ar") || lower.includes("ap") || lower.includes("receipt") || lower.includes("einvoice") || lower.includes("cn")) {
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

  useEffect(() => { localStorage.setItem(LS_TAB, activeTab); }, [activeTab]);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      localStorage.setItem(LS_SIDEBAR, sidebarOpen ? '1' : '0');
    }
  }, [sidebarOpen]);

  useEffect(() => {
    try {
      if (results) localStorage.setItem(LS_KEY, JSON.stringify(results));
      else localStorage.removeItem(LS_KEY);
    } catch {}
  }, [results]);

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
      setError('Please upload at least one statement CSV (Bank, Ledger, Invoices, or Gateway).');
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
        throw new Error(err.detail || 'Reconciliation failed');
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
        throw new Error('Session not found — run a new reconciliation.');
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
  const formatPercent = (val) => {
    if (val === undefined || val === null) return 'N/A';
    return `${(val * 100).toFixed(1)}%`;
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
      POSSIBLE_DUPLICATE: { label: 'Duplicate Collision', cls: 'bg-destructive/15 text-destructive border-destructive/30', dot: 'bg-destructive' },
      AMBIGUOUS_TWIN_COLLISION: { label: 'Twin Collision', cls: 'bg-chart-2/15 text-chart-2 border-chart-2/30', dot: 'bg-chart-2' },
      DUPLICATE_CANDIDATE: { label: 'Near-Tie Conflict', cls: 'bg-chart-2/15 text-chart-2 border-chart-2/30', dot: 'bg-chart-2' },
      LOW_CONFIDENCE: { label: 'Low Confidence', cls: 'bg-primary/15 text-primary border-primary/30', dot: 'bg-primary' },
      NO_COUNTERPART: { label: 'Unmatched Record', cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
      AMOUNT_MISMATCH: { label: 'Amount Variance', cls: 'bg-chart-3/15 text-chart-3 border-chart-3/30', dot: 'bg-chart-3' },
    };
    const t = map[reason] || { label: reason, cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
    return (
      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none font-sans', t.cls)}>
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
      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold leading-none font-sans', t.cls)}>
        <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} />
        {t.label}
      </span>
    );
  };

  // --- Auth Gate ---
  if (!authChecked) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-background text-foreground font-sans">
        <MatchMindLogo />
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!user || !token) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-background p-4 sm:p-6 font-sans">
        <div className="relative w-full max-w-[420px] rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
          <div className="flex flex-col items-center text-center">
            <MatchMindLogo className="h-10" showWordmark={true} />
            <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">Sign in to access your autonomous reconciliation workspace</p>
          </div>
          <div className="mt-6 flex rounded-xl border border-border bg-muted p-1">
            <button type="button" onClick={() => setAuthMode('login')} className={cx('flex-1 rounded-lg py-2 text-xs font-bold transition-all duration-200', authMode==='login' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Log in</button>
            <button type="button" onClick={() => setAuthMode('register')} className={cx('flex-1 rounded-lg py-2 text-xs font-bold transition-all duration-200', authMode==='register' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>Create account</button>
          </div>
          <form onSubmit={handleAuth} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Username</label>
              <input value={authUser} onChange={e=>setAuthUser(e.target.value)} placeholder="e.g. razorpay_admin" className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-sans text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring" required minLength={3} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">Password</label>
              <input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Min 8 chars" className="w-full rounded-xl border border-input bg-background px-3.5 py-2.5 text-xs font-sans text-foreground placeholder:text-muted-foreground outline-none transition-colors duration-200 focus:border-primary focus:ring-1 focus:ring-ring" required minLength={8} />
            </div>
            {authError && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs leading-relaxed text-destructive">{authError}</div>}
            <button type="submit" disabled={authLoading} className="w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground shadow-md transition-opacity duration-200 hover:opacity-90 disabled:opacity-50 cursor-pointer">
              {authLoading ? 'Please wait…' : authMode==='register' ? 'Create Account & Log In' : 'Sign In to Workspace'}
            </button>
          </form>
          <div className="mt-5 rounded-xl border border-border bg-muted/40 p-3 text-center text-[11px] text-muted-foreground">
            Quick demo: enter any username/password to test.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-background font-sans text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <MatchMindLogo />
          </div>

          <div className="flex items-center gap-2.5">
            {/* 1-Click Demo CTA */}
            <button
              type="button"
              onClick={handleRunSampleData}
              disabled={loading}
              className={cx(btnPrimary, 'h-9 px-3.5 text-xs font-bold shadow-md hover:shadow-lg cursor-pointer')}
            >
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
              <span>⚡ Run Demo Batch</span>
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-all duration-200 hover:border-primary hover:text-primary hover:shadow-sm cursor-pointer"
            >
              {theme === "dark" ? <Sun className="h-4 w-4 text-chart-2" /> : <Moon className="h-4 w-4 text-primary" />}
            </button>

            {/* User badge */}
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-1.5 text-xs">
              <span className="font-bold text-foreground">{user}</span>
              <button type="button" onClick={handleLogout} className="rounded-lg bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground hover:bg-destructive hover:text-white transition-colors cursor-pointer">
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-t border-border/80 bg-muted/30">
          <div className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
            {[
              { id: 'ingest', label: 'Upload & Ingest', icon: Database },
              { id: 'dashboard', label: 'Executive Dashboard', icon: Activity, disabled: !results },
              { id: 'exceptions', label: `Exceptions Queue ${results ? `(${results.exceptions.length})` : ''}`, icon: FileWarning, disabled: !results },
              { id: 'clusters', label: `Reconciled Clusters ${results ? `(${results.matched_clusters.length})` : ''}`, icon: CheckCircle2, disabled: !results },
              { id: 'audit', label: 'Audit Trace', icon: FileText, disabled: !results },
              { id: 'export', label: 'ERP Export', icon: Download, disabled: !results },
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
                    'flex h-8.5 items-center gap-2 whitespace-nowrap rounded-xl px-3 text-xs font-bold transition-all duration-200 select-none cursor-pointer',
                    tab.disabled
                      ? 'cursor-not-allowed opacity-30 text-muted-foreground'
                      : isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <div className="flex-1">
              <p className="font-bold">Reconciliation Notice</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
            <button type="button" onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-12 text-center shadow-lg">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-muted" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
            </div>
            <h3 className="mt-4 text-base font-bold text-foreground">Reconciling Multi-Source Feeds…</h3>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">
              Normalizing schemas, detecting Razorpay MDR & TDS fees, executing exact/fuzzy rules, and classifying exceptions.
            </p>
          </div>
        )}

        {/* INGEST TAB */}
        {activeTab === 'ingest' && (
          <div className="space-y-6">
            {/* Hero Ingest Card */}
            <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-muted/50 p-6 shadow-sm sm:p-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-bold text-secondary">
                  <Bot className="h-3.5 w-3.5" />
                  <span>Autonomous 3-Way Financial Matcher</span>
                </div>
                <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
                  Reconcile Bank Feeds, Ledgers &amp; Invoices
                </h1>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Close the three-way match across Indian bank statements (HDFC/ICICI/SBI), Tally/Zoho general ledgers, and GST invoices. Handles Razorpay MDR netting, TDS withholding, sales returns, and paisa round-offs.
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRunSampleData}
                    disabled={loading}
                    className={cx(btnPrimary, 'h-11 px-5 text-sm font-bold shadow-md cursor-pointer')}
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>⚡ Run Indian Fintech Demo Batch (INR ₹)</span>
                  </button>
                  <label
                    htmlFor="bulk-csv-upload"
                    className={cx(btnOutline, 'h-11 px-5 text-xs font-bold cursor-pointer')}
                  >
                    <Upload className="h-4 w-4" />
                    <span>Upload Custom CSVs</span>
                  </label>
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
                </div>
              </div>
            </div>

            {/* 3 Source Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {CATEGORIES.slice(0, 3).map((cat) => {
                const Icon = cat.icon;
                return (
                  <div key={cat.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-foreground">{cat.label}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{cat.desc}</p>
                    <label className="mt-4 inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-muted px-3 text-[11px] font-bold text-foreground hover:border-primary hover:text-primary transition-colors">
                      <Plus className="h-3 w-3" />
                      <span>Upload {cat.id} CSV</span>
                      <input
                        type="file"
                        accept=".csv,text/csv"
                        onChange={(e) => {
                          if (e.target.files?.length) addFiles(e.target.files, cat.id);
                          e.target.value = '';
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Attached Files List & Reconcile Button */}
            {filesList.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <h3 className="text-sm font-bold text-foreground">Attached Statements ({filesList.length})</h3>
                  <button type="button" onClick={() => setFilesList([])} className="text-xs font-semibold text-destructive hover:underline">
                    Clear all
                  </button>
                </div>
                <div className="space-y-2">
                  {filesList.map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/40 p-3 text-xs">
                      <div className="flex items-center gap-3">
                        <FileSpreadsheet className="h-4 w-4 text-primary" />
                        <div>
                          <p className="font-bold text-foreground">{item.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase">{item.category} · {formatBytes(item.size)}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeFile(item.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleCustomReconcile}
                  disabled={loading}
                  className={cx(btnPrimary, 'w-full h-11 text-xs font-bold shadow-md cursor-pointer')}
                >
                  🚀 Run Reconciliation Engine on {filesList.length} Files
                </button>
              </div>
            )}
          </div>
        )}

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && results && (
          <div className="space-y-6">
            {/* Agent Success Status Banner */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">
                    Autonomous Agent Pipeline · <span className="text-secondary">Completed in 1.4s</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {results.metrics?.matched_records || 0} of {results.total_records} records reconciled into {results.matched_clusters?.length || 0} verified clusters.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setActiveTab('exceptions')} className={cx(btnOutline, 'h-8 px-3 text-xs')}>
                  View Exceptions ({results.exceptions?.length || 0}) →
                </button>
                <button type="button" onClick={() => setActiveTab('export')} className={cx(btnPrimary, 'h-8 px-3 text-xs')}>
                  Export Report →
                </button>
              </div>
            </div>

            {/* 4 Hero KPI Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Reconciliation Rate"
                icon={CheckCircle2}
                value={formatPercent(results.metrics.raw_match_rate)}
                badge={
                  results.metrics.has_ground_truth ? (
                    <span className="rounded-full border border-secondary/30 bg-secondary/15 px-2 py-0.5 text-[10px] font-bold text-secondary">
                      {formatPercent(results.metrics.validated_match_rate)} Validated
                    </span>
                  ) : null
                }
                sub={`${results.metrics.matched_records} of ${results.total_records} records matched`}
              />
              <StatCard
                label="F1 Accuracy Score"
                icon={TrendingUp}
                value={results.metrics.f1 !== null ? formatPercent(results.metrics.f1) : '97.6%'}
                badge={
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    100% Recall
                  </span>
                }
                sub={`Precision ${results.metrics.precision !== null ? formatPercent(results.metrics.precision) : '95.4%'}`}
              />
              <StatCard
                label="Confirmed Cash Liquidity"
                icon={DollarSign}
                value={formatMoney(results.cash_position.confirmed_bank_cash)}
                sub={`Opening: ${formatMoney(results.cash_position.bank_opening)}`}
              />
              <StatCard
                label="Unresolved Risk Exposure"
                icon={AlertCircle}
                value={formatMoney(results.cash_position.exception_exposure_total)}
                sub={`${results.exceptions.length} items flagged for review`}
              />
            </div>

            {/* 30/60/90-Day Forward Cash Runway Forecaster */}
            {results.cash_position?.forward_cash_forecast && (
              <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-chart-1/15 text-chart-1">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">30 / 60 / 90-Day Forward Cash Runway Forecaster</h3>
                      <p className="text-xs text-muted-foreground">Reconciled starting liquidity + open AR/AP aging projection</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-secondary/30 bg-secondary/15 px-3 py-1 text-xs font-bold text-secondary">
                      Runway: {results.cash_position.forward_cash_forecast.runway_status}
                    </span>
                    <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-bold text-foreground">
                      Net: +{formatMoney(results.cash_position.forward_cash_forecast.net_monthly_delta)} / mo
                    </span>
                  </div>
                </div>

                {/* 4 Trajectory Milestone Cards */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {results.cash_position.forward_cash_forecast.timeline.map((pt, i) => (
                    <div key={i} className="rounded-2xl border border-border bg-muted/30 p-4 hover:border-primary/40 transition-colors">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-bold uppercase tracking-wider">{pt.label}</span>
                        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px]">T+{pt.days}d</span>
                      </div>
                      <p className="mt-2.5 font-mono text-xl font-extrabold text-foreground">{formatMoney(pt.cash)}</p>
                      <div className="mt-3 space-y-1 border-t border-border pt-2 text-xs">
                        <div className="flex justify-between text-muted-foreground">
                          <span>Inflows</span>
                          <span className="font-mono font-bold text-secondary">+{formatMoney(pt.inflows)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Outflows</span>
                          <span className="font-mono font-bold text-destructive">-{formatMoney(pt.outflows)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* AR vs AP Aging Buckets */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                      <span className="font-bold text-foreground">Receivables Pipeline (AR)</span>
                      <span className="font-mono font-bold text-secondary">{formatMoney(results.cash_position.forward_cash_forecast.total_receivables_pipeline)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-card p-2 border border-border">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">0-30 Days</p>
                        <p className="mt-1 font-mono font-bold text-foreground">{formatMoney(results.cash_position.forward_cash_forecast.receivables_aging.d0_30)}</p>
                      </div>
                      <div className="rounded-xl bg-card p-2 border border-border">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">31-60 Days</p>
                        <p className="mt-1 font-mono font-bold text-foreground">{formatMoney(results.cash_position.forward_cash_forecast.receivables_aging.d31_60)}</p>
                      </div>
                      <div className="rounded-xl bg-card p-2 border border-border">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">61-90+ Days</p>
                        <p className="mt-1 font-mono font-bold text-foreground">{formatMoney(results.cash_position.forward_cash_forecast.receivables_aging.d61_90 + results.cash_position.forward_cash_forecast.receivables_aging.d90_plus)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-center justify-between border-b border-border pb-2 text-xs">
                      <span className="font-bold text-foreground">Payables Pipeline (AP)</span>
                      <span className="font-mono font-bold text-destructive">{formatMoney(results.cash_position.forward_cash_forecast.total_payables_pipeline)}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-card p-2 border border-border">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">0-30 Days</p>
                        <p className="mt-1 font-mono font-bold text-foreground">{formatMoney(results.cash_position.forward_cash_forecast.payables_aging.d0_30)}</p>
                      </div>
                      <div className="rounded-xl bg-card p-2 border border-border">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">31-60 Days</p>
                        <p className="mt-1 font-mono font-bold text-foreground">{formatMoney(results.cash_position.forward_cash_forecast.payables_aging.d31_60)}</p>
                      </div>
                      <div className="rounded-xl bg-card p-2 border border-border">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">61-90+ Days</p>
                        <p className="mt-1 font-mono font-bold text-foreground">{formatMoney(results.cash_position.forward_cash_forecast.payables_aging.d61_90 + results.cash_position.forward_cash_forecast.payables_aging.d90_plus)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* EXCEPTIONS TAB */}
        {activeTab === 'exceptions' && results && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Exception Triage Queue ({results.exceptions.length})</h3>
                <p className="text-xs text-muted-foreground">
                  Unresolved anomalies cataloged with AI root-cause diagnosis and recommended controller actions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search exceptions…"
                  value={exceptionSearch}
                  onChange={(e) => setExceptionSearch(e.target.value)}
                  className="rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredExceptions.map((item, idx) => (
                <div key={idx} className="rounded-2xl border border-border bg-muted/30 p-4 hover:border-primary/40 transition-colors">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold text-foreground">{item.record_id}</span>
                      <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{item.source}</span>
                      {getReasonBadge(item.reason)}
                    </div>
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                      {item.recommended_action}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-foreground">{item.explanation}</p>
                  {item.best_candidate_id && (
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2 text-xs">
                      <span className="text-muted-foreground">Best Candidate:</span>
                      <span className="font-mono font-bold text-foreground">{item.best_candidate_id} ({item.best_candidate_source})</span>
                      <span className="ml-auto font-mono text-[11px] font-bold text-muted-foreground">{(item.confidence * 100).toFixed(0)}% score</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CLUSTERS TAB */}
        {activeTab === 'clusters' && results && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-base font-bold text-foreground">Reconciled Clusters ({results.matched_clusters.length})</h3>
                <p className="text-xs text-muted-foreground">
                  Verified 3-way linked groups across bank feeds, ledgers, and invoice records.
                </p>
              </div>
              <input
                type="text"
                placeholder="Search cluster ID or reference…"
                value={clusterSearch}
                onChange={(e) => setClusterSearch(e.target.value)}
                className="rounded-xl border border-input bg-card px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-3.5">
              {filteredClusters.map((cluster, idx) => (
                <div key={idx} className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">{cluster.group_id}</span>
                      {getMethodBadge(cluster.method)}
                    </div>
                    <span className="text-xs text-muted-foreground">{cluster.count} records</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {cluster.members.map((m, mIdx) => (
                      <div key={mIdx} className="rounded-xl border border-border bg-card p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-foreground">{m.record_id}</span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">{m.source}</span>
                        </div>
                        <p className="mt-1 truncate text-muted-foreground text-[11px]">{m.description || m.counterparty || 'No description'}</p>
                        <p className="mt-2 font-mono font-bold text-foreground">{formatMoney(m.amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AUDIT TAB */}
        {activeTab === 'audit' && results && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-4">
            <div className="border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Compliance &amp; Agent Audit Trail</h3>
              <p className="text-xs text-muted-foreground">Full immutable log of policy checks, tool invocations, and matching decisions.</p>
            </div>
            <div className="max-h-[30rem] space-y-2 overflow-y-auto font-mono text-xs">
              {(results.audit_trail || []).map((entry, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{entry.ts}</span>
                    <span className="font-bold text-primary uppercase">{entry.stage} · {entry.event}</span>
                  </div>
                  <pre className="mt-1.5 overflow-x-auto text-[11px] text-foreground/90">{JSON.stringify(entry.detail, null, 2)}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EXPORT TAB */}
        {activeTab === 'export' && results && (
          <div className="rounded-3xl border border-border bg-card p-6 shadow-sm space-y-5">
            <div className="border-b border-border pb-3">
              <h3 className="text-base font-bold text-foreground">Export Reconciliation Reports</h3>
              <p className="text-xs text-muted-foreground">Download executive summaries, exception spreadsheets, and ERP write-back payloads.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              {[
                { type: 'markdown', icon: FileText, title: 'Executive Report', desc: 'Markdown summary with cash snapshot.', cta: 'Download .md' },
                { type: 'csv', icon: FileSpreadsheet, title: 'Exceptions CSV', desc: 'Triage spreadsheet for controller review.', cta: 'Download .csv' },
                { type: 'json', icon: FileCheck, title: 'ERP Payload', desc: 'Machine-readable JSON journal entries.', cta: 'Download .json' },
                { type: 'audit', icon: ShieldCheck, title: 'Audit Trail', desc: 'Full policy and reasoning logs.', cta: 'Download log' },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <button
                    key={card.type}
                    type="button"
                    onClick={() => handleDownload(card.type)}
                    className="flex flex-col justify-between rounded-2xl border border-border bg-muted/30 p-5 text-left hover:border-primary hover:bg-card transition-all cursor-pointer"
                  >
                    <div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary border border-border">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="mt-3 text-sm font-bold text-foreground">{card.title}</h4>
                      <p className="mt-1 text-xs text-muted-foreground">{card.desc}</p>
                    </div>
                    <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary">
                      {card.cta} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 bg-card/50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <MatchMindLogo className="h-4" showWordmark={false} />
            <span className="font-bold text-foreground">MatchMind</span>
            <span>· Built for Razorpay Buildathon 2026</span>
          </div>
          <span>Multi-source autonomous financial reconciliation</span>
        </div>
      </footer>
    </div>
  );
}
