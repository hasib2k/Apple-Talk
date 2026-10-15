import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';

const BASE = (import.meta.env.VITE_API_URL || '') + '/api/v1/admin';

interface Stats {
  users: number; linkedUsers: number; guestUsers: number;
  bannedUsers: number; ipBans: number; liveMeetings: number; totalMeetings: number;
}
interface AdminUser {
  id: string; anonAlias: string; email: string | null; isLinked: boolean;
  isBanned: boolean; lastActiveAt: string | null; createdAt: string;
  _count: { meetingsHosted: number; meetingParticipations: number };
}

/**
 * Minimal admin panel (Phase 1). Full Meet-style redesign comes in Phase 5.
 */
export default function AdminPage() {
  const [key, setKey] = useState(localStorage.getItem('admin_key') ?? '');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');

  const headers = useCallback(() => ({ 'x-admin-key': key }), [key]);

  const load = useCallback(async () => {
    const [s, u] = await Promise.all([
      axios.get<Stats>(`${BASE}/stats`, { headers: headers() }),
      axios.get<{ data: AdminUser[] }>(`${BASE}/users`, { headers: headers(), params: { limit: 50, search: search || undefined } }),
    ]);
    setStats(s.data);
    setUsers(u.data.data);
  }, [headers, search]);

  async function login() {
    setError('');
    try {
      await axios.get(`${BASE}/stats`, { headers: { 'x-admin-key': key } });
      localStorage.setItem('admin_key', key);
      setAuthed(true);
    } catch {
      setError('Invalid admin key');
    }
  }

  useEffect(() => { if (authed) load(); }, [authed, load]);

  async function toggleBan(u: AdminUser) {
    await axios.post(`${BASE}/users/${u.id}/${u.isBanned ? 'unban' : 'ban'}`, {}, { headers: headers() });
    load();
  }

  if (!authed) {
    return (
      <div style={wrap}>
        <div style={{ ...card, width: 320 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>🔐 Admin</h1>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key"
            onKeyDown={(e) => e.key === 'Enter' && login()} style={input} />
          <button onClick={login} style={btn}>Login</button>
          {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...wrap, alignItems: 'stretch', padding: 24 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto', width: '100%' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 20 }}>AppleTalk Admin</h1>

        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 24 }}>
            <Stat label="Users" value={stats.users} />
            <Stat label="Google" value={stats.linkedUsers} />
            <Stat label="Guests" value={stats.guestUsers} />
            <Stat label="Banned" value={stats.bannedUsers} />
            <Stat label="Live meetings" value={stats.liveMeetings} />
            <Stat label="Total meetings" value={stats.totalMeetings} />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / email"
            onKeyDown={(e) => e.key === 'Enter' && load()} style={{ ...input, marginBottom: 0, flex: 1 }} />
          <button onClick={load} style={{ ...btn, width: 'auto', padding: '0 20px' }}>Search</button>
        </div>

        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
                <th style={th}>Name</th><th style={th}>Type</th><th style={th}>Email</th>
                <th style={th}>Meetings</th><th style={th}>Status</th><th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  <td style={td}>{u.anonAlias}</td>
                  <td style={td}>{u.isLinked ? '🔵 Google' : '👤 Guest'}</td>
                  <td style={td}>{u.email ?? '—'}</td>
                  <td style={td}>{u._count.meetingsHosted}h / {u._count.meetingParticipations}j</td>
                  <td style={td}>{u.isBanned ? <span style={{ color: '#f87171' }}>Banned</span> : <span style={{ color: '#a3e635' }}>Active</span>}</td>
                  <td style={td}>
                    <button onClick={() => toggleBan(u)} style={{ ...btn, width: 'auto', padding: '6px 12px', fontSize: 12, background: u.isBanned ? '#16a34a' : '#ef4444', color: '#fff' }}>
                      {u.isBanned ? 'Unban' : 'Ban'}
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && <tr><td style={{ ...td, textAlign: 'center', color: '#6f9c81' }} colSpan={6}>No users</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ ...card, padding: 16 }}>
      <div style={{ fontSize: 26, fontWeight: 800, color: '#a3e635' }}>{value}</div>
      <div style={{ fontSize: 12, color: '#8fcea8' }}>{label}</div>
    </div>
  );
}

const wrap: React.CSSProperties = { minHeight: '100dvh', background: '#05140d', color: '#f4fbe9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' };
const card: React.CSSProperties = { background: '#0a2013', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 24 };
const input: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: '1px solid #2a4a35', background: '#05140d', color: '#fff', marginBottom: 12, boxSizing: 'border-box' };
const btn: React.CSSProperties = { width: '100%', padding: 12, borderRadius: 10, border: 'none', background: 'linear-gradient(150deg,#bef264,#84cc16)', color: '#1a2e05', fontWeight: 700, cursor: 'pointer' };
const th: React.CSSProperties = { padding: '12px 14px', fontWeight: 600, color: '#8fcea8', fontSize: 12 };
const td: React.CSSProperties = { padding: '12px 14px' };
