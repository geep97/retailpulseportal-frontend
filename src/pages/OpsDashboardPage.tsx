import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './OpsDashboardPage.css';

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
}

const OPS_NAV = [
  { label: 'Chain Overview',    icon: 'ti-layout-dashboard', path: '/dashboard'  },
  { label: 'Store Comparison',  icon: 'ti-chart-bar',        path: '/comparison' },
  { label: 'Submission Status', icon: 'ti-clipboard-check',  path: '/submissions'},
  { label: 'Inventory Alerts',  icon: 'ti-alert-triangle',   path: '/alerts'     },
  { label: 'Settings',          icon: 'ti-settings',         path: '/settings'   },
];

const BAR_COLORS = ['#3498db', '#3498db', '#2ecc71', '#f39c12', '#e67e22', '#e74c3c'];

const getInitials = (name: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) : '??';

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

export default function OpsDashboardPage({
  summary,
  onLogout,
}: {
  summary: Summary;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const [ops, setOps] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOps();
  }, []);

  const fetchOps = async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/ops-summary`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load ops data');
      const data = await res.json();
      setOps(data);
    } catch {
      setError('Failed to load ops data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading dashboard...</div>;
  if (error || !ops) return <div className="dashboard-error">{error ?? 'No data'}</div>;

  const pendingCount = ops.total_stores - ops.submitted_count;

  return (
    <div className="dashboard-root">

      {/* SIDEBAR */}
      <div className="sidebar ops-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">RetailPulse GH</div>
          <div className="sidebar-brand-sub">Operations Portal</div>
        </div>

        <nav className="sidebar-nav">
          {OPS_NAV.map((item) => (
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
            <div className="sidebar-avatar ops-avatar">
              {getInitials(summary.user_name)}
            </div>
            <div className="sidebar-footer-text">
              <div className="sidebar-footer-name">
                {summary.user_name ?? 'Head of Operations'}
              </div>
              <div className="sidebar-footer-role">Head of Operations</div>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>Logout</button>
        </div>
      </div>

      {/* MAIN */}
      <div className="main-content">

        {/* HEADER */}
        <div className="dashboard-header">
          <h1>Chain Overview — All Branches</h1>
          <div className="dashboard-header-right">
            {summary.week_label && (
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

          {/* TOP STAT CARDS */}
          <div className="ops-stat-cards">
            <div className="ops-stat-card">
              <div className="ops-stat-label">Total Chain Revenue</div>
              <div className="ops-stat-value">{fmtShort(summary.total_revenue)}</div>
              <div className="ops-stat-sub">All {ops.total_stores} branches</div>
            </div>

            <div className="ops-stat-card ops-stat-highlight">
              <div className="ops-stat-label">Top Branch</div>
              <div className="ops-stat-value ops-stat-accent">
                {ops.top_store_name ?? '—'} — {fmtShort(ops.top_store_revenue)}
              </div>
              {ops.top_store_vs_avg_pct !== null && (
                <div className="ops-stat-sub delta-up">
                  ↑ {ops.top_store_vs_avg_pct}% above avg
                </div>
              )}
            </div>

            <div className="ops-stat-card">
              <div className="ops-stat-label">Total Transactions</div>
              <div className="ops-stat-value">
                {summary.total_transactions.toLocaleString()} sales
              </div>
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
                <div className="ops-stat-sub ops-pending-names">
                  {ops.pending_stores.join(' · ')}
                </div>
              )}
            </div>
          </div>

          {/* BOTTOM PANELS */}
          <div className="ops-panels">

            {/* BRANCH PERFORMANCE */}
            <div className="ops-panel">
              <div className="ops-panel-header">
                <div className="ops-panel-title">
                  Branch Performance — {summary.week_label ?? `Week ${summary.week_number}`} Revenue
                </div>
                <div className="ops-drill-hint">
                  Click any branch to drill down →
                  <span className="ops-drill-link">Drill-in →</span>
                </div>
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

            {/* SUBMISSION STATUS */}
            <div className="ops-panel ops-panel-narrow">
              <div className="ops-panel-header">
                <div className="ops-panel-title">
                  Submission Status — {summary.week_label ?? `Week ${summary.week_number}`}
                </div>
                <div className="ops-submission-count">
                  {ops.submitted_count} of {ops.total_stores} branches submitted
                </div>
              </div>

              <div className="ops-submission-list">
                {ops.stores.map((store) => (
                  <div key={store.store_id} className="ops-submission-row">
                    <div className="ops-sub-left">
                      <div className="ops-sub-name">{store.store_name}</div>
                      {store.submitted && store.submitted_at && (
                        <div className="ops-sub-date">{fmtDate(store.submitted_at)}</div>
                      )}
                      {!store.submitted && (
                        <div className="ops-sub-date">—</div>
                      )}
                    </div>
                    <div className={`ops-sub-badge ${store.submitted ? 'badge-submitted' : 'badge-pending'}`}>
                      {store.submitted ? (
                        <><i className="ti ti-check" /> Submitted</>
                      ) : (
                        <><i className="ti ti-clock" /> Pending</>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}