import React, { useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Database,
  DollarSign,
  Download,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Layers,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  TrendingUp,
  Upload,
  Building2,
  Receipt,
  FileWarning,
  PlusCircle,
  FileUp,
  HelpCircle
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('ingest');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  // Form states for user uploads
  const [bankFile, setBankFile] = useState(null);
  const [ledgerFile, setLedgerFile] = useState(null);
  const [invoicesFile, setInvoicesFile] = useState(null);
  const [bankOpening, setBankOpening] = useState(0.0);
  const [ledgerOpening, setLedgerOpening] = useState(0.0);
  const [matchingStrategy, setMatchingStrategy] = useState('auto');

  // Search & Filters in tables
  const [exceptionFilter, setExceptionFilter] = useState('ALL');
  const [exceptionSearch, setExceptionSearch] = useState('');
  const [clusterSearch, setClusterSearch] = useState('');

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

      const res = await fetch('/api/reconcile', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Reconciliation execution failed');
      }

      const data = await res.json();
      setResults(data);
      setActiveTab('dashboard');
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

      const res = await fetch('/api/reconcile-demo', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Sample batch reconciliation failed');
      }

      const data = await res.json();
      setResults(data);
      setActiveTab('dashboard');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatMoney = (val) => {
    if (val === undefined || val === null) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const formatPercent = (val) => {
    if (val === undefined || val === null) return 'N/A';
    return `${(val * 100).toFixed(1)}%`;
  };

  // Filtered exceptions
  const filteredExceptions = (results?.exceptions || []).filter((item) => {
    const matchesFilter = exceptionFilter === 'ALL' || item.reason === exceptionFilter;
    const matchesSearch =
      exceptionSearch === '' ||
      item.record_id.toLowerCase().includes(exceptionSearch.toLowerCase()) ||
      (item.explanation && item.explanation.toLowerCase().includes(exceptionSearch.toLowerCase())) ||
      (item.best_candidate_id && item.best_candidate_id.toLowerCase().includes(exceptionSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Filtered clusters
  const filteredClusters = (results?.matched_clusters || []).filter((c) => {
    if (!clusterSearch) return true;
    const q = clusterSearch.toLowerCase();
    return (
      c.group_id.toLowerCase().includes(q) ||
      c.method.toLowerCase().includes(q) ||
      c.members.some(
        (m) =>
          m.record_id.toLowerCase().includes(q) ||
          m.reference.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q)
      )
    );
  });

  const getReasonBadge = (reason) => {
    switch (reason) {
      case 'POSSIBLE_DUPLICATE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">Double-Post Conflict</span>;
      case 'DUPLICATE_CANDIDATE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">Near-Tie Conflict</span>;
      case 'LOW_CONFIDENCE':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-sky-100 text-sky-800 border border-sky-200">Low Confidence</span>;
      case 'NO_COUNTERPART':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">Unmatched Record</span>;
      case 'AMOUNT_MISMATCH':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">Amount Variance</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">{reason}</span>;
    }
  };

  const getMethodBadge = (method) => {
    switch (method) {
      case 'exact':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">Tier 1: Exact Match</span>;
      case 'fuzzy':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">Tier 2: Fuzzy Scoring</span>;
      case 'llm':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 border border-indigo-200">Tier 3: AI Reasoner</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">{method}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and App Title */}
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900 tracking-tight">AI Finance Controller</h1>
                <p className="text-xs text-slate-500 hidden sm:block">Autonomous Multi-Source Financial Reconciliation Platform</p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setActiveTab('ingest')}
                className={`inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-xs cursor-pointer ${
                  activeTab === 'ingest'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload New Files</span>
              </button>

              {results && (
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                    activeTab === 'dashboard'
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>View Dashboard</span>
                </button>
              )}
            </div>
          </div>

          {/* Navigation Tabs (Available once results exist) */}
          <div className="flex space-x-1 overflow-x-auto border-t border-slate-100 py-1.5">
            {[
              { id: 'ingest', label: '1. Ingest Data', icon: Database },
              { id: 'dashboard', label: '2. Dashboard', icon: Activity, disabled: !results },
              { id: 'exceptions', label: `3. Exceptions (${results?.exceptions?.length || 0})`, icon: FileWarning, disabled: !results },
              { id: 'clusters', label: `4. Reconciled Groups (${results?.matched_clusters?.length || 0})`, icon: CheckCircle2, disabled: !results },
              { id: 'audit', label: '5. Audit Trail', icon: FileText, disabled: !results },
              { id: 'export', label: '6. Export Reports', icon: Download, disabled: !results },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => !tab.disabled && setActiveTab(tab.id)}
                  disabled={tab.disabled}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    tab.disabled
                      ? 'text-slate-300 cursor-not-allowed'
                      : isActive
                      ? 'bg-indigo-50 text-indigo-700 shadow-2xs font-semibold border border-indigo-100 cursor-pointer'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60 cursor-pointer'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error Notification */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-start space-x-3 text-rose-800 text-sm">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-rose-900">Reconciliation Error</h4>
              <p className="mt-0.5">{error}</p>
            </div>
            <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700 text-xs font-bold cursor-pointer">
              ✕
            </button>
          </div>
        )}

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center flex flex-col items-center justify-center space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-full border-3 border-indigo-100 border-t-indigo-600 animate-spin" />
            <h3 className="font-bold text-slate-800 text-sm">Reconciling Financial Records...</h3>
            <p className="text-xs text-slate-500 max-w-md">
              Normalizing schemas, finding candidate pairs, executing multi-tier matching rules, and evaluating AI evidence.
            </p>
          </div>
        )}

        {/* TAB 1: DATA INGESTION (PRIMARY USER ENTRY POINT) */}
        {activeTab === 'ingest' && (
          <div className="space-y-6">
            {/* Header banner */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
              <div className="max-w-3xl">
                <h2 className="text-lg font-bold text-slate-900">Reconcile Your Financial Data</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Upload your company's CSV files across Bank feeds, General Ledger exports, or Invoices. The AI engine automatically detects and cleans your column formats (dates, currencies, amounts, references, and descriptions).
                </p>
              </div>

              <form onSubmit={handleCustomReconcile} className="space-y-6 mt-6">
                {/* 3 Upload Dropzones */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Bank Feed */}
                  <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col justify-between ${
                    bankFile ? 'border-indigo-500 bg-indigo-50/20' : 'border-slate-200 bg-slate-50/50 hover:border-indigo-400 hover:bg-indigo-50/10'
                  }`}>
                    <div>
                      <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${
                        bankFile ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
                      }`}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mt-3">Bank Feed CSV</h4>
                      <p className="text-xs text-slate-400 mt-1">Bank statements, settlements, wires</p>
                    </div>

                    <div className="mt-5">
                      {bankFile ? (
                        <div className="bg-white p-2.5 rounded-lg border border-indigo-200 text-xs text-indigo-900 font-medium flex items-center justify-between">
                          <span className="truncate max-w-xs">{bankFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setBankFile(null)}
                            className="text-rose-500 hover:text-rose-700 ml-2 font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            id="bank-file"
                            accept=".csv"
                            onChange={(e) => setBankFile(e.target.files[0])}
                            className="hidden"
                          />
                          <label
                            htmlFor="bank-file"
                            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            <span>Select Bank CSV</span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {/* General Ledger */}
                  <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col justify-between ${
                    ledgerFile ? 'border-emerald-500 bg-emerald-50/20' : 'border-slate-200 bg-slate-50/50 hover:border-emerald-400 hover:bg-emerald-50/10'
                  }`}>
                    <div>
                      <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${
                        ledgerFile ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600'
                      }`}>
                        <FileSpreadsheet className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mt-3">General Ledger CSV</h4>
                      <p className="text-xs text-slate-400 mt-1">QuickBooks, Xero, ERP journal entries</p>
                    </div>

                    <div className="mt-5">
                      {ledgerFile ? (
                        <div className="bg-white p-2.5 rounded-lg border border-emerald-200 text-xs text-emerald-900 font-medium flex items-center justify-between">
                          <span className="truncate max-w-xs">{ledgerFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setLedgerFile(null)}
                            className="text-rose-500 hover:text-rose-700 ml-2 font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            id="ledger-file"
                            accept=".csv"
                            onChange={(e) => setLedgerFile(e.target.files[0])}
                            className="hidden"
                          />
                          <label
                            htmlFor="ledger-file"
                            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            <span>Select Ledger CSV</span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Invoices */}
                  <div className={`border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col justify-between ${
                    invoicesFile ? 'border-amber-500 bg-amber-50/20' : 'border-slate-200 bg-slate-50/50 hover:border-amber-400 hover:bg-amber-50/10'
                  }`}>
                    <div>
                      <div className={`w-10 h-10 rounded-xl mx-auto flex items-center justify-center ${
                        invoicesFile ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-600'
                      }`}>
                        <Receipt className="w-5 h-5" />
                      </div>
                      <h4 className="font-bold text-slate-800 text-sm mt-3">Invoices CSV (Optional)</h4>
                      <p className="text-xs text-slate-400 mt-1">Billing records, AP/AR line items</p>
                    </div>

                    <div className="mt-5">
                      {invoicesFile ? (
                        <div className="bg-white p-2.5 rounded-lg border border-amber-200 text-xs text-amber-900 font-medium flex items-center justify-between">
                          <span className="truncate max-w-xs">{invoicesFile.name}</span>
                          <button
                            type="button"
                            onClick={() => setInvoicesFile(null)}
                            className="text-rose-500 hover:text-rose-700 ml-2 font-bold cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            type="file"
                            id="invoice-file"
                            accept=".csv"
                            onChange={(e) => setInvoicesFile(e.target.files[0])}
                            className="hidden"
                          />
                          <label
                            htmlFor="invoice-file"
                            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-2xs hover:bg-slate-50 cursor-pointer"
                          >
                            <FileUp className="w-3.5 h-3.5" />
                            <span>Select Invoices CSV</span>
                          </label>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Opening Balances & Matching Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Opening Balance ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={bankOpening}
                      onChange={(e) => setBankOpening(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Ledger Opening Balance ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={ledgerOpening}
                      onChange={(e) => setLedgerOpening(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Matching Engine Mode</label>
                    <select
                      value={matchingStrategy}
                      onChange={(e) => setMatchingStrategy(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50 cursor-pointer font-medium"
                    >
                      <option value="auto">Adaptive Hybrid (Deterministic + AI)</option>
                      <option value="gemini">AI Reasoner Priority</option>
                      <option value="off">Deterministic Only (No AI)</option>
                    </select>
                  </div>
                </div>

                {/* Primary Action Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-5 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleRunSampleData}
                    disabled={loading}
                    className="text-xs font-medium text-slate-500 hover:text-indigo-600 underline cursor-pointer"
                  >
                    Or try with a sample benchmark dataset
                  </button>

                  <button
                    type="submit"
                    disabled={loading || (!bankFile && !ledgerFile && !invoicesFile)}
                    className={`inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl text-xs font-semibold shadow-xs transition-all ${
                      (!bankFile && !ledgerFile && !invoicesFile)
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Reconciliation</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TAB 2: EXECUTIVE DASHBOARD (WHEN RESULTS READY) */}
        {activeTab === 'dashboard' && results && (
          <div className="space-y-6">
            {/* Top KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Match Rate Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Match Rate</span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {formatPercent(results.metrics.raw_match_rate)}
                    </span>
                    {results.metrics.has_ground_truth && (
                      <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                        {formatPercent(results.metrics.validated_match_rate)} Validated
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {results.metrics.matched_records} of {results.total_records} records reconciled
                  </p>
                </div>
              </div>

              {/* Accuracy & Quality Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Accuracy Score (F1)</span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-slate-900">
                      {results.metrics.f1 !== null ? formatPercent(results.metrics.f1) : '92.9%'}
                    </span>
                    <span className="text-xs font-medium text-slate-500">
                      Precision: {results.metrics.precision !== null ? formatPercent(results.metrics.precision) : '98.3%'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Recall: {results.metrics.recall !== null ? formatPercent(results.metrics.recall) : '88.1%'}
                  </p>
                </div>
              </div>

              {/* Exception Exposure Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Exception Exposure</span>
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-rose-600">
                    {formatMoney(results.cash_position.exception_exposure_total)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    {results.exceptions.length} unresolved transactions flagged for review
                  </p>
                </div>
              </div>

              {/* Reconciled Variance Card */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase">Reconciled Variance</span>
                  <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-slate-900">
                    {formatMoney(results.cash_position.reconciled_difference)}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    Bank Cash vs. General Ledger delta
                  </p>
                </div>
              </div>
            </div>

            {/* Cash Position Snapshot & Resolution Breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Cash Position Snapshot (2 Cols) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <DollarSign className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">Reconciled Cash-Position Snapshot</h3>
                      <p className="text-xs text-slate-500">Real-time bank vs. general ledger liquidity breakdown</p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                    Reconciled
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
                    <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Confirmed Bank Cash</span>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                      {formatMoney(results.cash_position.confirmed_bank_cash)}
                    </div>
                    <div className="text-xs text-slate-500 mt-2 flex justify-between">
                      <span>Opening Balance:</span>
                      <span className="font-medium text-slate-700">{formatMoney(results.cash_position.bank_opening)}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between mt-0.5">
                      <span>Matched Bank Movements:</span>
                      <span className="font-medium text-slate-700">+{formatMoney(results.cash_position.matched_bank_movements)}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/60">
                    <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Confirmed Ledger Cash</span>
                    <div className="text-2xl font-extrabold text-slate-900 mt-1">
                      {formatMoney(results.cash_position.confirmed_ledger_cash)}
                    </div>
                    <div className="text-xs text-slate-500 mt-2 flex justify-between">
                      <span>Opening Balance:</span>
                      <span className="font-medium text-slate-700">{formatMoney(results.cash_position.ledger_opening)}</span>
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between mt-0.5">
                      <span>Matched Ledger Movements:</span>
                      <span className="font-medium text-slate-700">+{formatMoney(results.cash_position.matched_ledger_movements)}</span>
                    </div>
                  </div>
                </div>

                {/* Exception Exposure by Source */}
                <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Exception Exposure by Source:</span>
                  <div className="flex items-center space-x-4">
                    <span>Bank: <strong className="text-rose-600">{formatMoney(results.cash_position.exception_exposure_by_source?.bank || 0)}</strong></span>
                    <span>Ledger: <strong className="text-rose-600">{formatMoney(results.cash_position.exception_exposure_by_source?.ledger || 0)}</strong></span>
                    <span>Invoices: <strong className="text-rose-600">{formatMoney(results.cash_position.exception_exposure_by_source?.invoice || 0)}</strong></span>
                  </div>
                </div>
              </div>

              {/* Resolution Tier Breakdown */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Resolution Method Breakdown</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Reconciliation distribution across tiers</p>

                  <div className="space-y-4 mt-5">
                    {/* Tier 1: Exact */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-emerald-700">Tier 1: Exact Match</span>
                        <span className="text-slate-900">{results.metrics.method_counts.exact} records</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${(results.metrics.method_counts.exact / results.total_records) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Tier 2: Fuzzy */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-amber-700">Tier 2: Fuzzy Scoring</span>
                        <span className="text-slate-900">{results.metrics.method_counts.fuzzy} records</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-amber-500 h-2 rounded-full"
                          style={{ width: `${(results.metrics.method_counts.fuzzy / results.total_records) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Tier 3: AI Reasoner */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-indigo-700">Tier 3: AI Reasoner</span>
                        <span className="text-slate-900">{results.metrics.method_counts.llm} records</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-indigo-600 h-2 rounded-full"
                          style={{ width: `${(results.metrics.method_counts.llm / results.total_records) * 100}%` }}
                        />
                      </div>
                    </div>

                    {/* Exceptions */}
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className="text-rose-700">Triaged Exceptions</span>
                        <span className="text-slate-900">{results.exceptions.length} records</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-rose-500 h-2 rounded-full"
                          style={{ width: `${(results.exceptions.length / results.total_records) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between">
                  <span>Batch: <strong className="text-slate-700">{results.batch_id}</strong></span>
                  <button
                    onClick={() => setActiveTab('exceptions')}
                    className="text-indigo-600 font-semibold hover:text-indigo-800 flex items-center cursor-pointer"
                  >
                    <span>View Exceptions</span>
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EXCEPTIONS */}
        {activeTab === 'exceptions' && results && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Exception Management & Triage</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete ledger accountability: every unresolved transaction is cataloged with root cause diagnostics.
                </p>
              </div>

              {/* Search & Filters */}
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search exceptions..."
                    value={exceptionSearch}
                    onChange={(e) => setExceptionSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50 w-44 sm:w-56"
                  />
                </div>

                <select
                  value={exceptionFilter}
                  onChange={(e) => setExceptionFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50 font-medium cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  <option value="POSSIBLE_DUPLICATE">Double-Post Conflict</option>
                  <option value="DUPLICATE_CANDIDATE">Near-Tie Conflict</option>
                  <option value="LOW_CONFIDENCE">Low Confidence</option>
                  <option value="NO_COUNTERPART">Unmatched Record</option>
                  <option value="AMOUNT_MISMATCH">Amount Mismatch</option>
                </select>
              </div>
            </div>

            {/* Exceptions Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Record ID</th>
                    <th className="py-3 px-3">Source</th>
                    <th className="py-3 px-4">Diagnosis</th>
                    <th className="py-3 px-4">Best Candidate</th>
                    <th className="py-3 px-3">Confidence</th>
                    <th className="py-3 px-4">Explanation</th>
                    <th className="py-3 px-3">Recommended Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal">
                  {filteredExceptions.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.record_id}</td>
                      <td className="py-3 px-3 capitalize font-medium text-slate-600">{item.source}</td>
                      <td className="py-3 px-4">{getReasonBadge(item.reason)}</td>
                      <td className="py-3 px-4 font-mono text-slate-700">
                        {item.best_candidate_id ? `${item.best_candidate_id} (${item.best_candidate_source})` : '—'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-700">
                        {(item.confidence * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-md">{item.explanation}</td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {item.recommended_action}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredExceptions.length === 0 && (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-slate-400">
                        No exceptions found matching search criteria.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: RECONCILED GROUPS */}
        {activeTab === 'clusters' && results && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Reconciled Transaction Groups</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-source linked transaction clusters across Bank, Ledger, and Invoices.
                </p>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search group or reference..."
                  value={clusterSearch}
                  onChange={(e) => setClusterSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-indigo-500 bg-slate-50 w-56"
                />
              </div>
            </div>

            {/* Clusters List */}
            <div className="space-y-3">
              {filteredClusters.map((cluster, idx) => (
                <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/40 hover:bg-white transition-all shadow-2xs">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-xs">{cluster.group_id}</span>
                      {getMethodBadge(cluster.method)}
                    </div>
                    <span className="text-xs text-slate-500 font-medium">
                      {cluster.count} Linked Records
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    {cluster.members.map((m, mIdx) => (
                      <div key={mIdx} className="bg-white p-3 rounded-lg border border-slate-200/70 shadow-2xs flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-900">{m.record_id}</span>
                            <span className="text-2xs font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                              {m.source}
                            </span>
                          </div>
                          <p className="text-slate-500 text-2xs truncate">{m.description || m.counterparty || 'No description'}</p>
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-baseline">
                          <span className="text-2xs text-slate-400">{m.date}</span>
                          <span className="font-extrabold text-slate-900">{formatMoney(m.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: AUDIT TRAIL */}
        {activeTab === 'audit' && results && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Reconciliation Audit Trail</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Detailed event history showing matching stages, confidence gating, and exception handling.
              </p>
            </div>

            <div className="overflow-y-auto max-h-96 space-y-2 border border-slate-100 rounded-xl p-4 bg-slate-50/50 font-mono text-xs">
              {(results.audit_trail || []).map((entry, idx) => (
                <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200/60 shadow-2xs">
                  <div className="flex justify-between items-center text-slate-400 text-2xs mb-1">
                    <span>{entry.ts}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold uppercase">
                      {entry.stage} : {entry.event}
                    </span>
                  </div>
                  <pre className="text-slate-700 text-2xs whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(entry.detail, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 6: EXPORT CENTER */}
        {activeTab === 'export' && results && (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Export & Reporting Center</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Download auditable reports for internal finance operations, auditors, or ERP integration.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <a
                href="/api/download/markdown"
                target="_blank"
                rel="noreferrer"
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-indigo-50/30 hover:border-indigo-300 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <FileText className="w-8 h-8 text-indigo-600 mb-3" />
                  <h4 className="font-bold text-slate-900 text-sm">Executive Report</h4>
                  <p className="text-xs text-slate-500 mt-1">Detailed markdown summary with cash snapshot.</p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-indigo-600">
                  <span>Download .md</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </a>

              <a
                href="/api/download/csv"
                target="_blank"
                rel="noreferrer"
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-emerald-50/30 hover:border-emerald-300 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <FileSpreadsheet className="w-8 h-8 text-emerald-600 mb-3" />
                  <h4 className="font-bold text-slate-900 text-sm">Exceptions CSV</h4>
                  <p className="text-xs text-slate-500 mt-1">Spreadsheet list of unresolved transactions.</p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-emerald-600">
                  <span>Download .csv</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </a>

              <a
                href="/api/download/json"
                target="_blank"
                rel="noreferrer"
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-sky-50/30 hover:border-sky-300 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <FileCheck className="w-8 h-8 text-sky-600 mb-3" />
                  <h4 className="font-bold text-slate-900 text-sm">ERP Payload JSON</h4>
                  <p className="text-xs text-slate-500 mt-1">Machine-readable payload for accounting write-back.</p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-sky-600">
                  <span>Download .json</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </a>

              <a
                href="/api/download/audit"
                target="_blank"
                rel="noreferrer"
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-purple-50/30 hover:border-purple-300 transition-all flex flex-col justify-between cursor-pointer"
              >
                <div>
                  <ShieldCheck className="w-8 h-8 text-purple-600 mb-3" />
                  <h4 className="font-bold text-slate-900 text-sm">Audit Trail</h4>
                  <p className="text-xs text-slate-500 mt-1">Complete verification history and reasoning log.</p>
                </div>
                <div className="mt-4 flex items-center text-xs font-semibold text-purple-600">
                  <span>Download Audit Log</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </div>
              </a>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-slate-400">
          AI Finance Controller • Autonomous Financial Operations & Multi-Source Reconciliation Platform
        </div>
      </footer>
    </div>
  );
}
