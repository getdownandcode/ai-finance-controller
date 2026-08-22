import React, { useState, useEffect } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  DollarSign,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  FileUp,
  FileWarning,
  History,
  Layers,
  Menu,
  MessageSquare,
  Play,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  X,
} from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');

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
  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [invoicesFile, setInvoicesFile] = useState(null);
  const [bankOpening, setBankOpening] = useState(0.0);
  const [ledgerOpening, setLedgerOpening] = useState(0.0);
  const [matchingStrategy, setMatchingStrategy] = useState('auto');
  const [exceptionFilter, setExceptionFilter] = useState('ALL');
  const [exceptionSearch, setExceptionSearch] = useState('');
  const [clusterSearch, setClusterSearch] = useState('');
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem(LS_SIDEBAR) !== '0');

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
    if (!bankFile && !ledgerFile && !invoicesFile) {
      setError('Please upload at least one CSV file (Bank Statement, General Ledger, or Invoices).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      if (bankFile) formData.append('bank_file', bankFile);
      if (ledgerFile) formData.append('ledger_file', ledgerFile);
      if (invoicesFile) formData.append('invoices_file', invoicesFile);
      formData.append('bank_opening', bankOpening);
      formData.append('ledger_opening', ledgerOpening);
      formData.append('llm_mode', matchingStrategy);
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
      formData.append('llm_mode', matchingStrategy);
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Layers className="h-5 w-5" /></div>
            <h1 className="mt-4 text-xl font-bold text-white">AI Finance Controller</h1>
            <p className="mt-1 text-xs text-muted-foreground">Sign in to access your private reconciliation workspace</p>
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
              <input type="password" value={authPass} onChange={e=>setAuthPass(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-1 focus:ring-ring" required minLength={6} />
              <p className="text-[11px] text-muted-foreground">Each user sees only their own sessions & dashboard — like ChatGPT.</p>
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
            <button onClick={handleLogout} title="Log out" className="rounded-lg border border-border bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:border-destructive/40 hover:text-destructive transition">Log out</button>
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
                <button onClick={() => setSidebarOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-white cursor-pointer"><Menu className="h-4 w-4" /></button>
              )}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Layers className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-bold tracking-tight text-white">AI Finance Controller</h1>
                <p className="hidden truncate text-[11px] font-medium text-muted-foreground sm:block">Autonomous multi-source reconciliation</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center text-[11px] font-bold text-primary-foreground">{user?.[0]?.toUpperCase()}</div>
                <span className="text-xs font-semibold text-white">{user}</span>
                <button onClick={handleLogout} className="ml-1 rounded-md bg-muted px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:text-destructive">Log out</button>
              </div>
              <button
                onClick={() => setActiveTab('ingest')}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all focus-ring cursor-pointer',
                  activeTab === 'ingest'
                    ? 'bg-primary text-primary-foreground shadow'
                    : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-white'
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
                    'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all focus-ring cursor-pointer',
                    activeTab === 'dashboard'
                      ? 'bg-secondary text-secondary-foreground shadow'
                      : 'border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-white'
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </button>
              )}
              {!sidebarOpen && sessions.length > 0 && (
                <button onClick={() => setSidebarOpen(true)} className="hidden items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground hover:border-primary/40 hover:text-white sm:flex cursor-pointer">
                  <History className="h-3.5 w-3.5 text-primary" /> {sessions.length}
                </button>
              )}
            </div>
          </div>

          <nav className="scrollbar-none flex gap-1 overflow-x-auto border-t border-border py-2">
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
                    'group flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all',
                    tab.disabled
                      ? 'cursor-not-allowed text-muted-foreground/40'
                      : isActive
                        ? 'bg-card text-primary ring-1 ring-primary/40 cursor-pointer shadow-sm'
                        : 'text-muted-foreground hover:bg-card hover:text-foreground cursor-pointer'
                  )}
                >
                  <span className={cx('flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold', isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground')}>
                    {tab.sub}
                  </span>
                  <Icon className={cx('h-3.5 w-3.5', isActive ? 'text-primary' : 'text-muted-foreground')} />
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
              <div className="h-full w-1/2 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-primary to-transparent bg-[length:200%_100%]" />
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
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {[
                    {
                      key: 'bank',
                      file: bankFile,
                      setter: setBankFile,
                      id: 'bank-file',
                      icon: Building2,
                      title: 'Bank Feed',
                      desc: 'Statements, settlements & wires',
                    },
                    {
                      key: 'ledger',
                      file: ledgerFile,
                      setter: setLedgerFile,
                      id: 'ledger-file',
                      icon: FileSpreadsheet,
                      title: 'General Ledger',
                      desc: 'QuickBooks, Xero & ERP journals',
                    },
                    {
                      key: 'inv',
                      file: invoicesFile,
                      setter: setInvoicesFile,
                      id: 'invoice-file',
                      icon: Receipt,
                      title: 'Invoices',
                      desc: 'Billing & AP/AR items · optional',
                    },
                  ].map((s) => {
                    const Icon = s.icon;
                    return (
                      <div
                        key={s.key}
                        className={cx(
                          'group relative flex flex-col justify-between rounded-xl border p-5 text-center transition-all duration-200',
                          s.file 
                            ? 'border-primary/60 bg-primary/5' 
                            : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40'
                        )}
                      >
                        <div>
                          <div className={cx(
                            'mx-auto flex h-10 w-10 items-center justify-center rounded-lg ring-1 transition-colors',
                            s.file ? 'bg-primary text-primary-foreground ring-primary' : 'bg-muted text-muted-foreground ring-border group-hover:text-primary group-hover:ring-primary/40'
                          )}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <h4 className="mt-3 text-sm font-bold text-white">{s.title}</h4>
                          <p className="mt-1 text-xs text-muted-foreground">{s.desc}</p>
                        </div>
                        <div className="mt-5">
                          {s.file ? (
                            <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/80 px-3 py-2 text-xs font-medium backdrop-blur">
                              <span className="min-w-0 truncate text-foreground">{s.file.name}</span>
                              <button type="button" onClick={() => s.setter(null)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground hover:bg-accent hover:text-white cursor-pointer">
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <input type="file" id={s.id} accept=".csv,text/csv" onChange={(e) => s.setter(e.target.files?.[0] || null)} className="hidden" />
                              <label htmlFor={s.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-muted px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-primary/40 hover:text-primary">
                                <FileUp className="h-3.5 w-3.5" />
                                Select CSV
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 gap-4 border-t border-border pt-6 sm:grid-cols-3">
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-foreground">Bank opening balance</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <input type="number" step="0.01" value={bankOpening} onChange={(e) => setBankOpening(parseFloat(e.target.value) || 0)} className={cx(inputCls, 'pl-7')} placeholder="0.00" />
                    </div>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-foreground">Ledger opening balance</span>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                      <input type="number" step="0.01" value={ledgerOpening} onChange={(e) => setLedgerOpening(parseFloat(e.target.value) || 0)} className={cx(inputCls, 'pl-7')} placeholder="0.00" />
                    </div>
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-xs font-semibold text-foreground">Matching engine</span>
                    <select value={matchingStrategy} onChange={(e) => setMatchingStrategy(e.target.value)} className={selectCls}>
                      <option value="auto" className="bg-card text-foreground">Adaptive Hybrid (Exact + Fuzzy + AI)</option>
                      <option value="gemini" className="bg-card text-foreground">AI Reasoner priority</option>
                      <option value="off" className="bg-card text-foreground">Deterministic only (No AI)</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-border pt-6 sm:flex-row sm:items-center">
                  <button type="button" onClick={handleRunSampleData} disabled={loading} className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition disabled:opacity-50 cursor-pointer">
                    <Database className="h-3.5 w-3.5" />
                    Or run with benchmark sample data
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !hasFiles}
                    className={cx(
                      'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all focus-ring cursor-pointer',
                      !hasFiles
                        ? 'cursor-not-allowed border border-border bg-muted text-muted-foreground'
                        : 'bg-primary text-primary-foreground shadow-md hover:opacity-90'
                    )}
                  >
                    <Play className="h-4 w-4 fill-current" />
                    Run reconciliation
                    <ArrowRight className="h-4 w-4 opacity-70" />
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && results && (
          <div className="animate-fade-up space-y-6">
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
        <div className="mx-auto max-w-7xl px-4 text-center text-[11px] font-medium tracking-wide text-muted-foreground sm:px-6 lg:px-8">
          AI Finance Controller · Autonomous financial operations & multi-source reconciliation
        </div>
      </footer>
      </div>
    </div>
  );
}
