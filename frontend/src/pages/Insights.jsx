import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  LineChart as LineChartIcon,
  Minus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import {
  getTrends,
  exportCsv,
  exportPdfReport,
  seedDemoHistory,
  clearDemoHistory,
} from '../api/insights.js';
import { getErrorMessage } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingState from '../components/LoadingState.jsx';

export default function Insights() {
  const { role } = useAuth();
  const [trendsData, setTrendsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [weeks, setWeeks] = useState(8);
  const [includeDemo, setIncludeDemo] = useState(true);
  const [activeTab, setActiveTab] = useState('trends'); // 'trends' | 'rules' | 'recommendations' | 'status'

  const isManager = role === 'manager';

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadInsightsData = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const data = await getTrends(weeks, includeDemo);
        if (!cancelled) {
          setTrendsData(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [weeks, includeDemo, refreshTrigger]);

  const handleExportCsv = async (tableName) => {
    setBusyAction(true);
    setError('');
    try {
      await exportCsv(tableName);
      setNotice(`CSV export for "${tableName}" table downloaded.`);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyAction(false);
    }
  };

  const handleExportPdf = async () => {
    setBusyAction(true);
    setError('');
    try {
      await exportPdfReport();
      setNotice('Executive compliance summary report downloaded.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleDemoHistory = async (action) => {
    setBusyAction(true);
    setError('');
    setNotice('');
    try {
      if (action === 'seed') {
        const res = await seedDemoHistory();
        setNotice(res?.message || '14 synthetic demo drafts loaded across 8 weeks.');
      } else {
        const res = await clearDemoHistory();
        setNotice(res?.message || 'Demo drafts removed from history.');
      }
      await loadInsightsData();
    } catch (err) {
      if (err.response?.status === 409) {
        setError('Demo history already exists in the database.');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setBusyAction(false);
    }
  };

  const weeklyData = useMemo(() => {
    return (trendsData?.weekly || []).map((w) => ({
      ...w,
      shortWeek: w.week_start ? w.week_start.slice(5) : '',
    }));
  }, [trendsData]);

  const topRules = useMemo(() => trendsData?.top_rules || [], [trendsData]);
  const recommendations = useMemo(() => trendsData?.recommendations || [], [trendsData]);
  const totals = useMemo(() => trendsData?.totals || {}, [trendsData]);

  const statusDistribution = useMemo(() => {
    const raw = trendsData?.drafts_by_status || {};
    return Object.entries(raw).map(([key, count]) => ({
      name: key.replaceAll('_', ' '),
      value: count,
    }));
  }, [trendsData]);

  const getTrendBadge = (trend) => {
    if (trend === 'rising') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 border border-rose-200 px-2 py-0.5 text-[11px] font-bold text-rose-800">
          <TrendingUp className="h-3 w-3" />
          Rising
        </span>
      );
    }
    if (trend === 'falling') {
      return (
        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
          <TrendingDown className="h-3 w-3" />
          Falling
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
        <Minus className="h-3 w-3 text-slate-400" />
        Steady
      </span>
    );
  };

  const getRecLevelBadge = (level) => {
    if (level === 'high') {
      return 'bg-rose-100 text-rose-900 border-rose-200';
    }
    if (level === 'medium') {
      return 'bg-amber-100 text-amber-900 border-amber-200';
    }
    return 'bg-sky-100 text-sky-900 border-sky-200';
  };

  return (
    <div className="space-y-6">
      <ErrorMessage message={error} onDismiss={() => setError('')} />

      {notice && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Demo Note Banner above charts per contract_v2 §8:
          "If demo_note is not null, show it above the charts." */}
      {trendsData?.demo_note && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 text-xs text-indigo-950 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-100 p-2 text-indigo-700 shrink-0">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <strong className="font-bold text-indigo-900 block sm:inline mr-2">
                Sample Historical Data Included:
              </strong>
              <span>{trendsData.demo_note}</span>
            </div>
          </div>

          {isManager && (
            <button
              type="button"
              onClick={() => handleToggleDemoHistory('clear')}
              disabled={busyAction}
              className="btn-secondary text-[11px] py-1 px-3 text-rose-700 border-rose-200 hover:bg-rose-50 shrink-0"
              title="Remove sample historical drafts"
            >
              <Trash2 className="h-3 w-3" />
              <span>Remove demo history</span>
            </button>
          )}
        </div>
      )}

      {/* Control bar: Time window, Demo Toggle, Exports */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Time window:</span>
            <select
              value={weeks}
              onChange={(e) => setWeeks(Number(e.target.value))}
              className="field py-1 px-2.5 text-xs font-semibold rounded-lg"
              aria-label="Insights timeline weeks"
            >
              <option value={4}>Last 4 weeks</option>
              <option value={8}>Last 8 weeks</option>
              <option value={12}>Last 12 weeks</option>
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeDemo}
              onChange={(e) => setIncludeDemo(e.target.checked)}
              className="h-3.5 w-3.5 rounded accent-indigo-600"
            />
            <span>Include demo data</span>
          </label>
        </div>

        {/* Export & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isManager && !trendsData?.includes_demo_data && (
            <button
              type="button"
              onClick={() => handleToggleDemoHistory('seed')}
              disabled={busyAction}
              className="btn-secondary text-xs py-1.5 px-3 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              title="Add 14 synthetic demo drafts across 8 weeks"
            >
              <Database className="h-3.5 w-3.5" />
              <span>Load sample history</span>
            </button>
          )}

          {/* CSV Export dropdown/buttons per contract_v2 §8 */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => handleExportCsv('weekly')}
              disabled={busyAction}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white rounded-lg transition-all"
              title="Export weekly trends data to CSV"
            >
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
              <span>Weekly CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv('rules')}
              disabled={busyAction}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white rounded-lg transition-all"
              title="Export recurring rules data to CSV"
            >
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
              <span>Rules CSV</span>
            </button>
            <button
              type="button"
              onClick={() => handleExportCsv('recommendations')}
              disabled={busyAction}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-white rounded-lg transition-all"
              title="Export recommendations to CSV"
            >
              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
              <span>Recs CSV</span>
            </button>
          </div>

          {/* PDF Report Export */}
          <button
            type="button"
            onClick={handleExportPdf}
            disabled={busyAction}
            className="btn-primary text-xs py-1.5 px-3"
            title="Download executive compliance summary PDF"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={loadInsightsData}
            disabled={loading || busyAction}
            className="btn-secondary text-xs py-1.5 px-2.5"
            aria-label="Refresh trends"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState label="Analyzing trends and governance activity over time…" />
      ) : trendsData ? (
        <>
          {/* Executive Totals KPI Row */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/80 to-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Drafts checked</span>
                <div className="rounded-xl bg-indigo-600 p-2 text-white">
                  <Activity className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {totals.drafts_checked || trendsData.drafts || 0}
              </div>
              <p className="mt-1 text-xs text-slate-500">Across the last {weeks} weeks</p>
            </div>

            <div className="rounded-2xl border border-rose-200/80 bg-gradient-to-br from-rose-50/80 to-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Issues found & fixed</span>
                <div className="rounded-xl bg-rose-600 p-2 text-white">
                  <AlertTriangle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {totals.issues ?? totals.issues_found ?? weeklyData.reduce((s, w) => s + (w.issues_found || 0), 0)}
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  ({totals.fixes_applied ?? weeklyData.reduce((s, w) => s + (w.fixes_applied || 0), 0)} self-resolved)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {(totals.issues || totals.issues_found || weeklyData.reduce((s, w) => s + (w.issues_found || 0), 0)) > 0
                  ? `${Math.round(((totals.fixes_applied || 0) / (totals.issues || totals.issues_found || weeklyData.reduce((s, w) => s + (w.issues_found || 0), 1))) * 100)}% resolution rate before submit`
                  : 'No infractions detected'}
              </p>
            </div>

            <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/80 to-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Exceptions & Waivers</span>
                <div className="rounded-xl bg-violet-600 p-2 text-white">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-slate-900">
                  {totals.exceptions_requested || 0}
                </span>
                <span className="text-xs font-bold text-violet-700">
                  ({totals.waivers_granted || 0} granted · {totals.waivers_denied || 0} denied)
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Human governance workflow</p>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/80 to-white p-5 shadow-2xs">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500">
                <span>Approved Publications</span>
                <div className="rounded-xl bg-emerald-600 p-2 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3 text-3xl font-extrabold text-slate-900">
                {totals.approved ?? weeklyData.reduce((s, w) => s + (w.approved || 0), 0)}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {totals.changes_requested ?? weeklyData.reduce((s, w) => s + (w.changes_requested || 0), 0)} required revision changes
              </p>
            </div>
          </section>

          {/* View Tab Selector */}
          <div className="flex items-center border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('trends')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'trends'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <LineChartIcon className="h-4 w-4" />
              <span>Weekly Trends Over Time</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'rules'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Top Recurring Rules & Drift</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
                {topRules.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('recommendations')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'recommendations'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Evidence-Based Recommendations</span>
              <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-semibold text-indigo-700">
                {recommendations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('status')}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-bold transition-colors ${
                activeTab === 'status'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="h-4 w-4" />
              <span>Status & Pipeline Breakdown</span>
            </button>
          </div>

          {/* TAB 1: WEEKLY TRENDS LINE CHARTS */}
          {activeTab === 'trends' && (
            <div className="space-y-6">
              <div className="panel p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Weekly Activity Trends ({weeks} Weeks)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Tracking drafts checked, issues detected, fixes self-applied, and exceptions requested over time.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExportCsv('weekly')}
                      className="btn-secondary text-xs py-1 px-2.5"
                    >
                      <Download className="h-3 w-3" />
                      <span>Export weekly CSV</span>
                    </button>
                  </div>
                </div>

                <div className="mt-6 h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis
                        dataKey="shortWeek"
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Line
                        type="monotone"
                        dataKey="drafts_checked"
                        name="Drafts Checked"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="issues_found"
                        name="Issues Found"
                        stroke="#e11d48"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fixes_applied"
                        name="Fixes Self-Applied"
                        stroke="#059669"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="exceptions_requested"
                        name="Exceptions Requested"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="4 4"
                        dot={{ r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Secondary Review Decision Trends */}
              <div className="panel p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      Review Decisions & Waiver Volume
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Manager and reviewer workload: approved drafts vs changes requested and waivers decided.
                    </p>
                  </div>
                </div>

                <div className="mt-6 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="shortWeek" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 4px 12px rgba(15,23,42,0.08)',
                          fontSize: '12px',
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                      <Bar dataKey="approved" name="Approved" fill="#10b981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="changes_requested" name="Changes Requested" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="waivers_granted" name="Waivers Granted" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="waivers_denied" name="Waivers Denied" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TOP RECURRING RULES & DRIFT INDICATORS */}
          {activeTab === 'rules' && (
            <div className="panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Top Recurring Rules & Drift Direction
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Analyzes rule friction: rising rules indicate emerging team confusion or need for kit clarification.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportCsv('rules')}
                  className="btn-secondary text-xs py-1 px-2.5"
                >
                  <Download className="h-3 w-3" />
                  <span>Export rules CSV</span>
                </button>
              </div>

              <div className="space-y-3">
                {topRules.map((ruleItem, idx) => (
                  <div
                    key={`${ruleItem.rule}_${idx}`}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-800">
                          {ruleItem.category || 'RULE'}
                        </span>
                        {getTrendBadge(ruleItem.trend)}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span>
                          <strong className="text-slate-900 font-mono">{ruleItem.count}</strong> total findings
                        </span>
                        <span className="text-slate-300">·</span>
                        <span>
                          <strong className="text-slate-900 font-mono">{ruleItem.drafts}</strong> affected drafts
                        </span>
                      </div>
                    </div>

                    <h4 className="mt-2 text-sm font-semibold text-slate-900 leading-snug">
                      {ruleItem.rule}
                    </h4>

                    {/* Breakdown metrics */}
                    <div className="mt-3 grid gap-2 sm:grid-cols-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Exceptions</span>
                        <span className="font-semibold text-violet-700">{ruleItem.exceptions_requested || 0} requested</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Waiver Decisions</span>
                        <span className="font-semibold text-slate-800">
                          {ruleItem.waivers_granted || 0} granted · {ruleItem.waivers_denied || 0} denied
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Recent Weeks</span>
                        <span className="font-semibold text-slate-800">{ruleItem.recent || 0} occurrences</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Earlier Baseline</span>
                        <span className="font-semibold text-slate-800">{ruleItem.earlier || 0} occurrences</span>
                      </div>
                    </div>
                  </div>
                ))}

                {topRules.length === 0 && (
                  <div className="p-8 text-center text-sm text-slate-500">
                    No recurring rule patterns identified yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DETERMINISTIC RECOMMENDATIONS CARDS */}
          {activeTab === 'recommendations' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    Evidence-Based Brand Kit Recommendations
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Deterministic guidelines generated strictly from audit logs and recurring waiver patterns.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleExportCsv('recommendations')}
                  className="btn-secondary text-xs py-1 px-2.5"
                >
                  <Download className="h-3 w-3" />
                  <span>Export recommendations CSV</span>
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {recommendations.map((rec) => (
                  <div
                    key={rec.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:shadow-md transition-shadow"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${getRecLevelBadge(
                            rec.level,
                          )}`}
                        >
                          {rec.level} Priority
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">{rec.id}</span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 leading-snug">
                        {rec.title}
                      </h4>

                      <p className="mt-2 text-xs leading-relaxed text-slate-600">
                        {rec.text}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                        Empirical Evidence:
                      </span>
                      <p className="text-[11px] font-medium text-slate-700 bg-slate-50 rounded-lg p-2 border border-slate-100">
                        {rec.evidence}
                      </p>
                    </div>
                  </div>
                ))}

                {recommendations.length === 0 && (
                  <div className="col-span-full p-8 text-center text-sm text-slate-500 panel">
                    No recommendations triggered by current activity thresholds.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: STATUS & PIPELINE BREAKDOWN */}
          {activeTab === 'status' && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="panel p-5 sm:p-6">
                <h3 className="font-bold text-slate-900 text-base mb-1">
                  Drafts by Lifecycle Status
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Current distribution across the four contract governance states.
                </p>

                <div className="space-y-4">
                  {statusDistribution.map((item) => {
                    const totalDrafts = Math.max(1, totals.drafts_checked || trendsData.drafts || 1);
                    const pct = Math.min(100, Math.round((item.value / totalDrafts) * 100));

                    return (
                      <div key={item.name}>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="capitalize text-slate-700">{item.name}</span>
                          <span className="text-slate-900">
                            {item.value} ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="panel p-5 sm:p-6">
                <h3 className="font-bold text-slate-900 text-base mb-1">
                  Compliance Summary Export
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Download official summary assets for compliance auditors and brand team leads.
                </p>

                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="h-5 w-5 text-indigo-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Executive PDF Report
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Complete compliance summary document
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportPdf}
                      disabled={busyAction}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Raw Weekly Metrics (CSV)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          8-week audit figures for spreadsheet analysis
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportCsv('weekly')}
                      disabled={busyAction}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                      <div>
                        <span className="text-xs font-bold text-slate-900 block">
                          Recurring Rule Drift (CSV)
                        </span>
                        <span className="text-[11px] text-slate-500">
                          Counts, waiver rates, and drift indicators
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleExportCsv('rules')}
                      disabled={busyAction}
                      className="btn-secondary text-xs py-1 px-3"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
