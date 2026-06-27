import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL;

const NAV_ITEMS = [
  { label: 'Dashboard',       icon: 'ti-layout-dashboard', path: '/dashboard' },
  { label: 'Upload Data',     icon: 'ti-upload',           path: '/upload'    },
  { label: 'Upload History',  icon: 'ti-clipboard-list',   path: '/history'   },
  { label: 'Inventory Alerts',icon: 'ti-alert-triangle',   path: '/alerts'    },
  { label: 'My Account',      icon: 'ti-user',             path: '/account'   },
];

const getInitials = (name: string | null) => {
  if (!name) return '??';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<{ user_name: string | null; store_name: string | null; store_location: string | null; role: string } | null>(null);

  useEffect(() => {
    // Fetch basic profile info to populate the sidebar footer user details
    fetch(`${API_URL}/api/dashboard/profile`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => setUser(data))
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST', credentials: 'include' });
    localStorage.removeItem('role');
    window.location.href = '/';
  };

  return (
    <div className="dashboard-root">
      {/* GLOBAL SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-name">RetailPulse GH</div>
          <div className="sidebar-brand-sub">Store Portal</div>
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
            <div className="sidebar-avatar">
              {getInitials(user?.user_name ?? null)}
            </div>
            <div className="sidebar-footer-text">
              <div className="sidebar-footer-name">
                {user?.user_name ?? 'Store Manager'}
              </div>
              <div className="sidebar-footer-role">
                {user?.store_name
                  ? `${user.store_name}${user.store_location ? ` · ${user.store_location}` : ''}`
                  : user?.role?.toUpperCase()}
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </div>

      {/* RENDER PAGES HERE */}
      <div className="main-content">
        <Outlet />
      </div>
    </div>
  );
}
