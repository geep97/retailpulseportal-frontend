import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import './DashboardPage.css';
import OpsDashboardPage from './OpsDashboardPage';

const API_URL = import.meta.env.VITE_API_URL;

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

interface WeekOption {
  iso_year: number;
  iso_week: number;
  week_label: string;
}

interface Summary {
  total_revenue: number;
  total_transactions: number;
  avg_basket: number;
  stock_alert_count: number;

  week_number: number | null;
  week_label: string | null;
  week_submitted: boolean;
  week_revenue: number;
  week_transactions: number;
  week_avg_basket: number;

  revenue_delta_pct: number | null;
  transactions_delta_pct: number | null;
  avg_basket_delta_pct: number | null;

  store_id: number | null;
  store_name: string | null;
  store_location: string | null;
  user_name: string | null;
  role: string;
}

interface RevenuePoint {
  date: string;
  revenue: number;
}

interface TopProduct {
  product_id: number;
  product_name: string | null;
  total_revenue: number;
  total_units: number;
}

const PRODUCT_COLORS = ['#3498DB', '#F39C12', '#2ECC71', '#85B7EB', '#E67E22'];
const ACTIVE_BAR_COLOR = '#1a5fa8';
const DIM_BAR_COLOR    = '#d4dde8';

const formatCurrency = (value: number) =>
  `GH₵ ${value.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const formatCurrencyShort = (value: number) => {
  if (value >= 1_000_000) return `GH₵ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `GH₵ ${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
};

const formatYAxis = (value: number) => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}k`;
  return `${value}`;
};

const Delta = ({ pct }: { pct: number | null }) => {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <div className={`stat-card-delta ${up ? 'delta-up' : 'delta-down'}`}>
      <i className={`ti ${up ? 'ti-trending-up' : 'ti-trending-down'}`} aria-hidden="true" />
      {Math.abs(pct)}%
    </div>
  );
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary]         = useState<Summary | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenuePoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
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
    fetchDashboardData(viewYear, viewWeek);
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
      const res = await fetch(`${API_URL}/api/dashboard/available-weeks`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setWeekOptions(data.weeks);
    } catch { }
  };

  const fetchDashboardData = async (year: number, week: number) => {
    setLoading(true);
    setError(null);
    try {
      const opts: RequestInit = { credentials: 'include' };
      const summaryRes = await fetch(
        `${API_URL}/api/dashboard/summary?iso_year=${year}&iso_week=${week}`,
        opts,
      );

      if (summaryRes.status === 401) { navigate('/'); return; }
      if (!summaryRes.ok) throw new Error('Failed to load dashboard');

      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      if (summaryData.role === 'ops') {
        setLoading(false);
        return;
      }

      const [trendRes, productsRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/revenue-trend?iso_year=${year}&iso_week=${week}`, opts),
        fetch(`${API_URL}/api/dashboard/top-products?iso_year=${year}&iso_week=${week}`,  opts),
      ]);

      const trendData    = await trendRes.json();
      const productsData = await productsRes.json();

      setRevenueTrend(trendData.data);
      setTopProducts(productsData.data);
    } catch {
      setError('Failed to load dashboard data');
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

  const handleLogout = async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
    localStorage.removeItem('role');
    navigate('/');
  };

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;
  if (error)   return <div className="dashboard-error">{error}</div>;

  const isOps = summary?.role === 'ops';

  if (isOps) {
    return (
      <OpsDashboardPage
        summary={summary!}
        onLogout={handleLogout}
      />
    );
  }

  const branchTitle = `${summary?.store_name ?? 'Branch'} Dashboard`;
  const lastIndex          = revenueTrend.length - 1;
  const currentWeekRevenue = revenueTrend[lastIndex]?.revenue ?? 0;
  const prevWeekRevenue    = revenueTrend[lastIndex - 1]?.revenue ?? 0;
  const chartPctChange     = prevWeekRevenue > 0
    ? (((currentWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100).toFixed(1)
    : null;
  const chartUp = chartPctChange !== null && parseFloat(chartPctChange) >= 0;

  const statCards = [
    {
      label: 'Total Revenue',
      value: formatCurrency(summary?.week_revenue ?? 0),
      delta: summary?.revenue_delta_pct ?? null,
      accent: '#1a5fa8',
      isAlert: false,
      subtext: `Lifetime: ${formatCurrency(summary?.total_revenue ?? 0)}`,
    },
    {
      label: 'Transactions',
      value: `${(summary?.week_transactions ?? 0).toLocaleString()} sales`,
      delta: summary?.transactions_delta_pct ?? null,
      accent: '#2ecc71',
      isAlert: false,
    },
    {
      label: 'Avg Basket',
      value: formatCurrency(summary?.week_avg_basket ?? 0),
      delta: summary?.avg_basket_delta_pct ?? null,
      accent: '#f39c12',
      isAlert: false,
    },
    {
      label: 'Stock Alerts',
      value: `${summary?.stock_alert_count ?? 0} items`,
      delta: null,
      accent: (summary?.stock_alert_count ?? 0) > 0 ? '#e74c3c' : '#27ae60',
      isAlert: true,
      alertText: (summary?.stock_alert_count ?? 0) > 0 ? 'Low stock' : 'All clear',
    },
  ];

  return (
    <>
      {/* HEADER */}
      <div className="dashboard-header">
        <h1>{branchTitle}</h1>
        <div className="dashboard-header-right">
          <div className="week-navigator" ref={pickerRef}>
            <button className="week-nav-btn" onClick={goToPrevWeek} aria-label="Previous week">‹</button>
            <div
              className="week-badge week-badge-clickable"
              onClick={() => setShowWeekPicker((prev) => !prev)}
              title="Click to jump to a week"
            >
              <i className="ti ti-calendar" aria-hidden="true" />
              {summary?.week_label ?? `Week ${viewWeek}`}
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
        {/* UPLOAD BANNER */}
        {summary?.week_submitted === false && (
          <div className="upload-banner">
            <div className="upload-banner-text">
              <i className="ti ti-upload" aria-hidden="true" />
              Upload this week's data —{' '}
              {summary?.week_label ?? `Week ${summary?.week_number}`} not yet submitted
            </div>
            <button className="upload-now-btn" onClick={() => navigate('/upload')}>
              Upload Now
            </button>
          </div>
        )}

        {/* STAT CARDS */}
        <div className="stat-cards">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="stat-card"
              style={{ borderTop: `3px solid ${card.accent}` }}
            >
              <div className="stat-card-label">{card.label}</div>
              <div className="stat-card-value">{card.value}</div>
              {card.isAlert ? (
                <div className={`stock-alert-label ${(summary?.stock_alert_count ?? 0) > 0 ? 'is-alert' : 'is-ok'}`}>
                  {card.alertText}
                </div>
              ) : (
                <Delta pct={card.delta} />
              )}
              {card.subtext && (
                <div style={{ fontSize: '12px', color: '#8a9bb0', marginTop: '4px' }}>
                  {card.subtext}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* CHARTS ROW */}
        <div className="charts-row">
          {/* REVENUE TREND */}
          <div className="chart-card">
            <div className="chart-card-title">
              Revenue Trend — Last {revenueTrend.length} Weeks
            </div>
            {chartPctChange !== null && (
              <div className="chart-card-summary">
                <span className="chart-card-big-val">
                  {formatCurrencyShort(currentWeekRevenue)}
                </span>
                <span className={`chart-card-delta ${chartUp ? 'delta-up' : 'delta-down'}`}>
                  <i className={`ti ${chartUp ? 'ti-trending-up' : 'ti-trending-down'}`} aria-hidden="true" />
                  {Math.abs(parseFloat(chartPctChange))}%
                </span>
                <span className="chart-card-vs">
                  vs {revenueTrend[lastIndex - 1]?.date}
                </span>
              </div>
            )}
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={revenueTrend} barSize={28} style={{ outline: 'none' }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#edf0f5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#8a9bb0' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 11, fill: '#8a9bb0' }}
                  axisLine={false}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  contentStyle={{
                    border: '1px solid #e8edf3',
                    borderRadius: 8,
                    fontSize: 12,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  cursor={{ fill: 'rgba(26,95,168,0.05)' }}
                />
                <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                  {revenueTrend.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={index === lastIndex ? ACTIVE_BAR_COLOR : DIM_BAR_COLOR}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* TOP PRODUCTS */}
          <div className="chart-card">
            <div className="chart-card-title">Top Products — {summary?.week_label}</div>
            {topProducts.map((product, index) => (
              <div key={product.product_id} className="product-row">
                <div className="product-left">
                  <div className="product-dot" style={{ background: PRODUCT_COLORS[index] }} />
                  <span className="product-name">
                    {product.product_name ?? `Product ${product.product_id}`}
                  </span>
                </div>
                <div className="product-right">
                  <div className="product-revenue">{formatCurrency(product.total_revenue)}</div>
                  <div className="product-units">{product.total_units} units</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}