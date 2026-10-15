import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { CLAY } from '../lib/clay';
import { Lock, LayoutDashboard, Users as UsersIcon, Mic, Ban, LogOut, BadgeCheck, User as UserIcon, X } from 'lucide-react';

function TypeBadge({ google, label }: { google: boolean; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {google ? <BadgeCheck size={14} color="#60a5fa" /> : <UserIcon size={14} color="#fbbf24" />} {label}
    </span>
  );
}

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
interface AdminMeeting {
  id: string; code: string; title: string; status: 'live' | 'ended';
  startedAt: string; endedAt: string | null;
  host: { id: string; anonAlias: string; email: string | null };
  _count: { participants: number };
}
interface Participant {
  id: string; identity: string; displayName: string; role: string;
  joinedAt: string; leftAt: string | null;
  user: { id: string; anonAlias: string; email: string | null; isLinked: boolean } | null;
}
interface IpBan { id: string; ip: string; reason: string | null; createdAt: string; expiresAt: string | null; }

type Tab = 'overview' | 'users' | 'meetings' | 'bans';

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString() : '—');
const dur = (a: string, b: string | null) => {
  if (!b) return 'in call';
  const sec = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export default function AdminPage() {
  const [key, setKey] = useState(localStorage.getItem('admin_key') ?? '');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('overview');

  const headers = useCallback(() => ({ 'x-admin-key': key }), [key]);

  async function login() {
    setError('');
    try {
      await axios.get(`${BASE}/stats`, { headers: { 'x-admin-key': key } });
      localStorage.setItem('admin_key', key);
      setAuthed(true);
    } catch { setError('Invalid admin key'); }
  }
  function logout() { localStorage.removeItem('admin_key'); setAuthed(false); setKey(''); }

  if (!authed) {
    return (
      <div style={s.loginWrap}>
        <div style={s.loginCard}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Lock size={28} color={CLAY.accent} /></div>
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>AppleTalk Admin</h1>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Admin key"
            onKeyDown={(e) => e.key === 'Enter' && login()} style={s.input} />
          <button onClick={login} style={s.primaryBtn}>Login</button>
          {error && <p style={{ color: '#f87171', fontSize: 13, marginTop: 10 }}>{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div style={s.shell}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px 20px' }}>
          <img src="/logo.png" alt="" style={{ width: 30, height: 30, objectFit: 'contain' }} />
          <span style={{ fontWeight: 800 }}>Admin</span>
        </div>
        {([['overview', 'Overview', LayoutDashboard], ['users', 'Users', UsersIcon], ['meetings', 'Meetings', Mic], ['bans', 'IP Bans', Ban]] as [Tab, string, typeof LayoutDashboard][]).map(([k, label, Icon]) => (
          <button key={k} onClick={() => setTab(k)} style={{ ...s.navItem, display: 'flex', alignItems: 'center', gap: 10, ...(tab === k ? s.navItemActive : {}) }}><Icon size={16} /> {label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <button onClick={logout} style={{ ...s.navItem, display: 'flex', alignItems: 'center', gap: 10, color: '#f87171' }}><LogOut size={16} /> Sign out</button>
      </aside>

      {/* Content */}
      <main style={s.content}>
        {tab === 'overview' && <Overview headers={headers} />}
        {tab === 'users' && <Users headers={headers} />}
        {tab === 'meetings' && <Meetings headers={headers} />}
        {tab === 'bans' && <Bans headers={headers} />}
      </main>
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────────────────────────

function Overview({ headers }: { headers: () => Record<string, string> }) {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { axios.get<Stats>(`${BASE}/stats`, { headers: headers() }).then((r) => setStats(r.data)).catch(() => {}); }, [headers]);
  if (!stats) return <p style={{ color: '#6f9c81' }}>Loading…</p>;
  const cards: [string, number, string][] = [
    ['Total users', stats.users, '#a3e635'],
    ['Google accounts', stats.linkedUsers, '#60a5fa'],
    ['Guests', stats.guestUsers, '#fbbf24'],
    ['Banned', stats.bannedUsers, '#f87171'],
    ['Live meetings', stats.liveMeetings, '#4ade80'],
    ['Total meetings', stats.totalMeetings, '#c5e88a'],
    ['IP bans', stats.ipBans, '#f87171'],
  ];
  return (
    <>
      <h2 style={s.h2}>Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14 }}>
        {cards.map(([label, value, color]) => (
          <div key={label} style={s.statCard}>
            <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 13, color: '#8fcea8', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Users ───────────────────────────────────────────────────────────────────

function Users({ headers }: { headers: () => Record<string, string> }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'true' | 'false'>('all');
  const [ipInfo, setIpInfo] = useState<{ user: string; deviceId: string; ips: string[] } | null>(null);

  const load = useCallback(async () => {
    const params: Record<string, string | number> = { limit: 100 };
    if (search) params.search = search;
    if (filter !== 'all') params.isLinked = filter;
    const r = await axios.get<{ data: AdminUser[] }>(`${BASE}/users`, { headers: headers(), params });
    setUsers(r.data.data);
  }, [headers, search, filter]);

  useEffect(() => { load(); }, [load]);

  async function toggleBan(u: AdminUser) {
    await axios.post(`${BASE}/users/${u.id}/${u.isBanned ? 'unban' : 'ban'}`, {}, { headers: headers() });
    load();
  }
  async function viewIp(u: AdminUser) {
    const r = await axios.get(`${BASE}/users/${u.id}/ip`, { headers: headers() });
    setIpInfo({ user: u.anonAlias, deviceId: r.data.deviceId, ips: r.data.ips });
  }

  return (
    <>
      <h2 style={s.h2}>Users</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Search name / email" style={{ ...s.input, marginBottom: 0, width: 240 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value as 'all' | 'true' | 'false')} style={s.select}>
          <option value="all">All types</option>
          <option value="true">Google</option>
          <option value="false">Guest</option>
        </select>
        <button onClick={load} style={s.primaryBtnSm}>Refresh</button>
      </div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead><tr style={s.trHead}>
            <th style={s.th}>Name</th><th style={s.th}>Type</th><th style={s.th}>Email</th>
            <th style={s.th}>Meetings</th><th style={s.th}>Joined</th><th style={s.th}>Status</th><th style={s.th}></th>
          </tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} style={s.tr}>
                <td style={s.td}>{u.anonAlias}</td>
                <td style={s.td}><TypeBadge google={u.isLinked} label={u.isLinked ? 'Google' : 'Guest'} /></td>
                <td style={s.td}>{u.email ?? '—'}</td>
                <td style={s.td}>{u._count.meetingsHosted}h / {u._count.meetingParticipations}j</td>
                <td style={s.td}>{fmt(u.createdAt)}</td>
                <td style={s.td}>{u.isBanned ? <span style={{ color: '#f87171' }}>Banned</span> : <span style={{ color: '#a3e635' }}>Active</span>}</td>
                <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                  <button onClick={() => viewIp(u)} style={s.ghostSm}>IP</button>{' '}
                  <button onClick={() => toggleBan(u)} style={{ ...s.ghostSm, color: u.isBanned ? '#4ade80' : '#f87171' }}>{u.isBanned ? 'Unban' : 'Ban'}</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td style={{ ...s.td, textAlign: 'center', color: '#6f9c81' }} colSpan={7}>No users</td></tr>}
          </tbody>
        </table>
      </div>

      {ipInfo && (
        <div style={s.overlay} onClick={() => setIpInfo(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, marginBottom: 12 }}>IP info — {ipInfo.user}</h3>
            <p style={{ fontSize: 13, color: '#8fcea8' }}>Device: <code>{ipInfo.deviceId.slice(0, 20)}…</code></p>
            <p style={{ fontSize: 13, color: '#8fcea8', marginTop: 8 }}>IPs:</p>
            <ul style={{ fontSize: 13, marginTop: 4 }}>{ipInfo.ips.length ? ipInfo.ips.map((ip) => <li key={ip}><code>{ip}</code></li>) : <li style={{ color: '#6f9c81' }}>none recorded</li>}</ul>
            <button onClick={() => setIpInfo(null)} style={{ ...s.ghostSm, marginTop: 14 }}>Close</button>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Meetings ────────────────────────────────────────────────────────────────

function Meetings({ headers }: { headers: () => Record<string, string> }) {
  const [meetings, setMeetings] = useState<AdminMeeting[]>([]);
  const [status, setStatus] = useState<'all' | 'live' | 'ended'>('all');
  const [log, setLog] = useState<{ title: string; parts: Participant[] } | null>(null);

  const load = useCallback(async () => {
    const params: Record<string, string | number> = { limit: 100 };
    if (status !== 'all') params.status = status;
    const r = await axios.get<{ data: AdminMeeting[] }>(`${BASE}/meetings`, { headers: headers(), params });
    setMeetings(r.data.data);
  }, [headers, status]);
  useEffect(() => { load(); }, [load]);

  async function openLog(m: AdminMeeting) {
    const r = await axios.get<Participant[]>(`${BASE}/meetings/${m.id}/participants`, { headers: headers() });
    setLog({ title: `${m.title} (${m.code})`, parts: r.data });
  }

  return (
    <>
      <h2 style={s.h2}>Meetings</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <select value={status} onChange={(e) => setStatus(e.target.value as 'all' | 'live' | 'ended')} style={s.select}>
          <option value="all">All</option><option value="live">Live</option><option value="ended">Ended</option>
        </select>
        <button onClick={load} style={s.primaryBtnSm}>Refresh</button>
      </div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead><tr style={s.trHead}>
            <th style={s.th}>Title</th><th style={s.th}>Code</th><th style={s.th}>Host</th>
            <th style={s.th}>Status</th><th style={s.th}>Participants</th><th style={s.th}>Started</th><th style={s.th}></th>
          </tr></thead>
          <tbody>
            {meetings.map((m) => (
              <tr key={m.id} style={s.tr}>
                <td style={s.td}>{m.title}</td>
                <td style={s.td}><code>{m.code}</code></td>
                <td style={s.td}>{m.host.anonAlias}</td>
                <td style={s.td}>{m.status === 'live'
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#4ade80' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} /> live</span>
                  : <span style={{ color: '#6f9c81' }}>ended</span>}</td>
                <td style={s.td}>{m._count.participants}</td>
                <td style={s.td}>{fmt(m.startedAt)}</td>
                <td style={s.td}><button onClick={() => openLog(m)} style={s.ghostSm}>Log</button></td>
              </tr>
            ))}
            {meetings.length === 0 && <tr><td style={{ ...s.td, textAlign: 'center', color: '#6f9c81' }} colSpan={7}>No meetings</td></tr>}
          </tbody>
        </table>
      </div>

      {log && (
        <div style={s.overlay} onClick={() => setLog(null)}>
          <div style={{ ...s.modal, maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ fontWeight: 800 }}>Participants — {log.title}</h3>
              <button onClick={() => setLog(null)} style={s.xBtn}><X size={16} /></button>
            </div>
            <div style={{ ...s.tableWrap, maxHeight: '60vh' }}>
              <table style={s.table}>
                <thead><tr style={s.trHead}>
                  <th style={s.th}>Name</th><th style={s.th}>Type</th><th style={s.th}>Role</th>
                  <th style={s.th}>Joined</th><th style={s.th}>Duration</th>
                </tr></thead>
                <tbody>
                  {log.parts.map((p) => (
                    <tr key={p.id} style={s.tr}>
                      <td style={s.td}>{p.displayName}</td>
                      <td style={s.td}>{p.user ? <TypeBadge google={p.user.isLinked} label={p.user.isLinked ? 'Google' : 'Guest-acct'} /> : <TypeBadge google={false} label="Guest" />}</td>
                      <td style={s.td}>{p.role}</td>
                      <td style={s.td}>{fmt(p.joinedAt)}</td>
                      <td style={s.td}>{dur(p.joinedAt, p.leftAt)}</td>
                    </tr>
                  ))}
                  {log.parts.length === 0 && <tr><td style={{ ...s.td, textAlign: 'center', color: '#6f9c81' }} colSpan={5}>No participants recorded</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── IP Bans ─────────────────────────────────────────────────────────────────

function Bans({ headers }: { headers: () => Record<string, string> }) {
  const [bans, setBans] = useState<IpBan[]>([]);
  const [ip, setIp] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    const r = await axios.get<{ data: IpBan[] }>(`${BASE}/ip-bans`, { headers: headers(), params: { limit: 100 } });
    setBans(r.data.data);
  }, [headers]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    if (!ip.trim()) return;
    await axios.post(`${BASE}/ip-bans`, { ip: ip.trim(), reason: reason.trim() || undefined }, { headers: headers() });
    setIp(''); setReason(''); load();
  }
  async function remove(id: string) {
    await axios.delete(`${BASE}/ip-bans/${id}`, { headers: headers() });
    load();
  }

  return (
    <>
      <h2 style={s.h2}>IP Bans</h2>
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="IP address" style={{ ...s.input, marginBottom: 0, width: 180 }} />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" style={{ ...s.input, marginBottom: 0, width: 240 }} />
        <button onClick={add} style={s.primaryBtnSm}>Add ban</button>
      </div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead><tr style={s.trHead}><th style={s.th}>IP</th><th style={s.th}>Reason</th><th style={s.th}>Created</th><th style={s.th}></th></tr></thead>
          <tbody>
            {bans.map((b) => (
              <tr key={b.id} style={s.tr}>
                <td style={s.td}><code>{b.ip}</code></td>
                <td style={s.td}>{b.reason ?? '—'}</td>
                <td style={s.td}>{fmt(b.createdAt)}</td>
                <td style={s.td}><button onClick={() => remove(b.id)} style={{ ...s.ghostSm, color: '#f87171' }}>Remove</button></td>
              </tr>
            ))}
            {bans.length === 0 && <tr><td style={{ ...s.td, textAlign: 'center', color: '#6f9c81' }} colSpan={4}>No IP bans</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  loginWrap: { minHeight: '100dvh', background: CLAY.bg, color: CLAY.text, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' },
  loginCard: { background: CLAY.surface, borderRadius: CLAY.r, padding: 32, width: 320, textAlign: 'center', boxShadow: CLAY.raised },
  shell: { minHeight: '100dvh', background: CLAY.bg, color: CLAY.text, fontFamily: 'system-ui', display: 'flex' },
  sidebar: { width: 220, padding: 16, display: 'flex', flexDirection: 'column', gap: 6 },
  navItem: { textAlign: 'left', background: 'transparent', border: 'none', color: CLAY.muted, padding: '11px 14px', borderRadius: 14, cursor: 'pointer', fontSize: 14, fontWeight: 600 },
  navItemActive: { background: CLAY.surface, color: CLAY.accent, boxShadow: CLAY.raisedSm },
  content: { flex: 1, padding: 28, overflowY: 'auto' },
  h2: { fontSize: 22, fontWeight: 800, marginBottom: 18 },
  statCard: { background: CLAY.surface, borderRadius: 20, padding: 20, boxShadow: CLAY.raisedSm },
  input: { width: '100%', boxSizing: 'border-box', padding: 12, borderRadius: CLAY.rSm, border: 'none', background: CLAY.bgDeep, color: '#fff', marginBottom: 12, fontSize: 14, boxShadow: CLAY.pressed, outline: 'none' },
  select: { padding: 12, borderRadius: CLAY.rSm, border: 'none', background: CLAY.bgDeep, color: '#fff', fontSize: 14, boxShadow: CLAY.pressed, outline: 'none' },
  primaryBtn: { width: '100%', padding: 13, borderRadius: CLAY.rPill, border: 'none', background: CLAY.accentGrad, color: '#1a2e05', fontWeight: 800, cursor: 'pointer', boxShadow: CLAY.btnGreen },
  primaryBtnSm: { padding: '0 20px', borderRadius: CLAY.rPill, border: 'none', background: CLAY.accentGrad, color: '#1a2e05', fontWeight: 800, cursor: 'pointer', fontSize: 14, boxShadow: CLAY.btnGreen },
  ghostSm: { background: CLAY.surfaceAlt, border: 'none', color: CLAY.text, borderRadius: CLAY.rPill, padding: '6px 12px', cursor: 'pointer', fontSize: 12, fontWeight: 600, boxShadow: CLAY.raisedSm },
  tableWrap: { background: CLAY.surface, borderRadius: CLAY.r, overflow: 'auto', boxShadow: CLAY.raisedSm },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  trHead: { background: 'rgba(0,0,0,0.2)', textAlign: 'left' },
  th: { padding: '13px 16px', fontWeight: 600, color: CLAY.muted, fontSize: 12, whiteSpace: 'nowrap' },
  tr: { borderTop: '1px solid rgba(255,255,255,0.04)' },
  td: { padding: '12px 16px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 },
  modal: { background: CLAY.surface, borderRadius: CLAY.r, padding: 24, width: '100%', maxWidth: 420, boxShadow: CLAY.raised },
  xBtn: { background: 'transparent', border: 'none', color: CLAY.muted, cursor: 'pointer', fontSize: 16 },
};
