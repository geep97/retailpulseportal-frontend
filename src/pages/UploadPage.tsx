import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './UploadPage.css';

const API_URL = import.meta.env.VITE_API_URL;

interface WeekOption {
    iso_year: number;
    iso_week: number;
    week_label: string;
}

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

interface IntegritySummary {
    status: string;
    submission_id: number;
    week_label: string;
    total_received: number;
    total_included: number;
    total_excluded: number;
    total_fixed: number;
    exclusion_details: { row: number; reason: string }[];
    fix_details: string[];
    message: string;
}

interface Summary {
    user_name: string | null;
    store_name: string | null;
    role: string;
    store_id: number | null;
    week_number: number | null;
    week_label: string | null;
    week_submitted: boolean;
}

const NAV = [
    { label: 'Dashboard',        icon: 'ti-layout-dashboard', path: '/dashboard'  },
    { label: 'Upload Data',      icon: 'ti-upload',           path: '/upload'     },
    { label: 'Upload History',   icon: 'ti-history',          path: '/history'    },
    { label: 'Inventory Alerts', icon: 'ti-alert-triangle',   path: '/alerts'     },
    { label: 'My Account',       icon: 'ti-user',             path: '/account'    },
];

const getInitials = (name: string | null) =>
    name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '??';

const fmtRevenue = (v: number) =>
    `GH₵ ${v.toLocaleString('en-GH', { minimumFractionDigits: 0 })}`;

const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GH', {
        day: 'numeric', month: 'short', year: 'numeric'
    });
};

const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-GH', {
        hour: '2-digit', minute: '2-digit'
    });
};

export default function UploadPage({ onLogout }: { onLogout: () => void }) {
    const navigate = useNavigate();

    // ── User context ──
    const [summary, setSummary] = useState<Summary | null>(null);

    // ── Step state ──
    const [step, setStep] = useState<1 | 2 | 3>(1);

    // ── Week selection ──
    const [weekOptions, setWeekOptions] = useState<WeekOption[]>([]);
    const [selectedWeek, setSelectedWeek] = useState<WeekOption | null>(null);
    const [prevWeekLabel, setPrevWeekLabel] = useState<string | null>(null);

    // ── File ──
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Upload state ──
    const [uploading, setUploading] = useState(false);
    const [result, setResult] = useState<IntegritySummary | null>(null);
    const [duplicateWarning, setDuplicateWarning] = useState(false);

    // ── History ──
    const [history, setHistory] = useState<UploadHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);

    // ── On mount ──
    useEffect(() => {
        fetchSummary();
        fetchWeeks();
        fetchHistory();
    }, []);

    // ── When week selected — check if previous week submitted ──
    useEffect(() => {
        if (selectedWeek && weekOptions.length > 0) {
            const idx = weekOptions.findIndex(
                w => w.iso_year === selectedWeek.iso_year &&
                     w.iso_week === selectedWeek.iso_week
            );
            if (idx > 0) {
                setPrevWeekLabel(weekOptions[idx + 1]?.week_label ?? null);
            }
        }
    }, [selectedWeek, weekOptions]);

    const fetchSummary = async () => {
        try {
            const res = await fetch(`${API_URL}/api/dashboard/summary`, {
                credentials: 'include'
            });
            if (res.ok) setSummary(await res.json());
        } catch { }
    };

    const fetchWeeks = async () => {
        try {
            const res = await fetch(`${API_URL}/api/dashboard/available-weeks`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setWeekOptions(data.weeks);
                if (data.weeks.length > 0) {
                    setSelectedWeek(data.weeks[0]);
                }
            }
        } catch { }
    };

    const fetchHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/upload/history`, {
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history);
            }
        } catch { }
        finally { setHistoryLoading(false); }
    };

    // ── File handling ──
    const handleFileDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const dropped = e.dataTransfer.files[0];
        if (dropped) handleFileSelect(dropped);
    };

    const handleFileSelect = (f: File) => {
        if (!f.name.endsWith('.csv') && !f.name.endsWith('.xlsx')) {
            alert('Only CSV or Excel files are accepted.');
            return;
        }
        setFile(f);
        setStep(2);
    };

    // ── Submit ──
    const handleSubmit = async (confirmReplace = false) => {
        if (!selectedWeek || !file) return;
        setUploading(true);
        setDuplicateWarning(false);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('iso_year', String(selectedWeek.iso_year));
        formData.append('iso_week', String(selectedWeek.iso_week));
        formData.append('confirm_replace', String(confirmReplace));

        try {
            const res = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData,
            });

            const data = await res.json();

            if (!res.ok) {
                setResult({
                    status: 'error',
                    submission_id: 0,
                    week_label: selectedWeek.week_label,
                    total_received: 0,
                    total_included: 0,
                    total_excluded: 0,
                    total_fixed: 0,
                    exclusion_details: [],
                    fix_details: [],
                    message: data.detail ?? 'Upload failed. Please try again.',
                });
                setStep(3);
                return;
            }

            if (data.status === 'duplicate_warning') {
                setDuplicateWarning(true);
                setUploading(false);
                return;
            }

            setResult({
                ...data,
                fix_details:       data.fix_details       ?? [],
                exclusion_details: data.exclusion_details ?? [],
            });
            setStep(3);
            fetchHistory();

        } catch {
            setResult({
                status: 'error',
                submission_id: 0,
                week_label: selectedWeek?.week_label ?? '',
                total_received: 0,
                total_included: 0,
                total_excluded: 0,
                total_fixed: 0,
                exclusion_details: [],
                fix_details: [],
                message: 'Unable to connect to the server. Please check your connection.',
            });
            setStep(3);
        } finally {
            setUploading(false);
        }
    };

    const resetUpload = () => {
        setFile(null);
        setResult(null);
        setStep(1);
        setDuplicateWarning(false);
        fetchWeeks();
    };

    const canSubmit = selectedWeek !== null && file !== null && !uploading;

    // ── History badge ──
    const historyBadge = (item: UploadHistoryItem) => {
        if (item.total_excluded > 0)
            return <span className="badge badge-excluded">⚠ {item.total_excluded} excluded</span>;
        if (item.total_fixed > 0)
            return <span className="badge badge-fixed">⚠ {item.total_fixed} auto-fixed</span>;
        return <span className="badge badge-passed">✓ All passed</span>;
    };

    return (
        <div className="dashboard-root">
            {/* ── SIDEBAR ── */}
            <div className="sidebar">
                <div className="sidebar-brand">
                    <div className="sidebar-brand-name">RetailPulse GH</div>
                    <div className="sidebar-brand-sub">Store Portal</div>
                </div>
                <nav className="sidebar-nav">
                    {NAV.map(item => (
                        <div
                            key={item.label}
                            className={`sidebar-nav-item ${item.path === '/upload' ? 'active' : ''}`}
                            onClick={() => navigate(item.path)}
                        >
                            <i className={`ti ${item.icon}`} />
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
                                {summary?.user_name ?? 'Manager'}
                            </div>
                            <div className="sidebar-footer-role">
                                {summary?.store_name ?? 'Store'} · Manager
                            </div>
                        </div>
                    </div>
                    <button className="logout-btn" onClick={onLogout}>Logout</button>
                </div>
            </div>

            {/* ── MAIN CONTENT ── */}
            <div className="main-content">
                {/* Header */}
                <div className="dashboard-header">
                    <h1>Upload Weekly Data</h1>
                    <div className="dashboard-header-right">
                        <div className="week-badge">
                            <i className="ti ti-calendar" />
                            {selectedWeek?.week_label ?? 'Select a week'}
                        </div>
                        <button className="notif-btn">
                            <i className="ti ti-bell" />
                        </button>
                    </div>
                </div>

                <div className="dashboard-body">
                    <h2 className="upload-heading">Submit your weekly store data</h2>
                    <p className="upload-subheading">
                        Complete both steps below, then click Submit.
                        Your data will be checked automatically.
                    </p>

                    {/* ── STEP INDICATOR ── */}
                    <div className="step-indicator">
                        {['Select week', 'Attach file', 'Review results'].map((label, i) => (
                            <div
                                key={label}
                                className={`step-item ${step === i + 1 ? 'active' : ''} ${step > i + 1 ? 'done' : ''}`}
                            >
                                <div className="step-number">{i + 1}</div>
                                <div className="step-label">{label}</div>
                                {i < 2 && <div className="step-connector" />}
                            </div>
                        ))}
                    </div>

                    {/* ── STEPS 1 & 2 ── */}
                    {step < 3 && (
                        <div className="upload-panels">
                            {/* Step 1 — Week selector */}
                            <div className="upload-panel">
                                <div className="upload-panel-step">STEP 1</div>
                                <div className="upload-panel-title">
                                    Select the week this file covers
                                </div>
                                <p className="upload-panel-sub">
                                    Choose from the list — make sure it matches your in-store export.
                                </p>
                                <select
                                    className="week-select"
                                    value={
                                        selectedWeek
                                            ? `${selectedWeek.iso_year}-${selectedWeek.iso_week}`
                                            : ''
                                    }
                                    onChange={e => {
                                        const [y, w] = e.target.value.split('-').map(Number);
                                        const opt = weekOptions.find(
                                            o => o.iso_year === y && o.iso_week === w
                                        );
                                        if (opt) setSelectedWeek(opt);
                                    }}
                                >
                                    {weekOptions.map(opt => (
                                        <option
                                            key={`${opt.iso_year}-${opt.iso_week}`}
                                            value={`${opt.iso_year}-${opt.iso_week}`}
                                        >
                                            {opt.week_label}
                                        </option>
                                    ))}
                                </select>
                                {prevWeekLabel && (
                                    <div className="prev-week-note">
                                        <i className="ti ti-check" />
                                        {prevWeekLabel} already submitted
                                    </div>
                                )}
                            </div>

                            {/* Step 2 — File drop */}
                            <div className="upload-panel">
                                <div className="upload-panel-step">STEP 2</div>
                                <div className="upload-panel-title">
                                    Attach your export file
                                </div>
                                <p className="upload-panel-sub">
                                    CSV or Excel (.xlsx) — the raw weekly export from your in-store system.
                                </p>
                                <div
                                    className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}
                                    onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={() => setDragging(false)}
                                    onDrop={handleFileDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {file ? (
                                        <>
                                            <i className="ti ti-file-check drop-icon drop-icon-success" />
                                            <div className="drop-filename">{file.name}</div>
                                            <div className="drop-filesize">
                                                {(file.size / 1024).toFixed(1)} KB
                                            </div>
                                            <button
                                                className="drop-remove"
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setFile(null);
                                                    setStep(1);
                                                }}
                                            >
                                                Remove
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            <i className="ti ti-upload drop-icon" />
                                            <div className="drop-text">
                                                Drag your file here, or{' '}
                                                <span className="drop-browse">Browse</span>
                                            </div>
                                            <div className="drop-hint">
                                                Accepted: .csv · .xlsx · Max 10 MB
                                            </div>
                                        </>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.xlsx"
                                    style={{ display: 'none' }}
                                    onChange={e => {
                                        const f = e.target.files?.[0];
                                        if (f) handleFileSelect(f);
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* ── DUPLICATE WARNING ── */}
                    {duplicateWarning && (
                        <div className="duplicate-warning">
                            <i className="ti ti-alert-triangle" />
                            <div className="duplicate-text">
                                <strong>This week already has a submission.</strong>
                                <span>
                                    Do you want to replace the previous submission?
                                    The old data will be kept for audit purposes.
                                </span>
                            </div>
                            <div className="duplicate-actions">
                                <button
                                    className="btn-confirm-replace"
                                    onClick={() => handleSubmit(true)}
                                >
                                    Yes, Replace
                                </button>
                                <button
                                    className="btn-cancel-replace"
                                    onClick={() => setDuplicateWarning(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── SUBMIT BUTTON ── */}
                    {step < 3 && (
                        <div className="submit-row">
                            <button
                                className="submit-btn"
                                disabled={!canSubmit}
                                onClick={() => handleSubmit(false)}
                            >
                                {uploading ? (
                                    <>
                                        <i className="ti ti-loader-2 spin" />
                                        Processing...
                                    </>
                                ) : (
                                    'Submit'
                                )}
                            </button>
                            {!canSubmit && !uploading && (
                                <span className="submit-hint">
                                    Complete both steps above to enable submission
                                </span>
                            )}
                        </div>
                    )}

                    {/* ── STEP 3: RESULTS ── */}
                    {step === 3 && result && (
                        <div className={`result-card ${result.status === 'success' ? 'result-success' : 'result-error'}`}>
                            <div className="result-header">
                                <i className={`ti ${result.status === 'success' ? 'ti-circle-check' : 'ti-circle-x'} result-icon`} />
                                <div>
                                    <div className="result-title">
                                        {result.status === 'success' ? 'Submission accepted' : 'Submission failed'}
                                    </div>
                                    <div className="result-message">{result.message}</div>
                                </div>
                            </div>

                            {result.status === 'success' && (
                                <>
                                    <div className="result-stats">
                                        <div className="result-stat">
                                            <div className="result-stat-val">{result.total_received}</div>
                                            <div className="result-stat-label">Received</div>
                                        </div>
                                        <div className="result-stat result-stat-green">
                                            <div className="result-stat-val">{result.total_included}</div>
                                            <div className="result-stat-label">Accepted</div>
                                        </div>
                                        <div className="result-stat result-stat-amber">
                                            <div className="result-stat-val">{result.total_fixed}</div>
                                            <div className="result-stat-label">Auto-fixed</div>
                                        </div>
                                        <div className="result-stat result-stat-red">
                                            <div className="result-stat-val">{result.total_excluded}</div>
                                            <div className="result-stat-label">Excluded</div>
                                        </div>
                                    </div>

                                    {(result.fix_details ?? []).length > 0 && (
                                        <div className="result-section">
                                            <div className="result-section-title">
                                                <i className="ti ti-tool" /> Auto-fixes applied
                                            </div>
                                            {(result.fix_details ?? []).map((f, i) => (
                                                <div key={i} className="result-detail-row result-detail-amber">
                                                    {f}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {(result.exclusion_details ?? []).length > 0 && (
                                        <div className="result-section">
                                            <div className="result-section-title">
                                                <i className="ti ti-ban" /> Records excluded
                                            </div>
                                            {(result.exclusion_details ?? []).map((e, i) => (
                                                <div key={i} className="result-detail-row result-detail-red">
                                                    Row {e.row}: {e.reason}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="result-actions">
                                <button className="btn-upload-another" onClick={resetUpload}>
                                    Upload another file
                                </button>
                                <button
                                    className="btn-go-dashboard"
                                    onClick={() => navigate('/dashboard')}
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── UPLOAD HISTORY ── */}
                    <div className="history-card">
                        <div className="history-title">
                            Your upload history — {summary?.store_name ?? 'Your Store'}
                        </div>
                        {historyLoading ? (
                            <div className="history-empty">Loading history...</div>
                        ) : history.length === 0 ? (
                            <div className="history-empty">
                                No submissions yet. Upload your first file above.
                            </div>
                        ) : (
                            history.map(item => (
                                <div key={item.submission_id} className="history-row">
                                    <div className="history-left">
                                        <div className="history-week">{item.week_label}</div>
                                        <div className="history-date">
                                            {item.submitted_at ? `${fmtDate(item.submitted_at)} · ${fmtTime(item.submitted_at)}` : '—'}
                                        </div>
                                    </div>
                                    <div className="history-mid">
                                        {item.total_included} tx · {fmtRevenue(item.total_revenue)}
                                    </div>
                                    <div className="history-right">
                                        {historyBadge(item)}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}