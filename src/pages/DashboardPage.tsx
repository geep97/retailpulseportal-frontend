import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from 'recharts';
import './DashboardPage.css';
import OpsDashboardPage from './OpsDashboardPage';

const API_URL = import.meta.env.VITE_API_URL;

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

const NAV_ITEMS = [
  { label: 'Dashboard',       icon: 'ti-layout-dashboard', path: '/dashboard' },
  { label: 'Upload Data',     icon: 'ti-upload',           path: '/upload'    },
  { label: 'Upload History',  icon: 'ti-clipboard-list',   path: '/history'   },
  { label: 'Inventory Alerts',icon: 'ti-alert-triangle',   path: '/alerts'    },
  { label: 'My Account',      icon: 'ti-user',             path: '/account'   },
];

const PRODUCT_COLORS = ['#3498DB', '#F39C12', '#2ECC71', '#85B7EB', '#E67E22'];
const ACTIVE_BAR_COLOR = '#1a5fa8';
const DIM_BAR_COLOR    = '#d4dde8';

const getInitials = (name: string | null) => {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

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

/** Renders ↑ 12.4% or ↓ 2.3% delta badge */
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

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // credentials: 'include' sends the httpOnly cookie automatically
      const opts: RequestInit = { credentials: 'include' };

      // Always fetch summary first so we know the role
      const summaryRes = await fetch(`${API_URL}/api/dashboard/summary`, opts);

      // Cookie missing or expired — send back to login
      if (summaryRes.status === 401) { navigate('/'); return; }
      if (!summaryRes.ok) throw new Error('Failed to load dashboard');

      const summaryData = await summaryRes.json();
      setSummary(summaryData);

      // Ops users only need the summary — OpsDashboardPage fetches its own data
      if (summaryData.role === 'ops') {
        setLoading(false);
        return;
      }

      // Manager-only endpoints
      const [trendRes, productsRes] = await Promise.all([
        fetch(`${API_URL}/api/dashboard/revenue-trend`, opts),
        fetch(`${API_URL}/api/dashboard/top-products`,  opts),
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

  const handleLogout = async () => {
    // Tell the server to clear the httpOnly cookie
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

  // Manager view
  const branchTitle = `${summary?.store_name ?? 'Branch'} Dashboard`;

  // Chart: last bar is current week
  const lastIndex          = revenueTrend.length - 1;
  const currentWeekRevenue = revenueTrend[lastIndex]?.revenue ?? 0;
  const prevWeekRevenue    = revenueTrend[lastIndex - 1]?.revenue ?? 0;
  const chartPctChange     = prevWeekRevenue > 0
    ? (((currentWeekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100).toFixed(1)
    : null;
  const chartUp = chartPctChange !== null && parseFloat(chartPctChange) >= 0;

  const statCards = [
    {
      label:    'Total Revenue',
      value:    formatCurrency(summary?.total_revenue || 0),
      delta:    summary?.revenue_delta_pct ?? null,
      accent:   summary?.revenue_delta_pct !== null && (summary?.revenue_delta_pct ?? 0) >= 0
                  ? '#27ae60' : '#e74c3c',
    },
    {
      label:    'Transactions',
      value:    `${summary?.total_transactions?.toLocaleString()} sales`,
      delta:    summary?.transactions_delta_pct ?? null,
      accent:   summary?.transactions_delta_pct !== null && (summary?.transactions_delta_pct ?? 0) >= 0
                  ? '#27ae60' : '#e74c3c',
    },
    {
      label:    'Avg Basket',
      value:    formatCurrency(summary?.avg_basket || 0),
      delta:    summary?.avg_basket_delta_pct ?? null,
      accent:   summary?.avg_basket_delta_pct !== null && (summary?.avg_basket_delta_pct ?? 0) >= 0
                  ? '#27ae60' : '#e74c3c',
    },
    {
      label:    'Stock Alerts',
      value:    `${summary?.stock_alert_count ?? 0} items`,
      delta:    null,
      accent:   (summary?.stock_alert_count ?? 0) > 0 ? '#e74c3c' : '#27ae60',
      isAlert:  true,
      alertText: (summary?.stock_alert_count ?? 0) > 0 ? 'Low stock' : 'All clear',
    },
  ];

  return (
    <div className="dashboard-root">

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">RetailPulse GH</div>
          <div className="sidebar-brand-sub">Store Portal</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`sidebar-nav-item ${item.path === '/dashboard' ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              {item.label}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <div className="sidebar-avatar">
              {getInitials(summary?.user_name ?? null)}
            </div>
            <div className="sidebar-footer-text">
              <div className="sidebar-footer-name">
                {summary?.user_name ?? 'Store Manager'}
              </div>
              <div className="sidebar-footer-role">
                {summary?.store_name
                  ? `${summary.store_name}${summary.store_location ? ` · ${summary.store_location}` : ''}`
                  : summary?.role?.toUpperCase()}
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-content">

        {/* HEADER */}
        <div className="dashboard-header">
          <h1>{branchTitle}</h1>
          <div className="dashboard-header-right">
            {summary?.week_label && (
              <div className="week-badge">
                <i className="ti ti-calendar" aria-hidden="true" />
                {summary.week_label}
              </div>
            )}
            <button className="notif-btn" aria-label="Notifications">
              <i className="ti ti-bell" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="dashboard-body">

          {/* UPLOAD BANNER — only for managers with unsubmitted week */}
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
              <div className="chart-card-title">Top Products — This Week</div>
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
      </div>
    </div>
  );
}