import { useState, useEffect } from 'react';
import './MyAccountPage.css';

const API_URL = import.meta.env.VITE_API_URL;

interface ProfileData {
  username?: string;
  role?: string;
  store_name?: string | null;
  location?: string | null;
}

export default function MyAccountPage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch profile details on mount
  useEffect(() => {
    fetch(`${API_URL}/dashboard/profile`, { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => setProfile(data))
      .catch(() => setStatusMsg({ type: 'error', text: 'Failed to load profile details.' }));
  }, []);

  const getAvatarInitials = () => {
    if (!profile?.username) return '??';
    return profile.username
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!newPassword || !confirmPassword) {
      setStatusMsg({ type: 'error', text: 'Please fill out all password fields.' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }

    if (newPassword.length < 6) {
      setStatusMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/update-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: newPassword }),
        credentials: 'include',
      });

      if (res.status === 404) {
        const retryRes = await fetch(`${API_URL}/api/auth/update-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_password: newPassword }),
          credentials: 'include',
        });
        if (!retryRes.ok) throw new Error('Failed to update password.');
      } else if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to update password.');
      }

      setStatusMsg({ type: 'success', text: 'Password updated successfully!' });
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'An error occurred.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    /* Restored the root container class to reactivate all nested CSS layout specs */
    <div className="account-container">
      <div className="account-layout">
        <h1 className="account-title">My Account Settings</h1>

        {statusMsg && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '24px',
            backgroundColor: statusMsg.type === 'success' ? '#e6f4ea' : '#fce8e6',
            color: statusMsg.type === 'success' ? '#137333' : '#c5221f',
            border: `1px solid ${statusMsg.type === 'success' ? '#ceead6' : '#fad2cf'}`,
            fontSize: '14px'
          }}>
            {statusMsg.text}
          </div>
        )}

        <div className="account-grid">
          {/* LEFT SIDE: PROFILE MINICARD */}
          <div className="account-card profile-sidebar">
            <div className="avatar-circle">
              {getAvatarInitials()}
            </div>
            <h2 className="profile-name">{profile?.username || 'Loading...'}</h2>
            <p className="profile-role">
              {profile?.role === 'ops' ? 'Operations Admin' : 'Store Manager'}
            </p>
          </div>

          {/* RIGHT SIDE: FORMS AND INFOS */}
          <div className="settings-main-column">
            
            {/* Profile Information Block */}
            <div className="account-card">
              <h3 className="card-title">Profile Details</h3>
              <div className="details-grid">
                <div className="detail-item-stack">
                  <span className="info-label">Account Username</span>
                  <span className="info-value">{profile?.username || '---'}</span>
                </div>
                <div className="detail-item-stack">
                  <span className="info-label">Assigned Store</span>
                  <span className="info-value">{profile?.store_name || 'Unassigned'}</span>
                </div>
                <div className="detail-item-stack span-two">
                  <span className="info-label">Region Location</span>
                  <span className="info-value">{profile?.location || 'Not Specified'}</span>
                </div>
              </div>
            </div>

            {/* Change Password Block */}
            <div className="account-card">
              <h3 className="card-title">Security & Password</h3>
              <p className="card-subtitle">Update your secret login credentials safely.</p>

              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input
                    type="password"
                    className="form-input"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat your new password"
                  />
                </div>

                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Updating...' : 'Change Password'}
                </button>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}