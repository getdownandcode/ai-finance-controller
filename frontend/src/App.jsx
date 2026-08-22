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

const ACCENTS = {
  emerald: { line: 'from-emerald-400/70 via-emerald-400/10', chip: 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20' },
  indigo: { line: 'from-indigo-400/70 via-indigo-400/10', chip: 'bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20' },
  rose: { line: 'from-rose-400/70 via-rose-400/10', chip: 'bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/20' },
  sky: { line: 'from-sky-400/70 via-sky-400/10', chip: 'bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/20' },
  amber: { line: 'from-amber-400/70 via-amber-400/10', chip: 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-400/20' },
  violet: { line: 'from-violet-400/70 via-violet-400/10', chip: 'bg-violet-500/15 text-violet-300 ring-1 ring-violet-400/20' },
};

function StatCard({ label, value, sub, icon: Icon, accent, badge }) {
  const a = ACCENTS[accent];
  return (
    <div className="glass group relative overflow-hidden rounded-2xl p-5 transition-colors hover:border-white/15">
      <div className={cx('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent', a.line)} />
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</span>
        <div className={cx('flex h-8 w-8 items-center justify-center rounded-xl', a.chip)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-2">
        <span className={cx('text-[26px] font-extrabold tracking-tight tabular-nums leading-none', accent === 'rose' ? 'text-rose-300' : 'text-white')}>{value}</span>
        {badge}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{sub}</p>
    </div>
  );
}

const LS_KEY = 'afc_session';
const LS_TAB = 'afc_activeTab';
const LS_SIDEBAR = 'afc_sidebarOpen';

export default function App() {
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

  // persist results to localStorage (ChatGPT-like: dashboard survives refresh)
  useEffect(() => {
    try {
      if (results) localStorage.setItem(LS_KEY, JSON.stringify(results));
      else localStorage.removeItem(LS_KEY);
    } catch {}
  }, [results]);

  // fetch session history from backend on mount and after each reconcile
  const fetchSessions = async () => {
    try {
      const r = await fetch('/api/sessions');
      if (r.ok) { const j = await r.json(); setSessions(j.sessions || []); }
    } catch {}
  };
  useEffect(() => { fetchSessions(); }, []);
  // if we have a persisted result but no sessions yet, still show it; on first load try to sync
  useEffect(() => {
    if (results && sessions.length === 0) {
      // already have local session, ensure sidebar shows current
      setSessions((prev) => {
        const exists = prev.find(s => s.batch_id === results.batch_id);
        if (exists) return prev;
        return [{ batch_id: results.batch_id, saved_at: results._saved_at || new Date().toISOString(), total_records: results.total_records, source_counts: results.source_counts, metrics: results.metrics, cash_position: results.cash_position, reasoner_mode: results.reasoner_mode }, ...prev];
      });
    }
  }, [results, sessions.length]);

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
      const res = await fetch('/api/reconcile', { method: 'POST', body: formData });
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
      const res = await fetch('/api/reconcile-demo', { method: 'POST', body: formData });
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
      const r = await fetch(`/api/session/${encodeURIComponent(batchId)}`);
      if (!r.ok) throw new Error('Session not found');
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
      await fetch(`/api/session/${encodeURIComponent(batchId)}`, { method: 'DELETE' });
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
      POSSIBLE_DUPLICATE: { label: 'Double-Post Conflict', cls: 'bg-rose-500/10 text-rose-300 border-rose-500/20', dot: 'bg-rose-400' },
      DUPLICATE_CANDIDATE: { label: 'Near-Tie Conflict', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20', dot: 'bg-amber-400' },
      LOW_CONFIDENCE: { label: 'Low Confidence', cls: 'bg-sky-500/10 text-sky-300 border-sky-500/20', dot: 'bg-sky-400' },
      NO_COUNTERPART: { label: 'Unmatched Record', cls: 'bg-slate-500/10 text-slate-300 border-white/10', dot: 'bg-slate-400' },
      AMOUNT_MISMATCH: { label: 'Amount Variance', cls: 'bg-violet-500/10 text-violet-300 border-violet-500/20', dot: 'bg-violet-400' },
    };
    const t = map[reason] || { label: reason, cls: 'bg-slate-500/10 text-slate-300 border-white/10', dot: 'bg-slate-400' };
    return (
      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none', t.cls)}>
        <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} />
        {t.label}
      </span>
    );
  };

  const getMethodBadge = (method) => {
    const map = {
      exact: { label: 'Tier 1 · Exact', cls: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20', dot: 'bg-emerald-400' },
      fuzzy: { label: 'Tier 2 · Fuzzy', cls: 'bg-amber-500/10 text-amber-300 border-amber-500/20', dot: 'bg-amber-400' },
      llm: { label: 'Tier 3 · AI Reasoner', cls: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20', dot: 'bg-indigo-400' },
    };
    const t = map[method] || { label: method, cls: 'bg-slate-500/10 text-slate-300 border-white/10', dot: 'bg-slate-400' };
    return (
      <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none', t.cls)}>
        <span className={cx('h-1.5 w-1.5 rounded-full', t.dot)} />
        {t.label}
      </span>
    );
  };

  const hasFiles = Boolean(bankFile || ledgerFile || invoicesFile);
  const inputCls =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/20';
  const selectCls =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-medium text-slate-200 outline-none transition focus:border-indigo-400/60 focus:bg-white/[0.06] focus:ring-2 focus:ring-indigo-500/20 cursor-pointer';

  return (
    <div className="relative flex min-h-screen overflow-hidden text-slate-200 selection:bg-indigo-500/30">
      <div className="pointer-events-none fixed inset-0 bg-aurora" />
      <div className="pointer-events-none fixed inset-0 bg-grid" />

      {/* ChatGPT-like sidebar - session history */}
      <aside className={cx('relative z-30 flex shrink-0 flex-col border-r border-white/[0.06] bg-[#070a12]/90 backdrop-blur-xl transition-all duration-300', sidebarOpen ? 'w-[300px]' : 'w-0 overflow-hidden border-r-0')}>
        <div className="flex h-[64px] shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-indigo-500 to-violet-500 text-white"><History className="h-4 w-4" /></div>
            <span className="text-sm font-bold text-white">Sessions</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">{sessions.length}</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-3">
          <button onClick={handleNewChat} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/10">
            <Plus className="h-4 w-4" /> New reconciliation
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {sessions.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center">
              <MessageSquare className="mx-auto h-6 w-6 text-slate-600" />
              <p className="mt-2 text-xs font-semibold text-slate-400">No sessions yet</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">Run a reconciliation and it will appear here like a ChatGPT chat — click to restore.</p>
            </div>
          )}
          <div className="space-y-2">
            {sessions.map(s => {
              const isActive = results?.batch_id === s.batch_id;
              return (
                <button key={s.batch_id} onClick={() => handleLoadSession(s.batch_id)} className={cx('group flex w-full flex-col rounded-xl border px-3 py-3 text-left transition', isActive ? 'border-indigo-400/40 bg-indigo-500/15' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10')}>
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={cx('truncate font-mono text-xs font-bold', isActive ? 'text-white' : 'text-slate-200')}>{s.batch_id}</span>
                    <span onClick={(e) => handleDeleteSession(s.batch_id, e)} className="hidden rounded-md p-1 text-slate-500 hover:bg-white/10 hover:text-rose-300 group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="h-3 w-3" /><span>{formatTime(s.saved_at)}</span><span>·</span><span>{s.total_records} rec</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">{s.metrics?.matched_records || 0} matched</span>
                    {s.metrics?.f1 != null && <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">F1 {(s.metrics.f1*100).toFixed(0)}%</span>}
                    {s.metrics?.exceptions != null && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-300">{s.metrics.exceptions} exc</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div className="border-t border-white/[0.06] p-3 text-[11px] text-slate-500">
          <p className="flex items-center gap-1.5"><ShieldCheck className="h-3 w-3 text-emerald-400" /> Sessions persist on server + browser</p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#070a12]/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-[64px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {!sidebarOpen && (
                <button onClick={() => setSidebarOpen(true)} className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white"><Menu className="h-4 w-4" /></button>
              )}
              <div className="relative shrink-0">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 opacity-60 blur-lg" />
                <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20">
                  <Layers className="h-5 w-5" />
                </div>
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-[15px] font-extrabold tracking-tight text-white">AI Finance Controller</h1>
                <p className="hidden truncate text-[11px] font-medium text-slate-400 sm:block">Autonomous multi-source reconciliation</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => setActiveTab('ingest')}
                className={cx(
                  'inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all focus-ring cursor-pointer',
                  activeTab === 'ingest'
                    ? 'bg-white text-slate-900 shadow'
                    : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white'
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
                      ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white'
                  )}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Dashboard</span>
                </button>
              )}
              {!sidebarOpen && sessions.length > 0 && (
                <button onClick={() => setSidebarOpen(true)} className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 sm:flex">
                  <History className="h-3.5 w-3.5" /> {sessions.length}
                </button>
              )}
            </div>
          </div>

          <nav className="scrollbar-none flex gap-1 overflow-x-auto border-t border-white/[0.04] py-2">
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
                      ? 'cursor-not-allowed text-slate-600'
                      : isActive
                        ? 'bg-white/10 text-white ring-1 ring-white/10 cursor-pointer'
                        : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200 cursor-pointer'
                  )}
                >
                  <span className={cx('flex h-5 w-5 items-center justify-center rounded-md text-[11px]', isActive ? 'bg-white text-slate-900' : 'bg-white/5 text-slate-400 group-hover:bg-white/10')}>
                    {tab.sub}
                  </span>
                  <Icon className={cx('h-3.5 w-3.5', isActive ? 'text-indigo-300' : 'text-slate-500')} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        {error && (
          <div className="animate-fade-in flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3.5 text-sm backdrop-blur">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-rose-500/20 text-rose-300">
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold tracking-wide text-rose-200">Reconciliation error</p>
              <p className="mt-1 text-xs leading-relaxed text-rose-200/80">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="rounded-lg p-1 text-rose-300/70 hover:bg-white/10 hover:text-rose-200 cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading && (
          <div className="glass animate-fade-in flex flex-col items-center justify-center gap-4 rounded-3xl px-8 py-12 text-center">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-indigo-400 border-r-violet-400" style={{ animationDuration: '0.9s' }} />
              <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-indigo-500/20 to-violet-500/20 blur-[1px]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Reconciling financial records…</h3>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-slate-400">Normalizing schemas, finding candidate pairs, executing multi-tier matching rules, and evaluating AI evidence.</p>
            </div>
            <div className="h-1 w-48 overflow-hidden rounded-full bg-white/10">
              <div className="h-full w-1/2 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-transparent via-indigo-400 to-transparent bg-[length:200%_100%]" />
            </div>
          </div>
        )}

        {activeTab === 'ingest' && (
          <div className="animate-fade-up space-y-6">
            {results && (
              <div className="flex items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                  <div>
                    <p className="text-xs font-bold text-white">Session active: {results.batch_id}</p>
                    <p className="text-[11px] text-emerald-200/80">{results.total_records} records · {formatPercent(results.metrics.raw_match_rate)} matched — dashboard preserved like ChatGPT</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('dashboard')} className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-slate-100">View dashboard →</button>
              </div>
            )}
            <div className="glass overflow-hidden rounded-3xl">
              <div className="relative overflow-hidden p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-gradient-to-tr from-indigo-500/15 via-violet-500/15 to-fuchsia-500/10 blur-2xl" />
                <div className="relative flex flex-wrap items-start justify-between gap-4">
                  <div className="max-w-2xl">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-300">
                      <Sparkles className="h-3 w-3" />
                      AI-powered matching engine
                      <span className="ml-1 hidden rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-indigo-200 sm:inline">AUTO · FUZZY · LLM</span>
                    </span>
                    <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-[30px] sm:leading-none">
                      Reconcile your books in <span className="text-gradient">one pass</span>
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
                      Drop in CSVs from your bank, ledger, or billing system. The engine auto-detects columns, normalizes amounts &amp; dates, and links transactions across sources. Sessions persist like ChatGPT — reload and your dashboard stays.
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1"><ShieldCheck className="h-3 w-3 text-emerald-400" /> No data stored</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1"><FileSpreadsheet className="h-3 w-3 text-sky-400" /> CSV auto-mapping</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1"><History className="h-3 w-3 text-indigo-400" /> ChatGPT-like history</span>
                    </div>
                  </div>
                  {results && (
                    <div className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 sm:flex">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/20">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Last run · {results.batch_id}</p>
                        <p className="text-[11px] text-slate-400">{results.total_records} records · {formatPercent(results.metrics.raw_match_rate)} matched</p>
                      </div>
                    </div>
                  )}
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
                        chip: 'bg-indigo-500/15 text-indigo-300 ring-indigo-400/20',
                        active: 'border-indigo-400/40 bg-indigo-500/[0.06]',
                        idle: 'hover:border-indigo-400/30 hover:bg-indigo-500/[0.03]',
                      },
                      {
                        key: 'ledger',
                        file: ledgerFile,
                        setter: setLedgerFile,
                        id: 'ledger-file',
                        icon: FileSpreadsheet,
                        title: 'General Ledger',
                        desc: 'QuickBooks, Xero & ERP journals',
                        chip: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/20',
                        active: 'border-emerald-400/40 bg-emerald-500/[0.06]',
                        idle: 'hover:border-emerald-400/30 hover:bg-emerald-500/[0.03]',
                      },
                      {
                        key: 'inv',
                        file: invoicesFile,
                        setter: setInvoicesFile,
                        id: 'invoice-file',
                        icon: Receipt,
                        title: 'Invoices',
                        desc: 'Billing & AP/AR items · optional',
                        chip: 'bg-amber-500/15 text-amber-300 ring-amber-400/20',
                        active: 'border-amber-400/40 bg-amber-500/[0.06]',
                        idle: 'hover:border-amber-400/30 hover:bg-amber-500/[0.03]',
                      },
                    ].map((s) => {
                      const Icon = s.icon;
                      return (
                        <div
                          key={s.key}
                          className={cx(
                            'group relative flex flex-col justify-between rounded-2xl border-2 border-dashed p-5 text-center transition-all duration-200',
                            s.file ? cx('border-solid', s.active) : cx('border-white/10 bg-white/[0.015]', s.idle)
                          )}
                        >
                          <div>
                            <div className={cx('mx-auto flex h-11 w-11 items-center justify-center rounded-xl ring-1', s.file ? 'bg-white text-slate-900' : s.chip)}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <h4 className="mt-3 text-sm font-bold text-white">{s.title}</h4>
                            <p className="mt-1 text-xs text-slate-400">{s.desc}</p>
                          </div>
                          <div className="mt-5">
                            {s.file ? (
                              <div className="flex items-center justify-between gap-2 rounded-xl border bg-black/20 px-3 py-2.5 text-xs font-medium backdrop-blur">
                                <span className="min-w-0 truncate text-slate-200">{s.file.name}</span>
                                <button type="button" onClick={() => s.setter(null)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/10 text-slate-400 hover:bg-white/15 hover:text-white cursor-pointer">
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <input type="file" id={s.id} accept=".csv,text/csv" onChange={(e) => s.setter(e.target.files?.[0] || null)} className="hidden" />
                                <label htmlFor={s.id} className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-white/10">
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

                  <div className="grid grid-cols-1 gap-4 border-t border-white/[0.06] pt-6 sm:grid-cols-3">
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-300">Bank opening balance</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                        <input type="number" step="0.01" value={bankOpening} onChange={(e) => setBankOpening(parseFloat(e.target.value) || 0)} className={cx(inputCls, 'pl-7')} placeholder="0.00" />
                      </div>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-300">Ledger opening balance</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">$</span>
                        <input type="number" step="0.01" value={ledgerOpening} onChange={(e) => setLedgerOpening(parseFloat(e.target.value) || 0)} className={cx(inputCls, 'pl-7')} placeholder="0.00" />
                      </div>
                    </label>
                    <label className="space-y-1.5">
                      <span className="text-xs font-semibold text-slate-300">Matching engine</span>
                      <select value={matchingStrategy} onChange={(e) => setMatchingStrategy(e.target.value)} className={selectCls}>
                        <option value="auto">Adaptive Hybrid — deterministic + AI</option>
                        <option value="gemini">AI Reasoner priority</option>
                        <option value="off">Deterministic only — no AI</option>
                      </select>
                    </label>
                  </div>

                  <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-white/[0.06] pt-6 sm:flex-row sm:items-center">
                    <button type="button" onClick={handleRunSampleData} disabled={loading} className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 underline decoration-white/20 underline-offset-4 hover:text-indigo-300 hover:decoration-indigo-400/40 disabled:opacity-50 cursor-pointer">
                      <Database className="h-3.5 w-3.5" />
                      Or try with a sample benchmark dataset
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !hasFiles}
                      className={cx(
                        'inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-all focus-ring cursor-pointer',
                        !hasFiles
                          ? 'cursor-not-allowed border border-white/10 bg-white/5 text-slate-500'
                          : 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-400 hover:to-violet-400 hover:shadow-indigo-500/30'
                      )}
                    >
                      <Play className="h-4 w-4" />
                      Run reconciliation
                      <ArrowRight className="h-4 w-4 opacity-70" />
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { title: 'Auto column mapping', desc: 'Dates, currencies, references & descriptions are detected and cleaned automatically.', icon: Sparkles, accent: 'indigo' },
                { title: 'Three-tier matching', desc: 'Exact → fuzzy scoring → AI reasoner with confidence gating.', icon: Layers, accent: 'violet' },
                { title: 'Auditable by design', desc: 'Every match and exception carries evidence + a full JSON trail.', icon: ShieldCheck, accent: 'emerald' },
              ].map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                    <div className={cx('flex h-8 w-8 items-center justify-center rounded-xl ring-1', ACCENTS[f.accent].chip)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <h4 className="mt-3 text-xs font-bold text-white">{f.title}</h4>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{f.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'dashboard' && results && (
          <div className="animate-fade-up space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Match rate"
                accent="emerald"
                icon={CheckCircle2}
                value={formatPercent(results.metrics.raw_match_rate)}
                badge={
                  results.metrics.has_ground_truth ? (
                    <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300">{formatPercent(results.metrics.validated_match_rate)} validated</span>
                  ) : null
                }
                sub={`${results.metrics.matched_records} of ${results.total_records} records reconciled`}
              />
              <StatCard
                label="Accuracy · F1"
                accent="indigo"
                icon={TrendingUp}
                value={results.metrics.f1 !== null ? formatPercent(results.metrics.f1) : 'N/A'}
                badge={<span className="text-[11px] font-medium text-slate-400">P {results.metrics.precision !== null ? formatPercent(results.metrics.precision) : 'N/A'}</span>}
                sub={`Recall ${results.metrics.recall !== null ? formatPercent(results.metrics.recall) : 'N/A'} · needs ground truth`}
              />
              <StatCard
                label="Exception exposure"
                accent="rose"
                icon={AlertCircle}
                value={formatMoney(results.cash_position.exception_exposure_total)}
                sub={`${results.exceptions.length} unresolved · flagged for review`}
              />
              <StatCard
                label="Reconciled variance"
                accent="sky"
                icon={DollarSign}
                value={formatMoney(results.cash_position.reconciled_difference)}
                sub="Bank cash vs. ledger delta"
              />
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="glass rounded-3xl p-6 lg:col-span-2">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] pb-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/20">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Cash-position snapshot</h3>
                      <p className="text-xs text-slate-400">Live bank vs. ledger liquidity</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">Reconciled</span>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Confirmed bank cash</p>
                    <p className="mt-2 text-2xl font-extrabold tracking-tight text-white tabular-nums">{formatMoney(results.cash_position.confirmed_bank_cash)}</p>
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400"><span>Opening balance</span><span className="font-semibold text-slate-200 tabular-nums">{formatMoney(results.cash_position.bank_opening)}</span></div>
                      <div className="flex justify-between text-slate-400"><span>Matched movements</span><span className="font-semibold text-emerald-300 tabular-nums">+{formatMoney(results.cash_position.matched_bank_movements)}</span></div>
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Confirmed ledger cash</p>
                    <p className="mt-2 text-2xl font-extrabold tracking-tight text-white tabular-nums">{formatMoney(results.cash_position.confirmed_ledger_cash)}</p>
                    <div className="mt-4 space-y-1.5 text-xs">
                      <div className="flex justify-between text-slate-400"><span>Opening balance</span><span className="font-semibold text-slate-200 tabular-nums">{formatMoney(results.cash_position.ledger_opening)}</span></div>
                      <div className="flex justify-between text-slate-400"><span>Matched movements</span><span className="font-semibold text-emerald-300 tabular-nums">+{formatMoney(results.cash_position.matched_ledger_movements)}</span></div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-xs">
                  <span className="font-semibold text-slate-300">Exposure by source</span>
                  <div className="flex flex-wrap gap-4">
                    <span className="text-slate-400">Bank <strong className="font-bold text-rose-300 tabular-nums">{formatMoney(results.cash_position.exception_exposure_by_source?.bank || 0)}</strong></span>
                    <span className="text-slate-400">Ledger <strong className="font-bold text-rose-300 tabular-nums">{formatMoney(results.cash_position.exception_exposure_by_source?.ledger || 0)}</strong></span>
                    <span className="text-slate-400">Invoices <strong className="font-bold text-rose-300 tabular-nums">{formatMoney(results.cash_position.exception_exposure_by_source?.invoice || 0)}</strong></span>
                  </div>
                </div>
              </div>

              <div className="glass flex flex-col justify-between rounded-3xl p-6">
                <div>
                  <h3 className="text-sm font-bold text-white">Resolution breakdown</h3>
                  <p className="text-xs text-slate-400">Distribution across tiers</p>
                  <div className="mt-6 space-y-4">
                    {[
                      { label: 'Tier 1 · Exact', value: results.metrics.method_counts.exact, color: 'bg-emerald-500', text: 'text-emerald-300' },
                      { label: 'Tier 2 · Fuzzy', value: results.metrics.method_counts.fuzzy, color: 'bg-amber-500', text: 'text-amber-300' },
                      { label: 'Tier 3 · AI', value: results.metrics.method_counts.llm, color: 'bg-indigo-500', text: 'text-indigo-300' },
                      { label: 'Exceptions', value: results.exceptions.length, color: 'bg-rose-500', text: 'text-rose-300' },
                    ].map((r) => {
                      const pct = results.total_records ? (r.value / results.total_records) * 100 : 0;
                      return (
                        <div key={r.label}>
                          <div className="mb-1.5 flex justify-between text-xs font-semibold"><span className={r.text}>{r.label}</span><span className="tabular-nums text-white">{r.value}</span></div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/10">
                            <div className={cx('h-full rounded-full transition-all duration-700', r.color)} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-white/[0.06] pt-4 text-xs">
                  <span className="truncate font-mono text-slate-400">Batch <strong className="font-semibold text-slate-200">{results.batch_id}</strong></span>
                  <button onClick={() => setActiveTab('exceptions')} className="inline-flex shrink-0 items-center gap-1 font-semibold text-indigo-300 hover:text-indigo-200 cursor-pointer">
                    View exceptions <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'exceptions' && results && (
          <div className="glass animate-fade-up space-y-5 rounded-3xl p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Exception triage</h3>
                <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-400">Every unresolved transaction cataloged with root cause and the next best candidate — nothing falls through the cracks.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input type="text" placeholder="Search ID or explanation…" value={exceptionSearch} onChange={(e) => setExceptionSearch(e.target.value)} className="w-44 rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-400/50 focus:bg-white/[0.06] sm:w-56" />
                </div>
                <select value={exceptionFilter} onChange={(e) => setExceptionFilter(e.target.value)} className="rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 text-xs font-medium text-slate-200 outline-none focus:border-indigo-400/50 cursor-pointer">
                  <option value="ALL" className="bg-[#0b0f1d]">All categories</option>
                  <option value="POSSIBLE_DUPLICATE" className="bg-[#0b0f1d]">Double-Post</option>
                  <option value="DUPLICATE_CANDIDATE" className="bg-[#0b0f1d]">Near-Tie</option>
                  <option value="LOW_CONFIDENCE" className="bg-[#0b0f1d]">Low Confidence</option>
                  <option value="NO_COUNTERPART" className="bg-[#0b0f1d]">Unmatched</option>
                  <option value="AMOUNT_MISMATCH" className="bg-[#0b0f1d]">Amount Variance</option>
                </select>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/[0.06]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.04] text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      <th className="px-4 py-3">Record ID</th>
                      <th className="px-3 py-3">Source</th>
                      <th className="px-4 py-3">Diagnosis</th>
                      <th className="px-4 py-3">Best candidate</th>
                      <th className="px-3 py-3">Confidence</th>
                      <th className="px-4 py-3">Explanation</th>
                      <th className="px-3 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {filteredExceptions.map((item, idx) => (
                      <tr key={idx} className="transition-colors hover:bg-white/[0.03]">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-white">{item.record_id}</td>
                        <td className="px-3 py-3 capitalize text-slate-300">{item.source}</td>
                        <td className="px-4 py-3">{getReasonBadge(item.reason)}</td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400">{item.best_candidate_id ? `${item.best_candidate_id} · ${item.best_candidate_source}` : '—'}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-white/10">
                              <div className={cx('h-full rounded-full', item.confidence > 0.8 ? 'bg-emerald-400' : item.confidence > 0.5 ? 'bg-amber-400' : 'bg-rose-400')} style={{ width: `${(item.confidence * 100).toFixed(0)}%` }} />
                            </div>
                            <span className="font-semibold tabular-nums text-slate-200">{(item.confidence * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="max-w-[360px] px-4 py-3 leading-relaxed text-slate-300">{item.explanation}</td>
                        <td className="px-3 py-3"><span className="inline-flex rounded-full border border-indigo-400/20 bg-indigo-500/10 px-2.5 py-1 text-[11px] font-semibold text-indigo-300">{item.recommended_action}</span></td>
                      </tr>
                    ))}
                    {filteredExceptions.length === 0 && (
                      <tr><td colSpan={7} className="py-12 text-center text-slate-500">No exceptions match your filters.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'clusters' && results && (
          <div className="glass animate-fade-up space-y-5 rounded-3xl p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Reconciled groups</h3>
                <p className="mt-1 text-xs text-slate-400">Linked transaction clusters across bank, ledger, and invoices.</p>
              </div>
              <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input type="text" placeholder="Search group or reference…" value={clusterSearch} onChange={(e) => setClusterSearch(e.target.value)} className="w-64 rounded-xl border border-white/10 bg-white/[0.04] py-2 pl-8 pr-3 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-400/50 focus:bg-white/[0.06]" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredClusters.map((cluster, idx) => (
                <div key={idx} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.05]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-white">{cluster.group_id}</span>
                      {getMethodBadge(cluster.method)}
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-slate-300">{cluster.count} linked</span>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {cluster.members.map((m, mIdx) => (
                      <div key={mIdx} className="flex flex-col justify-between rounded-xl border border-white/[0.06] bg-black/20 p-3">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-white">{m.record_id}</span>
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">{m.source}</span>
                          </div>
                          <p className="mt-1.5 truncate text-[11px] leading-relaxed text-slate-400">{m.description || m.counterparty || 'No description'}</p>
                        </div>
                        <div className="mt-3 flex items-baseline justify-between border-t border-white/[0.06] pt-2">
                          <span className="font-mono text-[11px] text-slate-500">{m.date}</span>
                          <span className="text-xs font-extrabold tabular-nums text-white">{formatMoney(m.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filteredClusters.length === 0 && <p className="rounded-xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">No groups match your search.</p>}
            </div>
          </div>
        )}

        {activeTab === 'audit' && results && (
          <div className="glass animate-fade-up space-y-4 rounded-3xl p-6">
            <div>
              <h3 className="text-base font-bold text-white">Audit trail</h3>
              <p className="mt-1 text-xs text-slate-400">Every stage, gate, and decision — fully traceable for auditors.</p>
            </div>
            <div className="max-h-[28rem] space-y-2 overflow-y-auto rounded-2xl border border-white/[0.06] bg-black/30 p-3 font-mono text-[11px]">
              {(results.audit_trail || []).map((entry, idx) => (
                <div key={idx} className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-3">
                  <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span className="font-mono tabular-nums">{entry.ts}</span>
                    <span className="rounded bg-indigo-500/15 px-1.5 py-1 font-bold uppercase tracking-wide text-indigo-300 ring-1 ring-indigo-400/20">{entry.stage} · {entry.event}</span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all text-[11px] leading-relaxed text-slate-300">{JSON.stringify(entry.detail, null, 2)}</pre>
                </div>
              ))}
              {(!results.audit_trail || results.audit_trail.length === 0) && <p className="py-8 text-center font-sans text-xs text-slate-500">No audit events recorded.</p>}
            </div>
          </div>
        )}

        {activeTab === 'export' && results && (
          <div className="glass animate-fade-up space-y-6 rounded-3xl p-6">
            <div>
              <h3 className="text-base font-bold text-white">Export & reporting</h3>
              <p className="mt-1 text-xs text-slate-400">Auditable packs for finance ops, auditors, or ERP write-back.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: '/api/download/markdown', icon: FileText, title: 'Executive report', desc: 'Markdown summary with cash snapshot.', cta: 'Download .md', chip: ACCENTS.indigo.chip, line: ACCENTS.indigo.line, iconColor: 'text-indigo-300' },
                { href: '/api/download/csv', icon: FileSpreadsheet, title: 'Exceptions CSV', desc: 'Unresolved transactions spreadsheet.', cta: 'Download .csv', chip: ACCENTS.emerald.chip, line: ACCENTS.emerald.line, iconColor: 'text-emerald-300' },
                { href: '/api/download/json', icon: FileCheck, title: 'ERP payload', desc: 'Machine-readable JSON for write-back.', cta: 'Download .json', chip: ACCENTS.sky.chip, line: ACCENTS.sky.line, iconColor: 'text-sky-300' },
                { href: '/api/download/audit', icon: ShieldCheck, title: 'Audit trail', desc: 'Full verification & reasoning log.', cta: 'Download log', chip: ACCENTS.violet.chip, line: ACCENTS.violet.line, iconColor: 'text-violet-300' },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <a key={card.href} href={card.href} target="_blank" rel="noreferrer" className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.03] p-5 transition-all hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.05]">
                    <div className={cx('pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent', card.line)} />
                    <div>
                      <div className={cx('flex h-9 w-9 items-center justify-center rounded-xl', card.chip)}>
                        <Icon className={cx('h-5 w-5', card.iconColor)} />
                      </div>
                      <h4 className="mt-3 text-sm font-bold text-white">{card.title}</h4>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">{card.desc}</p>
                    </div>
                    <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-white">
                      <span className="underline decoration-white/20 underline-offset-4 group-hover:decoration-white/40">{card.cta}</span>
                      <ArrowRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </a>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-4 py-3 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">Batch</span>
              <span className="rounded bg-white/10 px-2 py-1 font-mono text-white">{results.batch_id}</span>
              <span className="hidden sm:inline">·</span>
              <span>{results.total_records} records · {results.metrics.matched_records} matched · {results.exceptions.length} exceptions</span>
            </div>
          </div>
        )}
      </main>

      <footer className="relative border-t border-white/[0.06] py-5">
        <div className="mx-auto max-w-7xl px-4 text-center text-[11px] font-medium tracking-wide text-slate-500 sm:px-6 lg:px-8">
          AI Finance Controller · Autonomous financial operations & multi-source reconciliation
        </div>
      </footer>
      </div>
    </div>
  );
}
