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
  FolderPlus,
  History,
  Layers,
  Menu,
  MessageSquare,
  Play,
  Plus,
  Receipt,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UploadCloud,
  X,
  Zap,
} from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

function MatchMindLogo({ className = "h-8 w-auto", showWordmark = true }) {
  return (
    <div className={cx("flex items-center gap-2.5 select-none", className)}>
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
          <span className="font-mono text-[16px] font-extrabold tracking-tight text-white">
            Match<span className="text-primary">Mind</span>
          </span>
          <span className="text-[10px] font-medium tracking-wider uppercase text-muted-foreground">
            Autonomous Finance
          </span>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, badge }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border transition-colors group-hover:text-primary group-hover:ring-primary/40">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight tabular-nums leading-none text-white">{value}</span>
        {badge}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{sub}</p>
    </div>
  );
}

const CATEGORIES = [
  { id: 'bank', label: 'Bank Account', icon: Building2, desc: 'Checking, wire & settlement feeds' },
  { id: 'ledger', label: 'General Ledger', icon: FileSpreadsheet, desc: 'QuickBooks, NetSuite, ERP journals' },
  { id: 'invoice', label: 'Invoices / Billing', icon: Receipt, desc: 'AP/AR billing, customer invoices' },
  { id: 'gateway', label: 'Payment Gateway / Card', icon: CreditCard, desc: 'Stripe, Adyen, corporate cards' },
];

function detectCategoryAndLabel(filename) {
  const clean = filename.replace(/\.[^/.]+$/, "");
  const lower = clean.toLowerCase();
  if (lower.includes("bank") || lower.includes("chase") || lower.includes("svb") || lower.includes("bofa") || lower.includes("statement") || lower.includes("feed") || lower.includes("checking") || lower.includes("savings")) {
    return { category: 'bank', label: clean.replace(/[-_]/g, ' ') };
  }
  if (lower.includes("ledger") || lower.includes("qbo") || lower.includes("quickbooks") || lower.includes("xero") || lower.includes("journal") || lower.includes("gl") || lower.includes("erp") || lower.includes("netsuite")) {
    return { category: 'ledger', label: clean.replace(/[-_]/g, ' ') };
  }
  if (lower.includes("inv") || lower.includes("bill") || lower.includes("ar") || lower.includes("ap") || lower.includes("receipt") || lower.includes("payable") || lower.includes("receivable")) {
    return { category: 'invoice', label: clean.replace(/[-_]/g, ' ') };
  }
  if (lower.includes("stripe") || lower.includes("adyen") || lower.includes("paypal") || lower.includes("card") || lower.includes("gateway") || lower.includes("payout") || lower.includes("processor")) {
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
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(LS_SIDEBAR) !== '0');

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
  useEffect(() => { localStorage.setItem(LS_SIDEBAR, sidebarOpen ? '1' : '0'); }, [sidebarOpen]);

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
    fetchSessions();
  };

  const handleCustomReconcile = async (e) => {
    if (e) e.preventDefault();
    if (filesList.length === 0) {
      setError('Please upload at least one CSV file (Bank Statement, General Ledger, Invoices, or Gateway).');
      return;
    }
    setLoading(true);
    setError(null);
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
            return;
          }
        } catch {}
        throw new Error('Session not found — it may have been deleted. Run a new reconciliation.');
      }
      const data = await r.json();
      setResults(data);
      setActiveTab('dashboard');
      localStorage.setItem(LS_KEY, JSON.stringify(data));
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
    if (val === undefined || val === null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
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

  const hasFiles = Boolean(bankFile || ledgerFile || invoicesFile);
  const inputCls =
    'w-full rounded-xl border border-input bg-card px-3 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-ring';
  const selectCls =
    'w-full rounded-xl border border-input bg-card px-3 py-2.5 text-xs font-mono text-foreground outline-none transition focus:border-primary focus:ring-1 focus:ring-ring cursor-pointer';

  // --- Auth gate (ChatGPT-like: must log in to see own sessions) ---
  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }
  if (!user || !token) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="pointer-events-none fixed inset-0 bg-aurora" />
        <div className="pointer-events-none fixed inset-0 bg-grid" />
        <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-xl">
          <div className="flex flex-col items-center text-center">
            <MatchMindLogo className="h-10 mb-1" showWordmark={true} />
            <p className="mt-3 text-xs text-muted-foreground">Sign in to access your private reconciliation workspace</p>
          </div>
          <div className="mt-6 flex rounded-xl border border-border bg-muted p-1">
            <button onClick={() => setAuthMode('login')} className={cx('flex-1 rounded-lg py-2 text-xs font-semibold transition', authMode==='login' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>Log in</button>
            <button onClick={() => setAuthMode('register')} className={cx('flex-1 rounded-lg py-2 text-xs font-semibold transition', authMode==='register' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground')}>Create account</button>
          </div>
          <form onSubmit={handleAuth} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Username</label>
              <input value={authUser} onChange={e=>setAuthUser(e.target.value)} placeholder="e.g. alice" className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" required minLength={3} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Password</label>
              <input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="Min 8 chars, letter + number + special" className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" required minLength={8} />
              <div className="rounded-lg border border-border bg-muted/50 px-3 py-2">
                <p className="text-[11px] font-semibold text-muted-foreground">Password must contain:</p>
                <ul className="mt-1 space-y-0.5 text-[11px]">
                  <li className={authPass.length >= 8 ? "text-secondary" : "text-muted-foreground"}>• 8–128 characters {authPass.length >= 8 ? "✓" : ""}</li>
                  <li className={/[A-Za-z]/.test(authPass) ? "text-secondary" : "text-muted-foreground"}>• at least one letter {/[A-Za-z]/.test(authPass) ? "✓" : ""}</li>
                  <li className={/[0-9]/.test(authPass) ? "text-secondary" : "text-muted-foreground"}>• at least one number {/[0-9]/.test(authPass) ? "✓" : ""}</li>
                  <li className={/[^A-Za-z0-9]/.test(authPass) ? "text-secondary" : "text-muted-foreground"}>• at least one special (!@#$%) {/[^A-Za-z0-9]/.test(authPass) ? "✓" : ""}</li>
                </ul>
              </div>
            </div>
            {authError && <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{authError}</div>}
            <button type="submit" disabled={authLoading} className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50">
              {authLoading ? 'Please wait…' : authMode==='register' ? 'Create account & log in' : 'Log in'}
            </button>
          </form>
          <p className="mt-6 text-center text-[11px] text-muted-foreground">Demo: create any username/password — stored locally in <span className="font-mono">reports/users.json</span></p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground font-mono">
      <div className="pointer-events-none fixed inset-0 bg-aurora" />
      <div className="pointer-events-none fixed inset-0 bg-grid" />

      {/* Sidebar - session history */}
      <aside className={cx('relative z-30 flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar backdrop-blur-xl transition-all duration-300', sidebarOpen ? 'w-[300px]' : 'w-0 overflow-hidden border-r-0')}>
        <div className="flex h-[64px] shrink-0 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <History className="h-4 w-4" />
            </div>
            <span className="text-sm font-bold text-white">Sessions</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{sessions.length}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-white cursor-pointer"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3">
          <button onClick={handleNewChat} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-white hover:border-primary/50 hover:text-primary transition cursor-pointer">
            <Plus className="h-4 w-4" /> New reconciliation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sessions.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
              <MessageSquare className="mx-auto h-6 w-6 text-muted-foreground/60" />
              <p className="mt-2 text-xs font-semibold text-foreground">No sessions yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">Run a reconciliation to inspect, restore, and review past runs here.</p>
            </div>
          )}
          <div className="space-y-2">
            {sessions.map(s => {
              const isActive = results?.batch_id === s.batch_id;
              return (
                <button key={s.batch_id} onClick={() => handleLoadSession(s.batch_id)} className={cx('group flex w-full flex-col rounded-xl border px-3 py-3 text-left transition cursor-pointer', isActive ? 'border-primary bg-primary/10 text-white' : 'border-border bg-card hover:border-primary/40 hover:bg-accent')}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={cx('truncate font-mono text-xs font-bold', isActive ? 'text-primary' : 'text-foreground')}>{s.batch_id}</span>
                    <span onClick={(e) => handleDeleteSession(s.batch_id, e)} className="hidden rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" /><span>{formatTime(s.saved_at)}</span><span>·</span><span>{s.total_records} rec</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
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
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">{user?.[0]?.toUpperCase()}</div>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-white">{user}</p>
                <p className="text-[11px] text-muted-foreground">Private workspace</p>
              </div>
            </div>
            <button onClick={handleLogout} title="Log out" className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive hover:shadow-md transition-all duration-200">Log out</button>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="h-3 w-3 text-secondary" /> {user}'s sessions — isolated per account</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-[64px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md transition-all duration-200 cursor-pointer"><Menu className="h-4 w-4" /></button>
              )}
              <MatchMindLogo />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground">{user?.[0]?.toUpperCase()}</div>
                <span className="text-xs font-semibold text-white">{user}</span>
                <button onClick={handleLogout} className="ml-1 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-destructive hover:text-white hover:shadow-md transition-all duration-200">Log out</button>
              </div>
              <button
                onClick={() => setActiveTab('ingest')}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200 focus-ring cursor-pointer',
                  activeTab === 'ingest'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'border border-border bg-card text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:scale-[1.02]'
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Upload files</span>
                <span className="sm:hidden">Upload</span>
              </button>
              {results && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={cx(
                    'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all duration-200 focus-ring cursor-pointer',
                    activeTab === 'dashboard'
                      ? 'bg-secondary text-secondary-foreground shadow'
                      : 'border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-secondary-foreground hover:border-secondary hover:shadow-md hover:scale-[1.02]'
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </button>
              )}
              {!sidebarOpen && sessions.length > 0 && (
                <button onClick={() => setSidebarOpen(true)} className="hidden items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md transition-all duration-200 sm:flex cursor-pointer">
                  <History className="h-3.5 w-3.5" /> {sessions.length}
                </button>
              )}
            </div>
          </div>

          <nav className="scrollbar-none flex items-center gap-2 overflow-x-auto border-t border-border py-2.5 px-1">
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
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={cx(
                    'group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-200',
                    tab.disabled
                      ? 'cursor-not-allowed text-muted-foreground/30'
                      : isActive
                        ? 'bg-card text-primary border border-primary/50 shadow-sm cursor-pointer'
                        : 'border border-transparent text-muted-foreground hover:bg-card hover:text-foreground hover:border-border cursor-pointer'
                  )}
                >
                  <span className={cx('flex h-5 w-5 items-center justify-center rounded-lg text-[11px] font-bold transition-colors', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground')}>
                    {tab.sub}
                  </span>
                  <Icon className={cx('h-3.5 w-3.5 transition-colors', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="animate-fade-in flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3.5 text-sm backdrop-blur">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-destructive/20 text-destructive">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-wide text-destructive">Reconciliation error</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground/80">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-white cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="glass animate-fade-in flex flex-col items-center justify-center gap-4 rounded-2xl px-8 py-12 text-center">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary border-r-secondary" style={{ animationDuration: '0.8s' }} />
              <div className="absolute inset-2 rounded-full bg-primary/10 blur-[1px]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Reconciling financial records…</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-muted-foreground">Normalizing schemas, finding candidate pairs, executing multi-tier matching rules, and evaluating AI evidence.</p>
            </div>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/5 rounded-full bg-primary animate-[indeterminate_1.2s_ease-in-out_infinite]" />
            </div>
          </div>
        )}

        {activeTab === 'ingest' && (
          <div className="animate-fade-up space-y-6">
            {results && (
              <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-3.5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-secondary/20 text-secondary">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">Active Session: {results.batch_id}</p>
                    <p className="text-[11px] text-muted-foreground">{results.total_records} records · {formatPercent(results.metrics.raw_match_rate)} matched</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('dashboard')} className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition cursor-pointer">View dashboard →</button>
              </div>
            )}
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8 shadow-sm">
              <div className="max-w-3xl">
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Reconcile Financial Records
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground sm:text-sm">
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
                    'relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200',
                    isDragging
                      ? 'border-primary bg-primary/10 shadow-lg scale-[1.005]'
                      : 'border-border bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                  )}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/30 shadow-sm">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <h3 className="mt-4 text-base font-bold text-white">
                    Drag &amp; drop CSV files here
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground max-w-md">
                    Upload multiple bank statements, ledger journals, invoice exports, and processor feeds (1 to 50+ files supported).
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
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
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm hover:opacity-90 transition"
                    >
                      <FileUp className="h-4 w-4" /> Browse CSV Files
                    </label>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-2 border-t border-border/60 pt-4 text-xs">
                    <span className="text-[11px] font-semibold text-muted-foreground mr-1">Quick add:</span>
                    {CATEGORIES.map((cat) => {
                      const CatIcon = cat.icon;
                      return (
                        <label
                          key={cat.id}
                          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:border-primary/50 hover:text-primary transition"
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-white">Attached Statements &amp; Ledgers</span>
                        <span className="rounded-full bg-primary/15 border border-primary/30 px-2.5 py-0.5 text-xs font-bold text-primary">
                          {filesList.length} {filesList.length === 1 ? 'file' : 'files'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFilesList([])}
                        className="text-xs font-semibold text-muted-foreground hover:text-destructive transition cursor-pointer"
                      >
                        Clear all
                      </button>
                    </div>

                    <div className="space-y-2">
                      {filesList.map((item) => {
                        const currentCat = CATEGORIES.find((c) => c.id === item.category) || CATEGORIES[0];
                        const Icon = currentCat.icon;
                        const isBalanceAccount = item.category === 'bank' || item.category === 'ledger' || item.category === 'gateway';

                        return (
                          <div
                            key={item.id}
                            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:border-border/80 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                                <Icon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <input
                                    type="text"
                                    value={item.label}
                                    onChange={(e) => updateFileItem(item.id, 'label', e.target.value)}
                                    placeholder="Account or Feed Name"
                                    className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-bold text-foreground outline-none focus:border-primary focus:bg-background focus:ring-1 focus:ring-ring"
                                  />
                                  <select
                                    value={item.category}
                                    onChange={(e) => updateFileItem(item.id, 'category', e.target.value)}
                                    className="rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs font-semibold text-foreground outline-none focus:border-primary focus:bg-background cursor-pointer"
                                  >
                                    {CATEGORIES.map((c) => (
                                      <option key={c.id} value={c.id} className="bg-card text-foreground">
                                        {c.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <p className="mt-1 truncate text-[11px] text-muted-foreground">
                                  {item.name} · {formatBytes(item.size)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              {isBalanceAccount ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-semibold text-muted-foreground">Opening:</span>
                                  <div className="relative w-32">
                                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
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
                                      className="w-full rounded-lg border border-input bg-muted/40 py-1.5 pl-6 pr-2.5 text-xs font-mono font-semibold text-foreground outline-none focus:border-primary focus:bg-background focus:ring-1 focus:ring-ring tabular-nums"
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[11px] text-muted-foreground italic px-2">No opening balance</div>
                              )}
                              <button
                                type="button"
                                onClick={() => removeFile(item.id)}
                                title="Remove file"
                                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground hover:bg-destructive hover:text-white hover:border-destructive transition cursor-pointer"
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
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition disabled:opacity-50 cursor-pointer"
                  >
                    <Database className="h-3.5 w-3.5" />
                    Or run with benchmark sample data
                  </button>
                  <button
                    type="submit"
                    disabled={loading || filesList.length === 0}
                    className={cx(
                      'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all focus-ring cursor-pointer',
                      filesList.length === 0
                        ? 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground shadow-md hover:opacity-90'
                    )}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Run autonomous reconciliation {filesList.length > 0 ? `(${filesList.length} files)` : ''}
                    <ArrowRight className="h-4 w-4 opacity-70" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && results && (
          <div className="animate-fade-up space-y-6">
            {results.agent_trace && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary"><Bot className="h-4 w-4" /></div>
                  <div>
                    <p className="text-xs font-bold text-white">Autonomous Reconciliation · <span className={results.agent_status === 'complete' ? 'text-secondary' : results.agent_status === 'awaiting_approval' ? 'text-chart-2' : results.agent_status === 'blocked' ? 'text-destructive' : 'text-muted-foreground'}>{results.agent_status === 'complete' ? 'Completed' : results.agent_status}</span></p>
                    <p className="text-[11px] text-muted-foreground">{results.metrics?.matched_records || 0} of {results.total_records} records matched · {results.exceptions?.length || 0} exceptions cataloged</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setActiveTab('exceptions')} className="rounded-lg bg-muted border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition cursor-pointer">View exceptions ({results.exceptions?.length || 0}) →</button>
                  <button onClick={() => setActiveTab('audit')} className="rounded-lg bg-muted border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:border-primary/50 hover:text-primary transition cursor-pointer">View audit log →</button>
                </div>
              </div>
            )}

            {results.pending_approvals && results.pending_approvals.length > 0 && (
              <div className="rounded-2xl border border-chart-2/30 bg-chart-2/5 p-6">
                <h4 className="text-sm font-bold text-white flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-chart-2" /> Approvals Required — Review Pending Actions</h4>
                <p className="mt-1 text-xs text-muted-foreground">Adjustments and high-value transactions require human sign-off before finalizing.</p>
                <div className="mt-4 space-y-3">
                  {results.pending_approvals.map(apr => (
                    <div key={apr.id} className="rounded-xl border border-border bg-card p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-bold text-white">{apr.action} · <span className="text-chart-2">{apr.status}</span></p>
                          <p className="mt-1 text-xs text-muted-foreground">{apr.reason}</p>
                          {apr.amount ? <p className="mt-1 text-xs font-mono text-foreground">amount {new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(apr.amount)}</p> : null}
                          {apr.evidence?.length ? <p className="mt-1 text-[11px] font-mono text-muted-foreground">evidence: {apr.evidence.join(', ')}</p> : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={async()=>{
                            const r = await authFetch(`/api/approve/${encodeURIComponent(results.batch_id)}/${encodeURIComponent(apr.id)}`,{method:'POST'});
                            if(r.ok){ const j=await r.json(); setError(null); fetchSessions(); } else { const e=await r.json(); setError(e.detail); }
                          }} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-bold text-secondary-foreground hover:opacity-90 cursor-pointer">Approve</button>
                          <button onClick={async()=>{
                            const r = await authFetch(`/api/reject/${encodeURIComponent(results.batch_id)}/${encodeURIComponent(apr.id)}`,{method:'POST'});
                            if(r.ok){ fetchSessions(); } else { const e=await r.json(); setError(e.detail); }
                          }} className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground hover:bg-destructive hover:text-white cursor-pointer">Reject</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Match rate"
                icon={CheckCircle2}
                value={formatPercent(results.metrics.raw_match_rate)}
                badge={
                  results.metrics.has_ground_truth ? (
                    <span className="rounded-full border border-secondary/30 bg-secondary/15 px-2 py-0.5 text-[11px] font-semibold text-secondary">{formatPercent(results.metrics.validated_match_rate)} validated</span>
                  ) : null
                }
                sub={`${results.metrics.matched_records} of ${results.total_records} records reconciled`}
              />
              <StatCard
                label="Accuracy · F1"
                icon={TrendingUp}
                value={results.metrics.f1 !== null ? formatPercent(results.metrics.f1) : 'N/A'}
                badge={<span className="text-[11px] font-medium text-muted-foreground">P {results.metrics.precision !== null ? formatPercent(results.metrics.precision) : 'N/A'}</span>}
                sub={`Recall ${results.metrics.recall !== null ? formatPercent(results.metrics.recall) : 'N/A'} · needs ground truth`}
              />
              <StatCard
                label="Exception exposure"
                icon={AlertCircle}
                value={formatMoney(results.cash_position.exception_exposure_total)}
                sub={`${results.exceptions.length} unresolved · flagged for review`}
              />
              <StatCard
                label="Reconciled variance"
                icon={DollarSign}
                value={formatMoney(results.cash_position.reconciled_difference)}
                sub="Bank cash vs. ledger delta"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Cash-position snapshot</h3>
                      <p className="text-xs text-muted-foreground">Live bank vs. ledger liquidity</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-secondary/30 bg-secondary/15 px-2.5 py-1 text-[11px] font-semibold text-secondary">Reconciled</span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Confirmed bank cash</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">{formatMoney(results.cash_position.confirmed_bank_cash)}</p>
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground"><span>Opening balance</span><span className="font-semibold text-foreground tabular-nums">{formatMoney(results.cash_position.bank_opening)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Matched movements</span><span className="font-semibold text-secondary tabular-nums">+{formatMoney(results.cash_position.matched_bank_movements)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/40 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Confirmed ledger cash</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-white tabular-nums">{formatMoney(results.cash_position.confirmed_ledger_cash)}</p>
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between text-muted-foreground"><span>Opening balance</span><span className="font-semibold text-foreground tabular-nums">{formatMoney(results.cash_position.ledger_opening)}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Matched movements</span><span className="font-semibold text-secondary tabular-nums">+{formatMoney(results.cash_position.matched_ledger_movements)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/60 px-4 py-3 text-xs">
                  <span className="font-semibold text-foreground">Exposure by source</span>
                  <div className="flex flex-wrap gap-4">
                    <span className="text-muted-foreground">Bank <strong className="font-bold text-destructive tabular-nums">{formatMoney(results.cash_position.exception_exposure_by_source?.bank || 0)}</strong></span>
                    <span className="text-muted-foreground">Ledger <strong className="font-bold text-destructive tabular-nums">{formatMoney(results.cash_position.exception_exposure_by_source?.ledger || 0)}</strong></span>
                    <span className="text-muted-foreground">Invoices <strong className="font-bold text-destructive tabular-nums">{formatMoney(results.cash_position.exception_exposure_by_source?.invoice || 0)}</strong></span>
                  </div>
                </div>

                {results.cash_position?.accounts_breakdown?.length > 0 && (
                  <div className="mt-5 rounded-xl border border-border bg-muted/20 p-4">
                    <p className="text-xs font-bold text-white mb-3 flex items-center justify-between">
                      <span>Multi-Account Cash Breakdown</span>
                      <span className="text-[11px] font-normal text-muted-foreground">{results.cash_position.accounts_breakdown.length} accounts configured</span>
                    </p>
                    <div className="space-y-2">
                      {results.cash_position.accounts_breakdown.map((acc, i) => (
                        <div key={i} className="flex flex-col gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">{acc.category}</span>
                            <span className="font-bold text-foreground">{acc.account_name}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-xs">
                            <span className="text-muted-foreground">Opening: <strong className="text-foreground font-semibold tabular-nums">{formatMoney(acc.opening_balance)}</strong></span>
                            <span className="text-muted-foreground">Movements: <strong className={acc.movements >= 0 ? 'text-secondary font-semibold tabular-nums' : 'text-destructive font-semibold tabular-nums'}>{acc.movements >= 0 ? `+${formatMoney(acc.movements)}` : formatMoney(acc.movements)}</strong></span>
                            <span className="text-muted-foreground">Confirmed: <strong className="text-white font-bold tabular-nums">{formatMoney(acc.confirmed_balance)}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-border bg-card p-6 shadow-sm">
                <div>
                  <h3 className="text-sm font-bold text-white">Resolution breakdown</h3>
                  <p className="text-xs text-muted-foreground">Distribution across tiers</p>
                  <div className="mt-6 space-y-4">
                    {[
                      { label: 'Tier 1 · Exact', value: results.metrics.method_counts.exact, color: 'bg-secondary', text: 'text-secondary' },
                      { label: 'Tier 2 · Fuzzy', value: results.metrics.method_counts.fuzzy, color: 'bg-chart-2', text: 'text-chart-2' },
                      { label: 'Tier 3 · AI', value: results.metrics.method_counts.llm, color: 'bg-primary', text: 'text-primary' },
                      { label: 'Exceptions', value: results.exceptions.length, color: 'bg-destructive', text: 'text-destructive' },
                    ].map((r) => {
                      const pct = results.total_records ? (r.value / results.total_records) * 100 : 0;
                      return (
                        <div key={r.label}>
                          <div className="mb-1.5 flex justify-between text-xs font-semibold"><span className={r.text}>{r.label}</span><span className="tabular-nums text-white">{r.value}</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className={cx('h-full rounded-full transition-all duration-700', r.color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-xs">
                  <span className="truncate font-mono text-muted-foreground">Batch <strong className="font-semibold text-foreground">{results.batch_id}</strong></span>
                  <button onClick={() => setActiveTab('exceptions')} className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary hover:underline cursor-pointer">
                    View exceptions <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exceptions' && results && (
          <div className="animate-fade-up space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Exception triage</h3>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">Every unresolved transaction cataloged with root cause and the next best candidate — nothing falls through the cracks.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input type="text" placeholder="Search ID or explanation…" value={exceptionSearch} onChange={(e) => setExceptionSearch(e.target.value)} className="w-44 rounded-xl border border-input bg-card py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring sm:w-56" />
                </div>
                <select value={exceptionFilter} onChange={(e) => setExceptionFilter(e.target.value)} className={cx(selectCls, 'w-auto')}>
                  <option value="ALL" className="bg-card text-foreground">All categories</option>
                  <option value="POSSIBLE_DUPLICATE" className="bg-card text-foreground">Double-Post</option>
                  <option value="DUPLICATE_CANDIDATE" className="bg-card text-foreground">Near-Tie</option>
                  <option value="LOW_CONFIDENCE" className="bg-card text-foreground">Low Confidence</option>
                  <option value="NO_COUNTERPART" className="bg-card text-foreground">Unmatched</option>
                  <option value="AMOUNT_MISMATCH" className="bg-card text-foreground">Amount Variance</option>
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-muted/60 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-4 py-3">Record ID</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-4 py-3">Diagnosis</th>
                      <th className="px-4 py-3">Best candidate</th>
                      <th className="px-3 py-3">Confidence</th>
                      <th className="px-4 py-3">Explanation</th>
                      <th className="px-3 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredExceptions.map((item, idx) => (
                      <tr key={idx} className="transition-colors hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-white">{item.record_id}</td>
                        <td className="px-3 py-3 capitalize text-foreground">{item.source}</td>
                        <td className="px-4 py-3">{getReasonBadge(item.reason)}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">{item.best_candidate_id ? `${item.best_candidate_id} · ${item.best_candidate_source}` : '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
                              <div className={cx('h-full rounded-full', item.confidence > 0.8 ? 'bg-secondary' : item.confidence > 0.5 ? 'bg-chart-2' : 'bg-destructive')} style={{ width: `${(item.confidence * 100).toFixed(0)}%` }} />
                            </div>
                            <span className="font-semibold tabular-nums text-foreground">{(item.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="max-w-[360px] px-4 py-3 leading-relaxed text-foreground">{item.explanation}</td>
                        <td className="px-3 py-3"><span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">{item.recommended_action}</span></td>
                      </tr>
                    ))}
                    {filteredExceptions.length === 0 && (
                      <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">No exceptions match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clusters' && results && (
          <div className="animate-fade-up space-y-5 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Reconciled groups</h3>
                <p className="mt-1 text-xs text-muted-foreground">Linked transaction clusters across bank, ledger, and invoices.</p>
              </div>
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Search group or reference…" value={clusterSearch} onChange={(e) => setClusterSearch(e.target.value)} className="w-64 rounded-xl border border-input bg-card py-2 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredClusters.map((cluster, idx) => (
                <div key={idx} className="rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-primary/40 hover:bg-muted/50">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{cluster.group_id}</span>
                      {getMethodBadge(cluster.method)}
                    </div>
                    <span className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground">{cluster.count} linked</span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {cluster.members.map((m, mIdx) => (
                      <div key={mIdx} className="flex flex-col justify-between rounded-lg border border-border bg-card p-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-white">{m.record_id}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{m.source}</span>
                          </div>
                          <p className="mt-1.5 truncate text-[11px] leading-relaxed text-muted-foreground">{m.description || m.counterparty || 'No description'}</p>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between border-t border-border pt-2">
                          <span className="font-mono text-[11px] text-muted-foreground">{m.date}</span>
                          <span className="text-xs font-bold tabular-nums text-white">{formatMoney(m.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredClusters.length === 0 && <p className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">No groups match your search.</p>}
            </div>
          </div>
        )}

        {activeTab === 'audit' && results && (
          <div className="animate-fade-up space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-white">Audit trail</h3>
              <p className="mt-1 text-xs text-muted-foreground">Every stage, gate, and decision — fully traceable for auditors.</p>
            </div>
            <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3 font-mono text-[11px]">
              {(results.audit_trail || []).map((entry, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-card p-3">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono tabular-nums">{entry.ts}</span>
                    <span className="rounded bg-primary/15 px-1.5 py-1 font-bold uppercase tracking-wide text-primary ring-1 ring-primary/30">{entry.stage} · {entry.event}</span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed text-foreground">{JSON.stringify(entry.detail, null, 2)}</pre>
                </div>
              ))}
              {(!results.audit_trail || results.audit_trail.length === 0) && <p className="py-8 text-center font-sans text-xs text-muted-foreground">No audit events recorded.</p>}
            </div>
          </div>
        )}

        {activeTab === 'export' && results && (
          <div className="animate-fade-up space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-white">Export & reporting</h3>
              <p className="mt-1 text-xs text-muted-foreground">Auditable packs for finance ops, auditors, or ERP write-back.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { type: 'markdown', icon: FileText, title: 'Executive report', desc: 'Markdown summary with cash snapshot.', cta: 'Download .md' },
                { type: 'csv', icon: FileSpreadsheet, title: 'Exceptions CSV', desc: 'Unresolved transactions spreadsheet.', cta: 'Download .csv' },
                { type: 'json', icon: FileCheck, title: 'ERP payload', desc: 'Machine-readable JSON for write-back.', cta: 'Download .json' },
                { type: 'audit', icon: ShieldCheck, title: 'Audit trail', desc: 'Full verification & reasoning log.', cta: 'Download log' },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <button key={card.type} onClick={() => handleDownload(card.type)} className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-muted/30 p-5 text-left transition-all hover:border-primary/50 hover:bg-card cursor-pointer">
                    <div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card text-muted-foreground ring-1 ring-border transition-colors group-hover:text-primary group-hover:ring-primary/40">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h4 className="mt-3 text-sm font-bold text-white">{card.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{card.desc}</p>
                    </div>
                    <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-primary">
                      <span className="underline decoration-primary/30 underline-offset-4 group-hover:decoration-primary">{card.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Batch</span>
              <span className="rounded bg-card px-2 py-1 font-mono text-foreground border border-border">{results.batch_id}</span>
              <span className="hidden sm:inline">·</span>
              <span>{results.total_records} records · {results.metrics.matched_records} matched · {results.exceptions.length} exceptions</span>
            </div>
          </div>
        )}
      </main>

      <footer className="relative border-t border-border py-5">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 text-center text-[11px] font-medium tracking-wide text-muted-foreground sm:px-6 lg:px-8">
          <img src="/favicon.svg" alt="" className="h-4 w-4" /> MatchMind · Autonomous financial operations & multi-source reconciliation
        </div>
      </footer>
      </div>
    </div>
  );
}
