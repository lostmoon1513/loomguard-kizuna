
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { getInsights } from '../api/insights.js';
import { getErrorMessage } from '../api/client.js';
import ErrorMessage from '../components/ErrorMessage.jsx';
import LoadingState from '../components/LoadingState.jsx';

const metricGradients = [
  'from-indigo-50 to-indigo-100/60 border-indigo-200/60',
  'from-amber-50 to-amber-100/60 border-amber-200/60',
  'from-sky-50 to-sky-100/60 border-sky-200/60',
  'from-emerald-50 to-emerald-100/60 border-emerald-200/60',
];

const metricIconBg = [
  'bg-indigo-500',
  'bg-amber-500',
  'bg-sky-500',
  'bg-emerald-500',
];

function Metric({ label, value, description, icon: Icon, gradientIdx = 0 }) {
  return (
    <div
      className={`rounded-2xl border bg-gradient-to-br p-5 shadow-sm ${metricGradients[gradientIdx] || metricGradients[0]}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        <div className={`rounded-xl p-2 text-white ${metricIconBg[gradientIdx] || metricIconBg[0]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <div className="mt-4 text-3xl font-bold tracking-tight text-slate-900">
        {value ?? 0}
      </div>

      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
    </div>
  );
}

export default function Insights() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setData(await getInsights());
    } catch (error) {
      setError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

useEffect(() => {
  async function loadInsights() {
    await refresh();
  }

  loadInsights();
}, [refresh]);
  const categories = useMemo(
    () => Object.entries(data?.by_category || {}).map(([name, value]) => ({ name, value })),
    [data],
  );

  const statuses = useMemo(
    () =>
      Object.entries(data?.drafts_by_status || {}).map(([name, value]) => ({
        name: name.replaceAll('_', ' '),
        value,
      })),
    [data],
  );

  const claims = useMemo(
    () => Object.entries(data?.by_claim_status || {}).map(([name, value]) => ({ name, value })),
    [data],
  );

  return (
    <div className="space-y-6">
      <ErrorMessage
        message={error}
        onDismiss={() => setError('')}
      />

      {loading ? (
        <LoadingState label="Loading insights from the backend…" />
      ) : data ? (
        <>
          <div className="flex justify-end">
            <button className="btn-secondary" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
              Refresh insights
            </button>
          </div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Drafts checked"
              value={data.drafts}
              description="All workflow statuses"
              icon={Activity}
              gradientIdx={0}
            />

            <Metric
              label="Exceptions requested"
              value={data.exceptions_requested}
              description="Exception requests across issues"
              icon={AlertTriangle}
              gradientIdx={1}
            />

            <Metric
              label="Categories observed"
              value={categories.length}
              description="Categories with recorded findings"
              icon={BarChart3}
              gradientIdx={2}
            />

            <Metric
              label="Potentially unclear rules"
              value={data.potentially_unclear_rules?.length || 0}
              description="Rules with repeated exception requests"
              icon={ShieldCheck}
              gradientIdx={3}
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            {/* Bar chart */}
            <div className="panel p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-slate-900">Findings by category</h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Counts supplied by the backend; not a compliance score.
              </p>

              {categories.length ? (
                <div className="mt-5 h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={categories}
                      margin={{
                        top: 8,
                        right: 12,
                        left: -18,
                        bottom: 8,
                      }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="#f1f5f9"
                      />

                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                      />

                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
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

                      <Bar
                        dataKey="value"
                        fill="#6366f1"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="mt-8 text-sm text-slate-500">
                  No category findings have been recorded yet.
                </p>
              )}
            </div>

            {/* Drafts by status */}
            <div className="panel p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Activity className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-slate-900">Drafts by status</h2>
              </div>

              <p className="mt-1 text-sm text-slate-500">
                Workflow state counts from the backend.
              </p>

              {statuses.length ? (
                <div className="mt-5 space-y-4">
                  {statuses.map((item) => {
                    const total = Math.max(
                      1,
                      Number(data.drafts) || 0,
                    );

                    const percentage = Math.min(
                      100,
                      (item.value / total) * 100,
                    );

                    return (
                      <div key={item.name}>
                        <div className="mb-2 flex justify-between gap-3 text-sm">
                          <span className="font-medium text-slate-600 capitalize">
                            {item.name}
                          </span>

                          <strong className="text-slate-900">{item.value}</strong>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-400 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-8 text-sm text-slate-500">
                  No draft activity recorded yet.
                </p>
              )}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            {/* Claim status */}
            <div className="panel p-5 sm:p-6">
              <h2 className="font-bold text-slate-900">Claim status distribution</h2>

              <p className="mt-1 text-sm text-slate-500">
                Unverified claims should not be interpreted as false claims.
              </p>

              <div className="mt-4 space-y-2">
                {claims.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:bg-slate-100/60 transition-colors"
                  >
                    <span className="text-sm font-medium text-slate-700 capitalize">
                      {item.name}
                    </span>

                    <span className="rounded-lg bg-white border border-slate-200 px-3 py-1 text-sm font-bold text-slate-800 shadow-sm">
                      {item.value}
                    </span>
                  </div>
                ))}

                {!claims.length && (
                  <p className="text-sm text-slate-500">
                    No claim statuses recorded yet.
                  </p>
                )}
              </div>

              <h3 className="mt-6 font-semibold text-slate-800">
                Findings by source
              </h3>

              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(data.by_source || {}).map(
                  ([name, value]) => (
                    <span
                      key={name}
                      className="rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2 text-xs font-medium text-indigo-800"
                    >
                      {name}: <strong>{value}</strong>
                    </span>
                  ),
                )}
              </div>
            </div>

            {/* Top rules */}
            <div className="panel p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="font-bold text-slate-900">Top recurring rules</h2>
              </div>

              <div className="mt-4 space-y-2">
                {(data.top_rules || []).map((item, index) => (
                  <div
                    key={`${item.rule}-${index}`}
                    className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 hover:bg-white transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {item.rule}
                      </p>

                      <p className="mt-0.5 text-xs text-slate-500">
                        {item.exceptions_requested || 0} exception requests
                      </p>
                    </div>

                    <span className="shrink-0 rounded-lg bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700">
                      {item.count}
                    </span>
                  </div>
                ))}

                {!(data.top_rules || []).length && (
                  <p className="text-sm text-slate-500">
                    No recurring rules recorded yet.
                  </p>
                )}
              </div>

              <h3 className="mt-6 font-semibold text-slate-800">
                Potentially unclear rules
              </h3>

              <p className="mt-1 text-xs text-slate-500">
                Flagged by repeated exception requests, not automatically
                classified as incorrect.
              </p>

              <div className="mt-3 space-y-2">
                {(data.potentially_unclear_rules || []).map(
                  (item, index) => (
                    <div
                      key={`${item.rule}-${index}`}
                      className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                    >
                      {item.rule}{' '}
                      <span className="font-semibold">
                        ({item.exceptions_requested} exceptions)
                      </span>
                    </div>
                  ),
                )}

                {!(data.potentially_unclear_rules || []).length && (
                  <p className="text-sm text-slate-500">
                    No potentially unclear rules reported.
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
