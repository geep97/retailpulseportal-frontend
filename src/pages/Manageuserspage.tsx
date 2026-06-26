import { useEffect, useState } from 'react';
import './OpsDashboardPage.css';

const API_URL = import.meta.env.VITE_API_URL;

interface StoreOption {
  store_id: number;
  store_name: string;
  location: string | null;
}

interface UserRow {
  id: string;
  username: string;
  role: string;
  store_id: number | null;
  store_name: string | null;
  store_location: string | null;
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [storeId, setStoreId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [pendingReplace, setPendingReplace] = useState<{ existingManagerUsername: string; storeName: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, storesRes] = await Promise.all([
        fetch(`${API_URL}/admin/users`, { credentials: 'include' }),
        fetch(`${API_URL}/admin/stores`, { credentials: 'include' }),
      ]);
      if (!usersRes.ok || !storesRes.ok) throw new Error('Failed to load');
      const usersData = await usersRes.json();
      const storesData = await storesRes.json();
      setUsers(usersData.users);
      setStores(storesData.stores);
    } catch {
      setError('Failed to load users and stores.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setUsername('');
    setEmail('');
    setPassword('');
    setStoreId('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!username || !email || !password || !storeId) {
      setStatusMsg({ type: 'error', text: 'Please fill out every field, including the assigned store.' });
      return;
    }
    if (password.length < 6) {
      setStatusMsg({ type: 'error', text: 'Password must be at least 6 characters long.' });
      return;
    }

    await submitCreateUser(false);
  };

  const submitCreateUser = async (confirmReplace: boolean) => {
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/admin/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username,
          email,
          password,
          role: 'manager',
          store_id: Number(storeId),
          confirm_replace: confirmReplace,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to create manager.');
      }

      if (data.status === 'manager_exists') {
        setPendingReplace({
          existingManagerUsername: data.existing_manager_username,
          storeName: data.store_name,
        });
        return;
      }

      setPendingReplace(null);
      setStatusMsg({ type: 'success', text: `Manager account created for ${username}.` });
      resetForm();
      loadData();
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'An error occurred.' });
      setPendingReplace(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="dashboard-loading">Loading users...</div>;
  if (error) return <div className="dashboard-error">{error}</div>;

  const managers = users.filter((u) => u.role === 'manager');
  const opsUsers = users.filter((u) => u.role === 'ops');

  return (
    <>
      <div className="dashboard-header">
        <h1>Manage Users</h1>
      </div>

      <div className="dashboard-body">
        <div className="ops-panel" style={{ maxWidth: '560px', marginBottom: '32px' }}>
          <div className="ops-panel-header" style={{ marginBottom: '20px' }}>
            <div className="ops-panel-title">Add Store Manager</div>
          </div>

          {pendingReplace && (
            <div style={{
              padding: '14px',
              borderRadius: '8px',
              margin: '0 0 16px 0',
              backgroundColor: '#fff8ec',
              border: '1px solid #f5d8a8',
              fontSize: '14px',
              color: '#7a5c1e',
            }}>
              <div style={{ marginBottom: '10px' }}>
                <strong>{pendingReplace.storeName}</strong> already has an active manager
                (<strong>{pendingReplace.existingManagerUsername}</strong>). Replacing them
                will deactivate that account — they will no longer be able to log in.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#c5221f' }}
                  disabled={submitting}
                  onClick={() => submitCreateUser(true)}
                >
                  {submitting ? 'Replacing...' : 'Yes, replace manager'}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ background: '#8a9bb0' }}
                  disabled={submitting}
                  onClick={() => setPendingReplace(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {statusMsg && (
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              margin: '0 0 16px 0',
              backgroundColor: statusMsg.type === 'success' ? '#e6f4ea' : '#fce8e6',
              color: statusMsg.type === 'success' ? '#137333' : '#c5221f',
              border: `1px solid ${statusMsg.type === 'success' ? '#ceead6' : '#fad2cf'}`,
              fontSize: '14px',
            }}>
              {statusMsg.text}
            </div>
          )}

          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">Manager's Name</label>
              <input
                type="text"
                className="form-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. Akua Mensah"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@example.com"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Temporary Password</label>
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assigned Store</label>
              <select
                className="form-input"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
              >
                <option value="">Select a store...</option>
                {stores.map((s) => (
                  <option key={s.store_id} value={s.store_id}>
                    {s.store_name}{s.location ? ` · ${s.location}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn-primary" disabled={submitting || !!pendingReplace} style={{ marginTop: '4px' }}>
              {submitting ? 'Creating...' : 'Create Manager Account'}
            </button>
          </form>
        </div>

        <div className="ops-panel" style={{ marginBottom: '32px' }}>
          <div className="ops-panel-header" style={{ marginBottom: '12px' }}>
            <div className="ops-panel-title">Store Managers ({managers.length})</div>
          </div>
          <div className="ops-submission-list">
            {managers.length === 0 && (
              <div className="ops-sub-left"><div className="ops-sub-date">No managers yet.</div></div>
            )}
            {managers.map((u) => (
              <div key={u.id} className="ops-submission-row">
                <div className="ops-sub-left">
                  <div className="ops-sub-name">{u.username}</div>
                  <div className="ops-sub-date">
                    {u.store_name ? `${u.store_name}${u.store_location ? ` · ${u.store_location}` : ''}` : 'No store assigned'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {opsUsers.length > 0 && (
          <div className="ops-panel">
            <div className="ops-panel-header" style={{ marginBottom: '12px' }}>
              <div className="ops-panel-title">Operations</div>
            </div>
            <div className="ops-submission-list">
              {opsUsers.map((u) => (
                <div key={u.id} className="ops-submission-row">
                  <div className="ops-sub-left">
                    <div className="ops-sub-name">{u.username}</div>
                    <div className="ops-sub-date">Head of Operations</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}