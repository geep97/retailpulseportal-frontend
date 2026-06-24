import { useEffect, useState, useRef } from 'react';
import './OpsDashboardPage.css';
import React from 'react';

const API_URL = import.meta.env.VITE_API_URL;

interface Summary {
  total_revenue: number;
  total_transactions: number;
  avg_basket: number;
  stock_alert_count: number;
  week_number: number | null;
  week_label: string | null;
  user_name: string | null;
  role: string;
}

interface StoreStat {
  store_id: number;
  store_name: string;
  location: string | null;
  week_revenue: number;
  week_transactions: number;
  submitted: boolean;
  submitted_at: string | null;
  pct_of_max: number;
}

interface OpsData {
  stores: StoreStat[];
  top_store_name: string | null;
  top_store_revenue: number;
  top_store_vs_avg_pct: number | null;
  transactions_delta_pct: number | null;
  pending_stores: string[];
  submitted_count: number;
  total_stores: number;
  week_label: string;
  iso_year: number;
  iso_week: number;
}

interface WeekOption {
  iso_year: number;
  iso_week: number;
  week_label: string;
}

const BAR_COLORS = ['#3498db', '#3498db', '#2ecc71', '#f39c12', '#e67e22', '#e74c3c'];

const fmt = (v: number) =>
  `GH₵ ${v.toLocaleString('en-GH', { minimumFractionDigits: 0 })}`;

const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `GH₵ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `GH₵ ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
};

const fmtDate = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short' });
};

const getCurrentIsoWeek = (): { iso_year: number; iso_week: number } => {
  const now = new Date();
  const temp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const iso_week = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { iso_year: temp.getUTCFullYear(), iso_week };
};

/** Returns the number of ISO weeks in a given year (52 or 53). */
const isoWeeksInYear = (year: number): number => {
  // A year has 53 ISO weeks if 1 Jan or 31 Dec falls on a Thursday
  const jan1Day = new Date(year, 0, 1).getDay();   // 0 = Sun, 4 = Thu
  const dec31Day = new Date(year, 11, 31).getDay();
  return jan1Day === 4 || dec31Day === 4 ? 53 : 52;
};

const prevWeek = (iso_year: number, iso_week: number) => {
  if (iso_week === 1) {
    const prevYear = iso_year - 1;
    return { iso_year: prevYear, iso_week: isoWeeksInYear(prevYear) };
  }
  return { iso_year, iso_week: iso_week - 1 };
};

const nextWeek = (iso_year: number, iso_week: number) => {
  if (iso_week === isoWeeksInYear(iso_year)) {
    return { iso_year: iso_year + 1, iso_week: 1 };
  }
  return { iso_year, iso_week: iso_week + 1 };
};

export default function OpsDashboardPage({
  summary,
  onLogout,
}: {
  summary: Summary;
  onLogout: () => void;
}) {
  const [ops, setOps] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const current = getCurrentIsoWeek();
  const [viewYear, setViewYear] = useState(current.iso_year);
  const [viewWeek, setViewWeek] = useState(current.iso_week);

  const isCurrentWeek =
    viewYear === current.iso_year && viewWeek === current.iso_week;

  useEffect(() => {
    fetchAvailableWeeks();
  }, []);

  useEffect(() => {
    fetchOps(viewYear, viewWeek);
  }, [viewYear, viewWeek]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowWeekPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchAvailableWeeks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/available-weeks`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = await res.json();
      setWeekOptions(data.weeks);
    } catch { }
  };

  const fetchOps = async (year: number, week: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}/api/dashboard/ops-summary?iso_year=${year}&iso_week=${week}`,
        { credentials: 'include' }
      );
      if (!res.ok) throw new Error('Failed to load ops data');
      const data = await res.json();
      setOps(data);
    } catch {
      setError('Failed to load ops data');
    } finally {
      setLoading(false);
    }
  };

  const goToPrevWeek = () => {
    const prev = prevWeek(viewYear, viewWeek);
    setViewYear(prev.iso_year);
    setViewWeek(prev.iso_week);
  };

  const goToNextWeek = () => {
    const next = nextWeek(viewYear, viewWeek);
    setViewYear(next.iso_year);
    setViewWeek(next.iso_week);
  };

  const selectWeek = (option: WeekOption) => {
    setViewYear(option.iso_year);
    setViewWeek(option.iso_week);
    setShowWeekPicker(false);
  };

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;
  if (error || !ops) return <div className="dashboard-error">{error ?? 'No data'}</div>;

  const pendingCount = ops.total_stores - ops.submitted_count;

  return (
    <>
      <div className="dashboard-header">
          <h1>Chain Overview — All Branches</h1>
          <div className="dashboard-header-right">
            <div className="week-navigator" ref={pickerRef}>
              <button className="week-nav-btn" onClick={goToPrevWeek} aria-label="Previous week">‹</button>
              <div
                className="week-badge week-badge-clickable"
                onClick={() => setShowWeekPicker((prev) => !prev)}
                title="Click to jump to a week"
              >
                <i className="ti ti-calendar" aria-hidden="true" />
                {ops.week_label}
                <i className="ti ti-chevron-down week-badge-chevron" aria-hidden="true" />
              </div>
              <button
                className="week-nav-btn"
                onClick={goToNextWeek}
                disabled={isCurrentWeek}
                aria-label="Next week"
              >›</button>

              {showWeekPicker && weekOptions.length > 0 && (
                <div className="week-picker-dropdown">
                  <div className="week-picker-title">Jump to week</div>
                  {weekOptions.map((option, i) => {
                    const showYearHeader = i === 0 || option.iso_year !== weekOptions[i - 1].iso_year;
                    const isSelected = option.iso_year === viewYear && option.iso_week === viewWeek;
                    return (
                      <React.Fragment key={`${option.iso_year}-${option.iso_week}`}>
                        {showYearHeader && <div className="week-picker-year">{option.iso_year}</div>}
                        <div
                          className={`week-picker-item ${isSelected ? 'week-picker-item-active' : ''}`}
                          onClick={() => selectWeek(option)}
                        >
                          {option.week_label}
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </div>
            <button className="notif-btn" aria-label="Notifications">
              <i className="ti ti-bell" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="dashboard-body">
          <div className="ops-stat-cards">
            <div className="ops-stat-card">
              <div className="ops-stat-label">Total Chain Revenue</div>
              <div className="ops-stat-value">{fmtShort(summary.total_revenue)}</div>
              <div className="ops-stat-sub">All {ops.total_stores} branches</div>
            </div>
            <div className="ops-stat-card ops-stat-highlight">
              <div className="ops-stat-label">Top Branch</div>
              {ops.submitted_count === 0 ? (
                <>
                  <div className="ops-stat-value ops-stat-accent">—</div>
                  <div className="ops-stat-sub">No submissions yet this week</div>
                </>
              ) : (
                <>
                  <div className="ops-stat-value ops-stat-accent">
                    {ops.top_store_name ?? '—'} — {fmtShort(ops.top_store_revenue)}
                  </div>
                  {ops.top_store_vs_avg_pct !== null && (
                    <div className="ops-stat-sub delta-up">↑ {ops.top_store_vs_avg_pct}% above avg</div>
                  )}
                </>
              )}
            </div>
            <div className="ops-stat-card">
              <div className="ops-stat-label">Total Transactions</div>
              <div className="ops-stat-value">{summary.total_transactions.toLocaleString()} sales</div>
              {ops.transactions_delta_pct !== null && (
                <div className={`ops-stat-sub ${ops.transactions_delta_pct >= 0 ? 'delta-up' : 'delta-down'}`}>
                  {ops.transactions_delta_pct >= 0 ? '↑' : '↓'} {Math.abs(ops.transactions_delta_pct)}% chain avg
                </div>
              )}
            </div>
            <div className="ops-stat-card">
              <div className="ops-stat-label">Pending Uploads</div>
              <div className="ops-stat-value">{pendingCount} branches</div>
              {ops.pending_stores.length > 0 && (
                <div className="ops-stat-sub ops-pending-names">{ops.pending_stores.join(' · ')}</div>
              )}
            </div>
          </div>

          <div className="ops-panels">
            <div className="ops-panel">
              <div className="ops-panel-header">
                <div className="ops-panel-title">Branch Performance — {ops.week_label} Revenue</div>
                <div className="ops-drill-hint">Click any branch to drill down → <span className="ops-drill-link">Drill-in →</span></div>
              </div>
              <div className="ops-bar-list">
                {ops.stores.map((store, i) => (
                  <div key={store.store_id} className="ops-bar-row">
                    <div className="ops-bar-label">{store.store_name}</div>
                    <div className="ops-bar-track">
                      {store.submitted ? (
                        <div
                          className="ops-bar-fill"
                          style={{
                            width: `${store.pct_of_max}%`,
                            background: BAR_COLORS[i % BAR_COLORS.length],
                          }}
                        />
                      ) : (
                        <div className="ops-bar-empty">— Not submitted</div>
                      )}
                    </div>
                    <div className="ops-bar-value">
                      {store.submitted ? fmt(store.week_revenue) : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="ops-panel ops-panel-narrow">
              <div className="ops-panel-header">
                <div className="ops-panel-title">Submission Status — {ops.week_label}</div>
                <div className="ops-submission-count">{ops.submitted_count} of {ops.total_stores} branches submitted</div>
              </div>
              <div className="ops-submission-list">
                {ops.stores.map((store) => (
                  <div key={store.store_id} className="ops-submission-row">
                    <div className="ops-sub-left">
                      <div className="ops-sub-name">{store.store_name}</div>
                      {store.submitted && store.submitted_at && (
                        <div className="ops-sub-date">{fmtDate(store.submitted_at)}</div>
                      )}
                      {!store.submitted && <div className="ops-sub-date">—</div>}
                    </div>
                    <div className={`ops-sub-badge ${store.submitted ? 'badge-submitted' : 'badge-pending'}`}>
                      {store.submitted ? <><i className="ti ti-check" /> Submitted</> : <><i className="ti ti-clock" /> Pending</>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
    </>
  );
}