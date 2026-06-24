import { useEffect, useState, useRef } from 'react';
import './OpsDashboardPage.css';
import React from 'react';

const API_URL = import.meta.env.VITE_API_URL;

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

type SortKey = 'revenue' | 'transactions' | 'avg_basket';

const fmt = (v: number) =>
  `GH₵ ${v.toLocaleString('en-GH', { minimumFractionDigits: 0 })}`;

const getCurrentIsoWeek = (): { iso_year: number; iso_week: number } => {
  const now = new Date();
  const temp = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  temp.setUTCDate(temp.getUTCDate() + 4 - (temp.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1));
  const iso_week = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return { iso_year: temp.getUTCFullYear(), iso_week };
};

const isoWeeksInYear = (year: number): number => {
  const jan1Day = new Date(year, 0, 1).getDay();
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

export default function StoreComparisonPage() {
  const [ops, setOps] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
  const [showWeekPicker, setShowWeekPicker] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
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
      if (!res.ok) throw new Error('Failed to load store comparison');
      const data = await res.json();
      setOps(data);
    } catch {
      setError('Failed to load store comparison');
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

  if (loading) return <div className="dashboard-loading">Loading store comparison...</div>;
  if (error || !ops) return <div className="dashboard-error">{error ?? 'No data'}</div>;

  const submittedStores = ops.stores.filter((s) => s.submitted);
  const avgBasketOf = (s: StoreStat) =>
    s.week_transactions > 0 ? s.week_revenue / s.week_transactions : 0;

  const sorted = [...ops.stores].sort((a, b) => {
    if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
    let primary = 0;
    if (sortKey === 'revenue') primary = b.week_revenue - a.week_revenue;
    else if (sortKey === 'transactions') primary = b.week_transactions - a.week_transactions;
    else primary = avgBasketOf(b) - avgBasketOf(a);
    if (primary !== 0) return primary;
    return a.store_name.localeCompare(b.store_name);
  });

  const chainTotalRevenue = submittedStores.reduce((s, st) => s + st.week_revenue, 0);
  const chainTotalTxns = submittedStores.reduce((s, st) => s + st.week_transactions, 0);
  const chainAvgBasket = chainTotalTxns > 0 ? chainTotalRevenue / chainTotalTxns : 0;

  const maxRevenue = Math.max(...submittedStores.map((s) => s.week_revenue), 1);
  const maxTransactions = Math.max(...submittedStores.map((s) => s.week_transactions), 1);
  const maxAvgBasket = Math.max(...submittedStores.map((s) => avgBasketOf(s)), 1);

  const activeMax =
    sortKey === 'revenue' ? maxRevenue
    : sortKey === 'transactions' ? maxTransactions
    : maxAvgBasket;

  const SORT_TABS: { key: SortKey; label: string }[] = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'avg_basket', label: 'Avg Basket' },
  ];

  return (
    <>
      <div className="dashboard-header">
        <h1>Store Comparison — All Branches</h1>
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
            <div className="ops-stat-label">Chain Revenue</div>
            <div className="ops-stat-value">{fmt(chainTotalRevenue)}</div>
            <div className="ops-stat-sub">{submittedStores.length} of {ops.total_stores} branches submitted</div>
          </div>
          <div className="ops-stat-card">
            <div className="ops-stat-label">Chain Transactions</div>
            <div className="ops-stat-value">{chainTotalTxns.toLocaleString()} sales</div>
          </div>
          <div className="ops-stat-card">
            <div className="ops-stat-label">Chain Avg Basket</div>
            <div className="ops-stat-value">{fmt(chainAvgBasket)}</div>
          </div>
        </div>

        <div className="ops-panel">
          <div className="ops-panel-header">
            <div className="ops-panel-title">Branch Comparison — {ops.week_label}</div>
            <div className="alerts-cat-tabs">
              {SORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`alerts-cat-tab ${sortKey === tab.key ? 'active' : ''}`}
                  onClick={() => setSortKey(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="alerts-table-card">
            <div className="alerts-table-header">
              <span>Branch</span>
              <span style={sortKey === 'revenue' ? { color: '#1a5fa8', fontWeight: 700 } : undefined}>Revenue</span>
              <span style={sortKey === 'transactions' ? { color: '#1a5fa8', fontWeight: 700 } : undefined}>Transactions</span>
              <span style={sortKey === 'avg_basket' ? { color: '#1a5fa8', fontWeight: 700 } : undefined}>Avg Basket</span>
              <span>Status</span>
            </div>
            {sorted.map((store) => (
              <div key={store.store_id} className="alerts-table-row">
                <div className="alerts-product-name">
                  {store.store_name}
                  {store.location && (
                    <div style={{ fontSize: '12px', color: '#8a9bb0', fontWeight: 400 }}>{store.location}</div>
                  )}
                </div>
                <div>
                  {store.submitted ? (
                    <>
                      <div
                        className="alerts-price"
                        style={sortKey === 'revenue' ? { color: '#1a5fa8', fontWeight: 700 } : undefined}
                      >
                        {fmt(store.week_revenue)}
                      </div>
                      {sortKey === 'revenue' && (
                        <div className="alerts-stock-bar-wrap">
                          <div
                            className="alerts-stock-bar-fill"
                            style={{ width: `${(store.week_revenue / activeMax) * 100}%`, background: '#1a5fa8' }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#8a9bb0' }}>—</span>
                  )}
                </div>
                <div>
                  {store.submitted ? (
                    <>
                      <div
                        className="alerts-price"
                        style={sortKey === 'transactions' ? { color: '#1a5fa8', fontWeight: 700 } : undefined}
                      >
                        {store.week_transactions.toLocaleString()} sales
                      </div>
                      {sortKey === 'transactions' && (
                        <div className="alerts-stock-bar-wrap">
                          <div
                            className="alerts-stock-bar-fill"
                            style={{ width: `${(store.week_transactions / activeMax) * 100}%`, background: '#1a5fa8' }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#8a9bb0' }}>—</span>
                  )}
                </div>
                <div>
                  {store.submitted ? (
                    <>
                      <div
                        className="alerts-price"
                        style={sortKey === 'avg_basket' ? { color: '#1a5fa8', fontWeight: 700 } : undefined}
                      >
                        {fmt(avgBasketOf(store))}
                      </div>
                      {sortKey === 'avg_basket' && (
                        <div className="alerts-stock-bar-wrap">
                          <div
                            className="alerts-stock-bar-fill"
                            style={{ width: `${(avgBasketOf(store) / activeMax) * 100}%`, background: '#1a5fa8' }}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#8a9bb0' }}>—</span>
                  )}
                </div>
                <div>
                  <span
                    className="alerts-sev-badge"
                    style={
                      store.submitted
                        ? { color: '#27ae60', background: '#e9f7ef' }
                        : { color: '#f39c12', background: '#fff8ec' }
                    }
                  >
                    {store.submitted ? 'Submitted' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}