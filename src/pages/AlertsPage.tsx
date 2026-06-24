import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './AlertsPage.css';

const API_URL = import.meta.env.VITE_API_URL;

interface AlertItem {
    inventory_id: number;
    product_name: string;
    category: string;
    unit_price: number;
    stock_quantity: number;
    reorder_level: number;
    shortfall: number;
    store_id?: number;
    store_name?: string;
    store_location?: string | null;
}

interface AlertsData {
    alerts: AlertItem[];
    total_alerts: number;
    total_products: number;
}

interface Summary {
    user_name: string | null;
    store_name: string | null;
    role: string;
    store_id: number | null;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Electronics':    '#3498db',
    'Grocery':        '#27ae60',
    'Clothing':       '#9b59b6',
    'Household':      '#f39c12',
    'Health & Beauty':'#e74c3c',
};

const fmtPrice = (v: number) =>
    `GH₵ ${v.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const getSeverity = (stock: number, reorder: number) => {
    if (stock === 0) return 'critical';
    const ratio = stock / reorder;
    if (ratio <= 0.25) return 'critical';
    if (ratio <= 0.6)  return 'warning';
    return 'low';
};

const severityLabel = (s: string) => {
    if (s === 'critical') return { label: 'Critical',     color: '#e74c3c', bg: '#fdf0ee' };
    if (s === 'warning')  return { label: 'Low stock',    color: '#f39c12', bg: '#fff8ec' };
    return                       { label: 'Watch',        color: '#3498db', bg: '#edf4fb' };
};

export default function AlertsPage({ onLogout }: { onLogout: () => void }) {
    const navigate = useNavigate();
    const [summary, setSummary]   = useState<Summary | null>(null);
    const [data, setData]         = useState<AlertsData | null>(null);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [filter, setFilter]     = useState<string>('all');
    const [search, setSearch]     = useState('');

    useEffect(() => {
        fetchSummary();
        fetchAlerts();
    }, []);

    const fetchSummary = async () => {
        try {
            const res = await fetch(`${API_URL}/api/dashboard/summary`, {
                credentials: 'include'
            });
            if (res.ok) setSummary(await res.json());
        } catch { }
    };

    const fetchAlerts = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/dashboard/inventory-alerts`, {
                credentials: 'include'
            });
            if (!res.ok) throw new Error('Failed to load alerts');
            setData(await res.json());
        } catch {
            setError('Failed to load inventory alerts.');
        } finally {
            setLoading(false);
        }
    };

    const categories = data
        ? [...new Set(data.alerts.map(a => a.category))].sort()
        : [];

    const isOps = summary?.role === 'ops';

    const filtered = (data?.alerts ?? []).filter(item => {
        const matchesCategory = filter === 'all' || item.category === filter;
        const matchesSearch   =
            item.product_name.toLowerCase().includes(search.toLowerCase()) ||
            (isOps && (item.store_name ?? '').toLowerCase().includes(search.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    const criticalCount = (data?.alerts ?? []).filter(
        a => getSeverity(a.stock_quantity, a.reorder_level) === 'critical'
    ).length;

    const warningCount = (data?.alerts ?? []).filter(
        a => getSeverity(a.stock_quantity, a.reorder_level) === 'warning'
    ).length;

    return (
        <>
            {/* ── MAIN ── */}
            <div className="dashboard-header">
                    <h1>Inventory Alerts — {isOps ? 'All Branches' : (summary?.store_name ?? 'Your Store')}</h1>
                    <div className="dashboard-header-right">
                        <button className="notif-btn">
                            <i className="ti ti-bell" />
                        </button>
                    </div>
                </div>

                <div className="dashboard-body">
                    {loading ? (
                        <div className="dashboard-loading">Loading alerts...</div>
                    ) : error ? (
                        <div className="dashboard-error">{error}</div>
                    ) : (
                        <>
                            {/* ── STAT STRIP ── */}
                            <div className="alerts-stat-strip">
                                <div className="alerts-stat alerts-stat-red">
                                    <div className="alerts-stat-icon">
                                        <i className="ti ti-alert-circle" />
                                    </div>
                                    <div>
                                        <div className="alerts-stat-val">{criticalCount}</div>
                                        <div className="alerts-stat-label">Critical — reorder now</div>
                                    </div>
                                </div>
                                <div className="alerts-stat alerts-stat-amber">
                                    <div className="alerts-stat-icon">
                                        <i className="ti ti-alert-triangle" />
                                    </div>
                                    <div>
                                        <div className="alerts-stat-val">{warningCount}</div>
                                        <div className="alerts-stat-label">Low stock — monitor closely</div>
                                    </div>
                                </div>
                                <div className="alerts-stat alerts-stat-blue">
                                    <div className="alerts-stat-icon">
                                        <i className="ti ti-eye" />
                                    </div>
                                    <div>
                                        <div className="alerts-stat-val">
                                            {(data?.total_alerts ?? 0) - criticalCount - warningCount}
                                        </div>
                                        <div className="alerts-stat-label">Watch — approaching limit</div>
                                    </div>
                                </div>
                                <div className="alerts-stat alerts-stat-gray">
                                    <div className="alerts-stat-icon">
                                        <i className="ti ti-package" />
                                    </div>
                                    <div>
                                        <div className="alerts-stat-val">{data?.total_products ?? 0}</div>
                                        <div className="alerts-stat-label">Total products tracked</div>
                                    </div>
                                </div>
                            </div>

                            {/* ── CRITICAL BANNER ── */}
                            {criticalCount > 0 && (
                                <div className="alerts-critical-banner">
                                    <i className="ti ti-alert-circle" />
                                    <strong>{criticalCount} product{criticalCount > 1 ? 's are' : ' is'} critically low or out of stock{isOps ? ' across branches' : ''}.</strong>
                                    <span>Immediate reorder required to avoid stockout.</span>
                                </div>
                            )}

                            {/* ── FILTERS ── */}
                            <div className="alerts-controls">
                                <div className="alerts-search-wrap">
                                    <i className="ti ti-search alerts-search-icon" />
                                    <input
                                        className="alerts-search"
                                        placeholder={isOps ? "Search products or branches..." : "Search products..."}
                                        value={search}
                                        onChange={e => setSearch(e.target.value)}
                                    />
                                </div>
                                <div className="alerts-cat-tabs">
                                    <button
                                        className={`alerts-cat-tab ${filter === 'all' ? 'active' : ''}`}
                                        onClick={() => setFilter('all')}
                                    >
                                        All ({data?.total_alerts ?? 0})
                                    </button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat}
                                            className={`alerts-cat-tab ${filter === cat ? 'active' : ''}`}
                                            onClick={() => setFilter(cat)}
                                            style={filter === cat ? {
                                                background: CATEGORY_COLORS[cat] ?? '#1a5fa8',
                                                borderColor: CATEGORY_COLORS[cat] ?? '#1a5fa8',
                                                color: '#fff'
                                            } : {}}
                                        >
                                            {cat} ({data?.alerts.filter(a => a.category === cat).length})
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ── ALERTS TABLE ── */}
                            {filtered.length === 0 ? (
                                <div className="alerts-empty">
                                    <i className="ti ti-circle-check alerts-empty-icon" />
                                    <div>No alerts match your filter.</div>
                                </div>
                            ) : (
                                <div className="alerts-table-card">
                                    <div className="alerts-table-header">
                                        <span>Product</span>
                                        <span>Category</span>
                                        <span>Unit Price</span>
                                        <span>In Stock</span>
                                        <span>Reorder At</span>
                                        <span>Shortfall</span>
                                        <span>Status</span>
                                    </div>
                                    {filtered.map(item => {
                                        const sev  = getSeverity(item.stock_quantity, item.reorder_level);
                                        const meta = severityLabel(sev);
                                        const stockPct = item.reorder_level > 0
                                            ? Math.min((item.stock_quantity / item.reorder_level) * 100, 100)
                                            : 0;
                                        return (
                                            <div key={item.inventory_id} className="alerts-table-row">
                                                <div className="alerts-product-name">
                                                    {item.product_name}
                                                    {isOps && item.store_name && (
                                                        <div style={{ fontSize: '12px', color: '#8a9bb0', fontWeight: 400 }}>
                                                            {item.store_name}
                                                        </div>
                                                    )}
                                                </div>
                                                <div>
                                                    <span
                                                        className="alerts-cat-pill"
                                                        style={{
                                                            background: `${CATEGORY_COLORS[item.category] ?? '#8a9bb0'}18`,
                                                            color: CATEGORY_COLORS[item.category] ?? '#8a9bb0'
                                                        }}
                                                    >
                                                        {item.category}
                                                    </span>
                                                </div>
                                                <div className="alerts-price">
                                                    {fmtPrice(item.unit_price)}
                                                </div>
                                                <div>
                                                    <div className="alerts-stock-val"
                                                        style={{ color: item.stock_quantity === 0 ? '#e74c3c' : '#0f1f3d' }}
                                                    >
                                                        {item.stock_quantity === 0 ? 'Out of stock' : item.stock_quantity}
                                                    </div>
                                                    <div className="alerts-stock-bar-wrap">
                                                        <div
                                                            className="alerts-stock-bar-fill"
                                                            style={{
                                                                width: `${stockPct}%`,
                                                                background: sev === 'critical' ? '#e74c3c'
                                                                    : sev === 'warning' ? '#f39c12' : '#3498db'
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="alerts-reorder">
                                                    {item.reorder_level}
                                                </div>
                                                <div className="alerts-shortfall">
                                                    +{item.shortfall} units needed
                                                </div>
                                                <div>
                                                    <span
                                                        className="alerts-sev-badge"
                                                        style={{ color: meta.color, background: meta.bg }}
                                                    >
                                                        {meta.label}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
        </>
    );
}