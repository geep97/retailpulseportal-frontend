import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import HistoryPage from './pages/HistoryPage';
import AlertsPage from './pages/AlertsPage';
import MyAccountPage from './pages/MyAccountPage';
import StoreComparisonPage from './pages/StoreComparisonPage';
import SubmissionStatusPage from './pages/Submissionstatuspage';

const API_URL = import.meta.env.VITE_API_URL;

// Layout wrapper component that provides the sticky Sidebar to all pages.
// Also doubles as the auth gate: /api/api/dashboard/profile requires a valid
// session and 401s otherwise, so a single fetch covers both "am I logged in"
// and "what should the sidebar show" instead of two sequential round-trips.
function PortalLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [authState, setAuthState] = useState<'checking' | 'ok' | 'denied'>('checking');

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_URL}/api/api/dashboard/profile`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401 || res.status === 403) {
          if (!cancelled) setAuthState('denied');
          return null;
        }
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then((data) => {
        if (cancelled || !data) return;
        setProfile(data);
        setAuthState('ok');
      })
      .catch(() => {
        if (!cancelled) setAuthState('denied');
      });
    return () => { cancelled = true; };
    // Intentionally run once per PortalLayout mount only — this component
    // stays mounted across child route changes (the Outlet below swaps),
    // so navigating between /dashboard, /upload, etc. does NOT refetch.
  }, []);

  const handleLogout = async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
    window.location.href = '/';
  };

  const getInitials = (name: string | null) => {
    if (!name) return '??';
    return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (authState === 'checking') {
    return <div className="dashboard-loading">Loading...</div>;
  }

  if (authState === 'denied') {
    return <Navigate to="/" replace />;
  }

  const isOps = profile?.role === 'ops';

  const MANAGER_NAV = [
    { label: 'Dashboard',       icon: 'ti-layout-dashboard', path: '/dashboard' },
    { label: 'Upload Data',     icon: 'ti-upload',           path: '/upload'    },
    { label: 'Upload History',  icon: 'ti-clipboard-list',   path: '/history'   },
    { label: 'Inventory Alerts',icon: 'ti-alert-triangle',   path: '/alerts'    },
    { label: 'My Account',      icon: 'ti-user',             path: '/account'   },
  ];

  const OPS_NAV = [
    { label: 'Chain Overview',    icon: 'ti-layout-dashboard', path: '/dashboard' },
    { label: 'Store Comparison',  icon: 'ti-chart-bar',        path: '/comparison'},
    { label: 'Submission Status', icon: 'ti-clipboard-check',  path: '/submissions'},
    { label: 'Inventory Alerts',  icon: 'ti-alert-triangle',   path: '/alerts'    },
    { label: 'My Account',        icon: 'ti-user',             path: '/account'   },
  ];

  const NAV_ITEMS = isOps ? OPS_NAV : MANAGER_NAV;

  return (
    <div className="dashboard-root">
      {/* GLOBAL SIDEBAR */}
      <div className={`sidebar ${isOps ? 'ops-sidebar' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">RetailPulse GH</div>
          <div className="sidebar-brand-sub">{isOps ? 'Operations Portal' : 'Store Portal'}</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <div
              key={item.label}
              className={`sidebar-nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <i className={`ti ${item.icon}`} aria-hidden="true" />
              {item.label}
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-user">
            <div className={`sidebar-avatar ${isOps ? 'ops-avatar' : ''}`}>
              {getInitials(profile?.username ?? null)}
            </div>
            <div className="sidebar-footer-text">
              <div className="sidebar-footer-name">
                {profile?.username ?? (isOps ? 'Head of Operations' : 'Store Manager')}
              </div>
              <div className="sidebar-footer-role">
                {isOps
                  ? 'Head of Operations'
                  : profile?.store_name
                    ? `${profile.store_name}${profile.location ? ` · ${profile.location}` : ''}`
                    : profile?.role?.toUpperCase() || 'Loading...'}
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* RIGHT SIDE DYNAMIC CONTENT WINDOW */}
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}

export default function App() {
  const handleLogout = () => {
    window.location.href = '/';
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />

        {/* All portal pages share the frame layout */}
        <Route element={<PortalLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/upload" element={<UploadPage onLogout={handleLogout} />} />
          <Route path="/history" element={<HistoryPage onLogout={handleLogout} />} />
          <Route path="/alerts" element={<AlertsPage onLogout={handleLogout} />} />
          <Route path="/account" element={<MyAccountPage />} />
          <Route path="/comparison" element={<StoreComparisonPage />} />
          <Route path="/submissions" element={<SubmissionStatusPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
