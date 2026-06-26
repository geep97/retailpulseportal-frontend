import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './HistoryPage.css';

const API_URL = import.meta.env.VITE_API_URL;

interface UploadHistoryItem {
    submission_id: number;
    week_label: string;
    week_start: string;
    submitted_at: string;
    total_included: number;
    total_excluded: number;
    total_fixed: number;
    total_revenue: number;
    filename: string;
    status: string;
}

interface Summary {
    user_name: string | null;
    store_name: string | null;
    role: string;
    store_id: number | null;
}

const fmtRevenue = (v: number) =>
    `GH₵ ${v.toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GH', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });

const fmtTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-GH', {
        hour: '2-digit', minute: '2-digit'
    });

type FilterType = 'all' | 'passed' | 'fixed' | 'excluded';

export default function HistoryPage() {
    const navigate = useNavigate();
    const [summary, setSummary]     = useState<Summary | null>(null);
    const [history, setHistory]     = useState<UploadHistoryItem[]>([]);
    const [loading, setLoading]     = useState(true);
    const [filter, setFilter]       = useState<FilterType>('all');
    const [expanded, setExpanded]   = useState<number | null>(null);

    useEffect(() => {
        fetchSummary();
        fetchHistory();
    }, []);

    const fetchSummary = async () => {
        try {
            const res = await fetch(`${API_URL}/api/dashboard/summary`, {
                credentials: 'include'
            });
            if (res.ok) setSummary(await res.json());
        } catch { }
    };

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/upload/history`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history);
            }
        } catch { }
        finally { setLoading(false); }
    };

    const filtered = history.filter(item => {
        if (filter === 'passed')   return item.total_excluded === 0 && item.total_fixed === 0;
        if (filter === 'fixed')    return item.total_fixed > 0 && item.total_excluded === 0;
        if (filter === 'excluded') return item.total_excluded > 0;
        return true;
    });

    const badge = (item: UploadHistoryItem) => {
        if (item.total_excluded > 0)
            return <span className="badge badge-excluded">⚠ {item.total_excluded} excluded</span>;
        if (item.total_fixed > 0)
            return <span className="badge badge-fixed">⚠ {item.total_fixed} auto-fixed</span>;
        return <span className="badge badge-passed">✓ All passed</span>;
    };

    // ── Summary counts for filter tabs ──
    const counts = {
        all:      history.length,
        passed:   history.filter(i => i.total_excluded === 0 && i.total_fixed === 0).length,
        fixed:    history.filter(i => i.total_fixed > 0 && i.total_excluded === 0).length,
        excluded: history.filter(i => i.total_excluded > 0).length,
    };

    return (
        <>
            {/* ── MAIN ── */}
            <div className="dashboard-header">
                    <h1>Upload History — {summary?.store_name ?? 'Your Store'}</h1>
                    <div className="dashboard-header-right">
                        <button
                            className="hist-upload-btn"
                            onClick={() => navigate('/upload')}
                        >
                            <i className="ti ti-upload" /> Upload New File
                        </button>
                    </div>
                </div>

                <div className="dashboard-body">

                    {/* ── SUMMARY STAT STRIP ── */}
                    <div className="hist-stat-strip">
                        <div className="hist-stat">
                            <div className="hist-stat-val">{history.length}</div>
                            <div className="hist-stat-label">Total Submissions</div>
                        </div>
                        <div className="hist-stat">
                            <div className="hist-stat-val">
                                {fmtRevenue(history.reduce((s, i) => s + i.total_revenue, 0))}
                            </div>
                            <div className="hist-stat-label">Total Revenue Recorded</div>
                        </div>
                        <div className="hist-stat">
                            <div className="hist-stat-val">
                                {history.reduce((s, i) => s + i.total_included, 0).toLocaleString()}
                            </div>
                            <div className="hist-stat-label">Total Transactions</div>
                        </div>
                        <div className="hist-stat hist-stat-amber">
                            <div className="hist-stat-val">
                                {history.reduce((s, i) => s + i.total_fixed, 0)}
                            </div>
                            <div className="hist-stat-label">Total Auto-fixed</div>
                        </div>
                        <div className="hist-stat hist-stat-red">
                            <div className="hist-stat-val">
                                {history.reduce((s, i) => s + i.total_excluded, 0)}
                            </div>
                            <div className="hist-stat-label">Total Excluded</div>
                        </div>
                    </div>

                    {/* ── FILTER TABS ── */}
                    <div className="hist-filter-tabs">
                        {(['all', 'passed', 'fixed', 'excluded'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                className={`hist-tab ${filter === f ? 'hist-tab-active' : ''}`}
                                onClick={() => setFilter(f)}
                            >
                                {f === 'all'      && `All (${counts.all})`}
                                {f === 'passed'   && `✓ All passed (${counts.passed})`}
                                {f === 'fixed'    && `⚠ Auto-fixed (${counts.fixed})`}
                                {f === 'excluded' && `⚠ Had exclusions (${counts.excluded})`}
                            </button>
                        ))}
                    </div>

                    {/* ── HISTORY TABLE ── */}
                    <div className="hist-table-card">
                        {loading ? (
                            <div className="history-empty">Loading history...</div>
                        ) : filtered.length === 0 ? (
                            <div className="history-empty">No submissions match this filter.</div>
                        ) : (
                            filtered.map(item => (
                                <div key={item.submission_id} className="hist-row-wrap">

                                    {/* Main row */}
                                    <div
                                        className={`hist-row ${expanded === item.submission_id ? 'hist-row-expanded' : ''}`}
                                        onClick={() => setExpanded(
                                            expanded === item.submission_id ? null : item.submission_id
                                        )}
                                    >
                                        {/* Left — week info */}
                                        <div className="hist-row-left">
                                            <div className="hist-row-week">{item.week_label}</div>
                                            <div className="hist-row-date">
                                                {item.submitted_at
                                                    ? `${fmtDate(item.submitted_at)} · ${fmtTime(item.submitted_at)}`
                                                    : '—'}
                                            </div>
                                            <div className="hist-row-file">
                                                <i className="ti ti-file-text" /> {item.filename || '—'}
                                            </div>
                                        </div>

                                        {/* Mid — counts */}
                                        <div className="hist-row-mid">
                                            <div className="hist-count">
                                                <span className="hist-count-val">{item.total_included}</span>
                                                <span className="hist-count-label">accepted</span>
                                            </div>
                                            <div className="hist-count hist-count-amber">
                                                <span className="hist-count-val">{item.total_fixed}</span>
                                                <span className="hist-count-label">fixed</span>
                                            </div>
                                            <div className="hist-count hist-count-red">
                                                <span className="hist-count-val">{item.total_excluded}</span>
                                                <span className="hist-count-label">excluded</span>
                                            </div>
                                        </div>

                                        {/* Right — revenue + badge + chevron */}
                                        <div className="hist-row-right">
                                            <div className="hist-row-revenue">
                                                {fmtRevenue(item.total_revenue)}
                                            </div>
                                            {badge(item)}
                                            <i className={`ti ${expanded === item.submission_id ? 'ti-chevron-up' : 'ti-chevron-down'} hist-chevron`} />
                                        </div>
                                    </div>

                                    {/* Expanded detail panel */}
                                    {expanded === item.submission_id && (
                                        <div className="hist-detail">
                                            <div className="hist-detail-grid">
                                                <div className="hist-detail-block">
                                                    <div className="hist-detail-label">Submission ID</div>
                                                    <div className="hist-detail-val">#{item.submission_id}</div>
                                                </div>
                                                <div className="hist-detail-block">
                                                    <div className="hist-detail-label">File uploaded</div>
                                                    <div className="hist-detail-val">{item.filename || '—'}</div>
                                                </div>
                                                <div className="hist-detail-block">
                                                    <div className="hist-detail-label">Week start</div>
                                                    <div className="hist-detail-val">
                                                        {item.week_start ? fmtDate(item.week_start) : '—'}
                                                    </div>
                                                </div>
                                                <div className="hist-detail-block">
                                                    <div className="hist-detail-label">Submitted at</div>
                                                    <div className="hist-detail-val">
                                                        {item.submitted_at
                                                            ? `${fmtDate(item.submitted_at)} · ${fmtTime(item.submitted_at)}`
                                                            : '—'}
                                                    </div>
                                                </div>
                                                <div className="hist-detail-block">
                                                    <div className="hist-detail-label">Status</div>
                                                    <div className="hist-detail-val">{item.status}</div>
                                                </div>
                                                <div className="hist-detail-block">
                                                    <div className="hist-detail-label">Total revenue</div>
                                                    <div className="hist-detail-val">{fmtRevenue(item.total_revenue)}</div>
                                                </div>
                                            </div>

                                            <div className="hist-detail-integrity">
                                                <div className="hist-integrity-item hist-integrity-green">
                                                    <i className="ti ti-circle-check" />
                                                    <div>
                                                        <div className="hist-integrity-val">{item.total_included}</div>
                                                        <div className="hist-integrity-label">Rows accepted into database</div>
                                                    </div>
                                                </div>
                                                <div className="hist-integrity-item hist-integrity-amber">
                                                    <i className="ti ti-tool" />
                                                    <div>
                                                        <div className="hist-integrity-val">{item.total_fixed}</div>
                                                        <div className="hist-integrity-label">Rows auto-corrected before write</div>
                                                    </div>
                                                </div>
                                                <div className="hist-integrity-item hist-integrity-red">
                                                    <i className="ti ti-ban" />
                                                    <div>
                                                        <div className="hist-integrity-val">{item.total_excluded}</div>
                                                        <div className="hist-integrity-label">Rows excluded — failed validation</div>
                                                    </div>
                                                </div>
                                            </div>

                                            {item.week_start && (
                                                <button
                                                    className="hist-reupload-btn"
                                                    onClick={() => navigate('/upload')}
                                                >
                                                    <i className="ti ti-upload" /> Re-upload this week
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>
        </>
    );
}