import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart3, Users, Flag, Shield, LogOut, Search,
  Ban, CheckCircle, Trash2, Plus, ChevronLeft, ChevronRight,
  RefreshCw, Eye, X, CreditCard, Copy, Phone, Wifi, Bell, FileText, Heart, MessageCircle, Crown,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';

const API = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api/v1';
const KEY_STORAGE = 'mango_admin_key';

// ─── Country helpers ──────────────────────────────────────────────────────────
const _regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
function countryName(code: string): string {
  try { return _regionNames.of(code.toUpperCase()) ?? code; } catch { return code; }
}
// regionLabel used in <select> options (plain string)
function regionLabel(code: string): string {
  return `${code.toUpperCase()} — ${countryName(code)}`;
}
// RegionDisplay used in table cells (JSX with styled badge)
function RegionDisplay({ code }: { code: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-zinc-300 tracking-wider">{code.toUpperCase()}</span>
      <span className="text-zinc-300 text-xs">{countryName(code)}</span>
    </span>
  );
}

function adminApi(key: string) {
  return axios.create({
    baseURL: API,
    headers: { 'x-admin-key': key },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Stats {
  users: number;
  bannedUsers: number;
  openReports: number;
  ipBans: number;
  totalCalls: number;
  totalMinutes: number;
  maleUsers: number;
  femaleUsers: number;
  totalRevenue: number;
  premiumUsers: number;
  revenueByPlan: { '7day': number; '15day': number; '30day': number };
}

interface Report {
  id: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  reporter: { id: string; anonAlias: string; region: string | null };
  reported: { id: string; anonAlias: string; region: string | null; isBanned: boolean };
}

interface AdminUser {
  id: string;
  anonAlias: string;
  email: string | null;
  region: string | null;
  gender: string | null;
  interests: string[];
  isBanned: boolean;
  banUntil: string | null;
  isPremium: boolean;
  isLinked: boolean;
  lastActiveAt: string | null;
  createdAt: string;
  _count: { sentReports: number; receivedReports: number };
}

interface IpBan {
  id: string;
  ip: string;
  reason: string | null;
  createdAt: string;
  expiresAt: string | null;
}

interface PaymentRequest {
  id: string;
  userId: string;
  method: string;
  transactionId: string;
  amount: number;
  plan: string;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; anonAlias: string };
}

interface AdminCall {
  id: string;
  roomId: string;
  startedAt: string;
  endedAt: string | null;
  durationSecs: number | null;
  endReason: string | null;
  userA: { id: string; anonAlias: string };
  userB: { id: string; anonAlias: string };
}

interface IpInfo { deviceId: string; ips: string[]; latestIp: string | null }

type Tab = 'stats' | 'reports' | 'users' | 'ip-bans' | 'payments' | 'calls' | 'posts';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function formatDur(secs: number | null) {
  if (!secs) return '—';
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const REASON_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  inappropriate: 'Inappropriate',
  hate_speech: 'Hate Speech',
  other: 'Other',
};

const AVATAR_COLORS = [
  'bg-red-400', 'bg-orange-400', 'bg-amber-400', 'bg-yellow-400',
  'bg-lime-500', 'bg-green-500', 'bg-teal-500', 'bg-cyan-500',
  'bg-sky-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500',
  'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500',
];

// ─── Shared UI Components ─────────────────────────────────────────────────────

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

const BADGE_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-green-500/15 text-green-400 border border-green-500/30',
  warning: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  danger:  'bg-red-500/15 text-red-400 border border-red-500/30',
  info:    'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  purple:  'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  neutral: 'bg-white/8 text-zinc-300 border border-white/12',
};

function Badge({ text, variant }: { text: string; variant: BadgeVariant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${BADGE_CLASSES[variant]}`}>
      {text}
    </span>
  );
}

function InitialAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const code = name.charCodeAt(0) % AVATAR_COLORS.length;
  const color = AVATAR_COLORS[code];
  const sizeClass = size === 'sm' ? 'w-7 h-7 text-xs' : size === 'lg' ? 'w-12 h-12 text-lg' : 'w-9 h-9 text-sm';
  return (
    <div className={`${color} ${sizeClass} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  onRefresh,
  searchValue,
  onSearch,
}: {
  title: string;
  subtitle?: string;
  onRefresh: () => void;
  searchValue?: string;
  onSearch?: (v: string) => void;
}) {
  const [localInput, setLocalInput] = useState(searchValue ?? '');

  useEffect(() => { setLocalInput(searchValue ?? ''); }, [searchValue]);

  return (
    <div className="flex flex-col gap-3 mb-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-white font-bold text-lg md:text-xl">{title}</h1>
          {subtitle && <p className="text-zinc-400 text-xs md:text-sm mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 shadow-sm transition-colors shrink-0"
        >
          <RefreshCw size={15} />
        </button>
      </div>
      {onSearch !== undefined && (
        <div className="relative w-full">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={localInput}
            onChange={e => setLocalInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSearch(localInput); }}
            placeholder="Search..."
            className="w-full bg-white/8 border border-white/12 rounded-xl text-sm text-white placeholder:text-zinc-500 pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 shadow-sm"
          />
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color, bgColor }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}) {
  return (
    <div className="bg-[#17171F] rounded-2xl border border-white/8 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bgColor}`}>
        <span className={color}>{icon}</span>
      </div>
      <div>
        <p className="text-zinc-400 text-xs font-medium">{label}</p>
        <p className="text-white text-2xl font-bold leading-tight">{value.toLocaleString()}</p>
      </div>
    </div>
  );
}

function Pagination({ page, total, limit, onChange }: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-white/8 mt-2">
      <span className="text-xs text-zinc-500">{total} total</span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-xs text-zinc-400">{page} / {pages}</span>
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 text-zinc-400 hover:text-white transition-colors"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

// ─── Right-side Detail Panels ─────────────────────────────────────────────────

function PanelShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
        <span className="font-semibold text-white">{title}</span>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/8 text-zinc-500 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {children}
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 font-medium mb-0.5">{label}</p>
      <div className="text-sm text-white">{value}</div>
    </div>
  );
}

function InfoCard({ children }: { children: React.ReactNode }) {
  return <div className="bg-white/5 rounded-xl p-4 space-y-3">{children}</div>;
}

// ─── Landscape Modal Shell ────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col" style={{ maxHeight: '88vh' }}>
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 shrink-0">
        <span className="font-bold text-white text-[15px] tracking-tight">{title}</span>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/5 hover:bg-white/12 text-zinc-400 hover:text-white transition-colors"
        >
          <X size={15} />
        </button>
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function ModalLeft({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4 min-w-0">
      {children}
    </div>
  );
}

function ModalRight({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="w-px bg-white/8 shrink-0" />
      <div className="w-64 shrink-0 overflow-y-auto p-5 space-y-4" style={{ background: 'rgba(255,255,255,0.015)' }}>
        {children}
      </div>
    </>
  );
}

function ReportPanel({
  report,
  api,
  onClose,
  onUpdate,
}: {
  report: Report;
  api: ReturnType<typeof adminApi>;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [banning, setBanning] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentStatus, setCurrentStatus] = useState(report.status);

  async function updateStatus(status: string) {
    setUpdating(status);
    try {
      await api.patch(`/admin/reports/${report.id}`, { status });
      setCurrentStatus(status);
      onUpdate();
    } catch (e) { console.error(e); } finally { setUpdating(null); }
  }

  async function banUser() {
    setBanning(true);
    try {
      await api.post(`/admin/users/${report.reported.id}/ban`, { reason: 'Banned via report review', banIp: true });
      onUpdate();
      onClose();
    } catch (e) { console.error(e); } finally { setBanning(false); }
  }

  const statusVariant: Record<string, BadgeVariant> = { open: 'warning', reviewed: 'info', closed: 'neutral' };

  return (
    <ModalShell title="Report Detail" onClose={onClose}>
      <ModalLeft>
        {/* Reporter vs Reported */}
        <div className="grid grid-cols-2 gap-3">
          {([
            { label: 'Reporter', alias: report.reporter.anonAlias, region: report.reporter.region, isBanned: false },
            { label: 'Reported', alias: report.reported.anonAlias, region: report.reported.region, isBanned: report.reported.isBanned },
          ] as { label: string; alias: string; region: string | null; isBanned: boolean }[]).map(({ label, alias, region, isBanned }) => (
            <div key={label} className="bg-white/5 rounded-xl p-3.5">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">{label}</p>
              <div className="flex items-center gap-2.5">
                <InitialAvatar name={alias} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{alias}</p>
                  <p className="text-xs text-zinc-500">{region ?? '—'}</p>
                  {isBanned && <Badge text="BANNED" variant="danger" />}
                </div>
              </div>
            </div>
          ))}
        </div>

        <InfoCard>
          <InfoRow label="Reason" value={<span className="font-semibold">{REASON_LABELS[report.reason] ?? report.reason}</span>} />
          {report.description && <InfoRow label="Description" value={<span className="text-zinc-300 leading-relaxed">{report.description}</span>} />}
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Submitted" value={new Date(report.createdAt).toLocaleString()} />
            <InfoRow label="Status" value={<Badge text={currentStatus} variant={statusVariant[currentStatus] ?? 'neutral'} />} />
          </div>
        </InfoCard>
      </ModalLeft>

      <ModalRight>
        <div>
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2.5">Update Status</p>
          <div className="flex flex-col gap-1.5">
            {(['open', 'reviewed', 'closed'] as const).map(s => (
              <button
                key={s}
                onClick={() => updateStatus(s)}
                disabled={!!updating}
                className={`w-full px-3 py-2 rounded-xl text-xs font-semibold border transition-all capitalize ${
                  currentStatus === s
                    ? 'bg-white text-gray-900 border-white'
                    : 'bg-white/5 text-zinc-300 border-white/10 hover:border-white/25 hover:bg-white/8 hover:text-white'
                } disabled:opacity-50`}
              >
                {updating === s ? '...' : s}
              </button>
            ))}
          </div>
        </div>

        {!report.reported.isBanned && (
          <>
            <div className="h-px bg-white/8" />
            <button
              onClick={banUser}
              disabled={banning}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              <Ban size={14} /> {banning ? 'Banning...' : 'Ban User + IP'}
            </button>
          </>
        )}
      </ModalRight>
    </ModalShell>
  );
}

function UserPanel({
  user,
  api,
  onClose,
  onUpdate,
}: {
  user: AdminUser;
  api: ReturnType<typeof adminApi>;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [ipInfo, setIpInfo] = useState<IpInfo | 'loading' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [premiumPlan, setPremiumPlan] = useState('30day');

  async function banUser() {
    setActing(true);
    try { await api.post(`/admin/users/${user.id}/ban`, { banIp: true }); onUpdate(); onClose(); }
    catch (e) { console.error(e); } finally { setActing(false); }
  }

  async function unbanUser() {
    setActing(true);
    try { await api.post(`/admin/users/${user.id}/unban`); onUpdate(); onClose(); }
    catch (e) { console.error(e); } finally { setActing(false); }
  }

  async function grantPremium() {
    setActing(true);
    try { await api.post(`/admin/users/${user.id}/set-premium`, { isPremium: true, plan: premiumPlan }); onUpdate(); onClose(); }
    catch (e) { console.error(e); } finally { setActing(false); }
  }

  async function revokePremium() {
    setActing(true);
    try { await api.post(`/admin/users/${user.id}/set-premium`, { isPremium: false }); onUpdate(); onClose(); }
    catch (e) { console.error(e); } finally { setActing(false); }
  }

  async function loadIpInfo() {
    if (ipInfo !== null) { setIpInfo(null); return; }
    setIpInfo('loading');
    try {
      const res = await api.get<IpInfo>(`/admin/users/${user.id}/ip`);
      setIpInfo(res.data);
    } catch { setIpInfo(null); }
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <ModalShell title="User Detail" onClose={onClose}>
      <ModalLeft>
        {/* Identity */}
        <div className="flex items-start gap-4">
          <InitialAvatar name={user.anonAlias} size="lg" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white text-base leading-tight truncate">{user.anonAlias}</p>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {user.isBanned && <Badge text="BANNED" variant="danger" />}
              {user.isPremium && <Badge text="PRO" variant="warning" />}
              {user.isLinked && <Badge text="Google" variant="info" />}
              {user.gender && (
                <Badge text={user.gender === 'male' ? '♂ Male' : '♀ Female'} variant={user.gender === 'male' ? 'info' : 'purple'} />
              )}
            </div>
            {user.isLinked && user.email && (
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-xs text-zinc-400">{user.email}</span>
                <button onClick={() => copyText(user.email!)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                  {copied === user.email ? <CheckCircle size={11} className="text-green-500" /> : <Copy size={11} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Info grid */}
        <InfoCard>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Account Type" value={user.isLinked ? 'Google Account' : 'Anonymous'} />
            <InfoRow label="Region" value={user.region ? <RegionDisplay code={user.region} /> : '—'} />
            <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleString()} />
            <InfoRow label="Last Active" value={user.lastActiveAt ? new Date(user.lastActiveAt).toLocaleString() : '—'} />
            <InfoRow label="Reports Received" value={user._count.receivedReports} />
            <InfoRow label="Reports Sent" value={user._count.sentReports} />
          </div>
          {user.banUntil && <InfoRow label="Banned Until" value={new Date(user.banUntil).toLocaleString()} />}
          {user.interests && user.interests.length > 0 && (
            <div>
              <p className="text-xs text-zinc-500 font-medium mb-1.5">Interests</p>
              <div className="flex flex-wrap gap-1">
                {user.interests.map(slug => (
                  <span key={slug} className="text-[10px] px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-zinc-300">{slug}</span>
                ))}
              </div>
            </div>
          )}
        </InfoCard>

        {/* IP Info */}
        <button
          onClick={loadIpInfo}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/8 border border-white/12 text-zinc-300 text-sm font-medium hover:border-white/20 transition-colors"
        >
          <Wifi size={14} /> {ipInfo !== null ? 'Hide IP Info' : 'Show IP Info'}
        </button>
        {ipInfo === 'loading' && <div className="text-center text-zinc-500 text-sm py-2">Loading...</div>}
        {ipInfo && ipInfo !== 'loading' && (
          <InfoCard>
            <div>
              <p className="text-xs text-zinc-500 font-medium mb-1">Latest IP</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-white">{ipInfo.latestIp ?? 'Unknown'}</span>
                {ipInfo.latestIp && (
                  <button onClick={() => copyText(ipInfo.latestIp!)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    {copied === ipInfo.latestIp ? <CheckCircle size={12} className="text-green-600" /> : <Copy size={12} />}
                  </button>
                )}
              </div>
            </div>
            {ipInfo.ips.length > 1 && (
              <div>
                <p className="text-xs text-zinc-500 font-medium mb-1">All IPs</p>
                <div className="flex flex-wrap gap-1">
                  {ipInfo.ips.map(ip => (
                    <span key={ip} className="font-mono text-[10px] bg-white/8 border border-white/12 text-zinc-300 px-2 py-0.5 rounded">{ip}</span>
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="text-xs text-zinc-500 font-medium mb-1">Device ID</p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-zinc-300 truncate">{ipInfo.deviceId}</span>
                <button onClick={() => copyText(ipInfo.deviceId)} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
                  {copied === ipInfo.deviceId ? <CheckCircle size={12} className="text-green-600" /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          </InfoCard>
        )}
      </ModalLeft>

      <ModalRight>
        {/* Premium */}
        <div>
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2.5">Premium</p>
          {user.isPremium ? (
            <button
              onClick={revokePremium}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              <Trash2 size={14} /> {acting ? 'Revoking...' : 'Revoke Premium'}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <select
                value={premiumPlan}
                onChange={e => setPremiumPlan(e.target.value)}
                className="w-full text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                style={{ background: '#17171F', border: '1px solid rgba(255,255,255,0.12)', colorScheme: 'dark' }}
              >
                <option value="7day">7 Days</option>
                <option value="15day">15 Days</option>
                <option value="30day">30 Days</option>
              </select>
              <button
                onClick={grantPremium}
                disabled={acting}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
              >
                <Crown size={14} /> {acting ? '...' : 'Grant Premium'}
              </button>
            </div>
          )}
        </div>

        <div className="h-px bg-white/8" />

        {/* Ban */}
        <div>
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2.5">Account</p>
          {user.isBanned ? (
            <button
              onClick={unbanUser}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              <CheckCircle size={14} /> {acting ? 'Unbanning...' : 'Unban User'}
            </button>
          ) : (
            <button
              onClick={banUser}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              <Ban size={14} /> {acting ? 'Banning...' : 'Ban User + IP'}
            </button>
          )}
        </div>
      </ModalRight>
    </ModalShell>
  );
}

function PaymentPanel({
  payment,
  api,
  onClose,
  onUpdate,
}: {
  payment: PaymentRequest;
  api: ReturnType<typeof adminApi>;
  onClose: () => void;
  onUpdate: () => void;
}) {
  const [acting, setActing] = useState(false);
  const [plan, setPlan] = useState(payment.plan);
  const [rejectNote, setRejectNote] = useState('');
  const [copied, setCopied] = useState(false);

  async function approve() {
    setActing(true);
    try { await api.post(`/admin/payments/${payment.id}/approve`, { plan }); onUpdate(); onClose(); }
    catch (e) { console.error(e); } finally { setActing(false); }
  }

  async function reject() {
    setActing(true);
    try {
      await api.post(`/admin/payments/${payment.id}/reject`, { note: rejectNote.trim() || undefined });
      onUpdate(); onClose();
    } catch (e) { console.error(e); } finally { setActing(false); }
  }

  async function cancelSubscription() {
    setActing(true);
    try { await api.post(`/admin/users/${payment.user.id}/cancel-subscription`); onUpdate(); onClose(); }
    catch (e) { console.error(e); } finally { setActing(false); }
  }

  function copyTx() {
    navigator.clipboard.writeText(payment.transactionId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const statusVariant: Record<string, BadgeVariant> = { pending: 'warning', approved: 'success', rejected: 'danger' };

  return (
    <ModalShell title="Payment Detail" onClose={onClose}>
      <ModalLeft>
        {/* User */}
        <div className="flex items-center gap-4">
          <InitialAvatar name={payment.user.anonAlias} size="lg" />
          <div>
            <p className="font-bold text-white text-base">{payment.user.anonAlias}</p>
            <div className="flex gap-1.5 mt-1.5">
              <Badge text={payment.status} variant={statusVariant[payment.status] ?? 'neutral'} />
              <Badge text={payment.plan} variant="purple" />
            </div>
          </div>
        </div>

        <InfoCard>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Method" value={<span className="capitalize font-semibold">{payment.method}</span>} />
            <InfoRow label="Amount" value={<span className="font-bold text-emerald-400 text-base">{payment.amount} ৳</span>} />
            <InfoRow label="Submitted" value={timeAgo(payment.createdAt)} />
            {payment.reviewedAt && <InfoRow label="Reviewed At" value={new Date(payment.reviewedAt).toLocaleString()} />}
          </div>
          {payment.reviewNote && <InfoRow label="Review Note" value={<span className="text-zinc-300">{payment.reviewNote}</span>} />}
          <div>
            <p className="text-xs text-zinc-500 font-medium mb-1">Transaction ID</p>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-zinc-300 bg-white/10 px-2 py-1 rounded-lg truncate flex-1">{payment.transactionId}</span>
              <button onClick={copyTx} className="text-zinc-600 hover:text-zinc-300 transition-colors shrink-0">
                {copied ? <CheckCircle size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
        </InfoCard>
      </ModalLeft>

      <ModalRight>
        {payment.status === 'approved' && (
          <div>
            <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2.5">Actions</p>
            <button
              onClick={cancelSubscription}
              disabled={acting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
            >
              <Trash2 size={14} /> {acting ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          </div>
        )}

        {payment.status === 'pending' && (
          <>
            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2.5">Approve</p>
              <div className="flex flex-col gap-2">
                <select
                  value={plan}
                  onChange={e => setPlan(e.target.value)}
                  className="w-full text-white text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500/40"
                  style={{ background: '#17171F', border: '1px solid rgba(255,255,255,0.12)', colorScheme: 'dark' }}
                >
                  <option value="7day">7 Days — 25৳</option>
                  <option value="15day">15 Days — 50৳</option>
                  <option value="30day">30 Days — 100৳</option>
                </select>
                <button
                  onClick={approve}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <CheckCircle size={14} /> {acting ? 'Approving...' : 'Approve Payment'}
                </button>
              </div>
            </div>

            <div className="h-px bg-white/8" />

            <div>
              <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-2.5">Reject</p>
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Reason (optional)..."
                  className="w-full bg-white/8 border border-white/12 text-white placeholder:text-zinc-500 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-red-500/50"
                />
                <button
                  onClick={reject}
                  disabled={acting}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-all disabled:opacity-50"
                >
                  <X size={14} /> {acting ? 'Rejecting...' : 'Reject Payment'}
                </button>
              </div>
            </div>
          </>
        )}

        {payment.status === 'rejected' && (
          <div className="flex flex-col items-center justify-center h-24 gap-2 text-zinc-600">
            <X size={24} className="opacity-40" />
            <p className="text-xs">Payment rejected</p>
          </div>
        )}
      </ModalRight>
    </ModalShell>
  );
}

function CallPanel({ call, onClose }: { call: AdminCall; onClose: () => void }) {
  const endReasonVariant: Record<string, BadgeVariant> = {
    hangup: 'info',
    skip: 'warning',
    disconnect: 'danger',
    ban: 'danger',
  };

  return (
    <ModalShell title="Call Detail" onClose={onClose}>
      <ModalLeft>
        {/* Users */}
        <div className="flex items-center gap-4">
          <div className="flex-1 bg-white/5 rounded-xl p-4 flex items-center gap-3">
            <InitialAvatar name={call.userA.anonAlias} size="md" />
            <div>
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">User A</p>
              <p className="font-semibold text-white text-sm">{call.userA.anonAlias}</p>
            </div>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center shrink-0">
            <Phone size={14} className="text-zinc-500" />
          </div>
          <div className="flex-1 bg-white/5 rounded-xl p-4 flex items-center gap-3">
            <InitialAvatar name={call.userB.anonAlias} size="md" />
            <div>
              <p className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider mb-0.5">User B</p>
              <p className="font-semibold text-white text-sm">{call.userB.anonAlias}</p>
            </div>
          </div>
        </div>

        <InfoCard>
          <div className="grid grid-cols-2 gap-3">
            <InfoRow label="Started At" value={new Date(call.startedAt).toLocaleString()} />
            {call.endedAt && <InfoRow label="Ended At" value={new Date(call.endedAt).toLocaleString()} />}
          </div>
          <InfoRow label="Room ID" value={<span className="font-mono text-xs text-zinc-400 break-all">{call.roomId}</span>} />
        </InfoCard>
      </ModalLeft>

      <ModalRight>
        <div>
          <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wider mb-3">Call Stats</p>
          <div className="space-y-3">
            <div className="bg-white/5 rounded-xl p-3.5 text-center">
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1">Duration</p>
              <p className={`text-xl font-bold ${call.durationSecs && call.durationSecs > 0 ? 'text-green-400' : 'text-zinc-600'}`}>
                {formatDur(call.durationSecs)}
              </p>
            </div>
            <div className="bg-white/5 rounded-xl p-3.5 text-center">
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-1.5">End Reason</p>
              {call.endReason
                ? <Badge text={call.endReason} variant={endReasonVariant[call.endReason] ?? 'neutral'} />
                : <Badge text="ongoing" variant="success" />
              }
            </div>
          </div>
        </div>
      </ModalRight>
    </ModalShell>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type DayRange = 7 | 30 | 90;

interface DailyStat { date: string; calls: number; users: number }

function StatsTab({ api, reloadKey }: { api: ReturnType<typeof adminApi>; reloadKey: number }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [daily, setDaily] = useState<DailyStat[]>([]);
  const [days, setDays] = useState<DayRange>(30);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const loadStats = useCallback(() => {
    setLoading(true);
    api.get('/admin/stats').then(r => setStats(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [api, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadChart = useCallback(() => {
    setChartLoading(true);
    api.get<DailyStat[]>(`/admin/stats/daily?days=${days}`)
      .then(r => setDaily(r.data))
      .catch(console.error)
      .finally(() => setChartLoading(false));
  }, [api, days, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadChart(); }, [loadChart]);

  async function handleReset() {
    if (resetConfirm !== 'DELETE ALL') return;
    setResetting(true);
    try {
      await api.post('/admin/reset/users');
      setResetDone(true);
      setShowResetModal(false);
      setResetConfirm('');
      loadStats();
      loadChart();
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  }

  function fmt(dateStr: string) {
    const d = new Date(dateStr);
    return days === 7
      ? d.toLocaleDateString('en-US', { weekday: 'short' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  const chartData = daily.map(d => ({ ...d, label: fmt(d.date) }));

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#1C1C28] border border-white/10 rounded-xl shadow-lg px-4 py-3 text-sm">
        <p className="text-zinc-400 font-medium mb-2">{label}</p>
        {payload.map(p => (
          <p key={p.name} style={{ color: p.color }} className="font-semibold">
            {p.name}: {p.value}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Statistics</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Platform overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { loadStats(); loadChart(); }}
            className="p-2 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => { setShowResetModal(true); setResetConfirm(''); setResetDone(false); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors"
          >
            <Trash2 size={15} /> Reset All Users
          </button>
        </div>
      </div>

      {resetDone && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-sm">
          <CheckCircle size={16} /> Database cleared successfully. Fresh start!
        </div>
      )}

      {/* Stat cards */}
      {loading ? (
        <div className="flex items-center justify-center h-24 text-zinc-500 text-sm">Loading...</div>
      ) : stats && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            <StatCard label="Total Users" value={stats.users} icon={<Users size={20} />} color="text-blue-600" bgColor="bg-blue-500/20" />
            <StatCard label="Banned" value={stats.bannedUsers} icon={<Ban size={20} />} color="text-red-600" bgColor="bg-red-500/20" />
            <StatCard label="Open Reports" value={stats.openReports} icon={<Flag size={20} />} color="text-amber-600" bgColor="bg-amber-500/20" />
            <StatCard label="IP Bans" value={stats.ipBans} icon={<Shield size={20} />} color="text-purple-600" bgColor="bg-purple-500/20" />
            <StatCard label="Total Calls" value={stats.totalCalls} icon={<BarChart3 size={20} />} color="text-green-600" bgColor="bg-green-500/20" />
            <StatCard label="Total Minutes" value={stats.totalMinutes ?? 0} icon={<Phone size={20} />} color="text-cyan-500" bgColor="bg-cyan-500/20" />
            <StatCard label="Male Users" value={stats.maleUsers ?? 0} icon={<Users size={20} />} color="text-blue-500" bgColor="bg-blue-500/20" />
            <StatCard label="Female Users" value={stats.femaleUsers ?? 0} icon={<Users size={20} />} color="text-pink-500" bgColor="bg-pink-500/20" />
            <StatCard label="Premium Users" value={stats.premiumUsers ?? 0} icon={<Crown size={20} />} color="text-amber-500" bgColor="bg-amber-500/20" />
            <StatCard label="Total Revenue (৳)" value={stats.totalRevenue ?? 0} icon={<span className="text-lg font-bold">৳</span>} color="text-emerald-400" bgColor="bg-emerald-500/20" />
          </div>
          {/* Revenue breakdown by plan */}
          {(stats.totalRevenue ?? 0) > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3">
              {(['7day', '15day', '30day'] as const).map(plan => (
                <div key={plan} className="bg-[#17171F] rounded-2xl border border-white/8 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-semibold uppercase tracking-wide">{plan === '7day' ? '7 Days' : plan === '15day' ? '15 Days' : '30 Days'}</p>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">৳ {(stats.revenueByPlan?.[plan] ?? 0).toLocaleString()}</p>
                  </div>
                  <span className="text-2xl opacity-30">{plan === '7day' ? '⚡' : plan === '15day' ? '🌟' : '👑'}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Chart card */}
      <div className="bg-[#17171F] rounded-2xl border border-white/8 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-white">Activity</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Calls and new users over time</p>
          </div>
          <div className="flex items-center gap-1 bg-white/8 p-1 rounded-xl">
            {([7, 30, 90] as DayRange[]).map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  days === d ? 'bg-white/15 text-white shadow-sm' : 'text-zinc-500 hover:text-white'
                }`}
              >
                {d === 7 ? '7 days' : d === 30 ? '30 days' : '90 days'}
              </button>
            ))}
          </div>
        </div>

        {chartLoading ? (
          <div className="flex items-center justify-center h-64 text-zinc-500 text-sm">Loading chart...</div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="callsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="usersGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                interval={days === 90 ? 9 : days === 30 ? 4 : 0}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                formatter={(value: string) => <span style={{ color: '#6B7280' }}>{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="calls"
                name="Calls"
                stroke="#7C3AED"
                strokeWidth={2}
                fill="url(#callsGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#7C3AED' }}
              />
              <Area
                type="monotone"
                dataKey="users"
                name="New Users"
                stroke="#059669"
                strokeWidth={2}
                fill="url(#usersGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#059669' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowResetModal(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative bg-[#17171F] rounded-2xl shadow-2xl border border-red-500/30 w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                  <Trash2 size={20} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Reset All Users</h3>
                  <p className="text-zinc-400 text-sm">This action is irreversible</p>
                </div>
              </div>

              <div className="bg-red-500/10 border border-red-500/25 rounded-xl p-4 space-y-1.5 text-sm">
                <p className="text-red-400 font-semibold">The following will be permanently deleted:</p>
                <ul className="text-red-300/80 space-y-0.5 list-disc list-inside">
                  <li>All user accounts</li>
                  <li>All sessions & authentication tokens</li>
                  <li>All calls & call history</li>
                  <li>All friends & friend requests</li>
                  <li>All reports</li>
                  <li>All payment requests & notifications</li>
                </ul>
                <p className="text-red-400 font-semibold pt-1">IP Bans will NOT be deleted.</p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm text-zinc-400">
                  Type <span className="font-mono font-bold text-red-400">DELETE ALL</span> to confirm:
                </label>
                <input
                  type="text"
                  value={resetConfirm}
                  onChange={e => setResetConfirm(e.target.value)}
                  placeholder="DELETE ALL"
                  autoFocus
                  className="w-full bg-white/8 border border-white/12 text-white placeholder:text-zinc-600 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500/60"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  disabled={resetConfirm !== 'DELETE ALL' || resetting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-all"
                >
                  <Trash2 size={15} />
                  {resetting ? 'Deleting...' : 'Delete Everything'}
                </button>
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-4 py-2.5 bg-white/8 hover:bg-white/15 text-zinc-300 rounded-xl text-sm transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CallsTab({
  api,
  reloadKey,
  selectedCall,
  onSelectCall,
}: {
  api: ReturnType<typeof adminApi>;
  reloadKey: number;
  selectedCall: AdminCall | null;
  onSelectCall: (c: AdminCall | null) => void;
}) {
  const [calls, setCalls] = useState<AdminCall[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ data: AdminCall[]; total: number }>(`/admin/calls?page=${page}&limit=${limit}`);
      setCalls(res.data.data);
      setTotal(res.data.total);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [api, page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const endReasonVariant: Record<string, BadgeVariant> = { hangup: 'info', skip: 'warning', disconnect: 'danger', ban: 'danger' };

  return (
    <>
      <PageHeader title="Call History" subtitle={`${total} total calls`} onRefresh={load} />

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading...</div>
      ) : calls.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
          <Phone size={28} className="opacity-30" />
          <p className="text-sm">No calls yet</p>
        </div>
      ) : (
        <div className="bg-[#17171F] rounded-2xl border border-white/8 shadow-sm overflow-hidden overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/8 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">User A</th>
                <th className="text-left px-4 py-3 font-semibold">User B</th>
                <th className="text-left px-4 py-3 font-semibold">Duration</th>
                <th className="text-left px-4 py-3 font-semibold">End Reason</th>
                <th className="text-left px-4 py-3 font-semibold">Started At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {calls.map(c => (
                <tr
                  key={c.id}
                  onClick={() => onSelectCall(selectedCall?.id === c.id ? null : c)}
                  className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedCall?.id === c.id ? 'bg-purple-500/15' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={c.userA.anonAlias} size="sm" />
                      <span className="text-white font-medium">{c.userA.anonAlias}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={c.userB.anonAlias} size="sm" />
                      <span className="text-white font-medium">{c.userB.anonAlias}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${c.durationSecs && c.durationSecs > 0 ? 'text-green-600' : 'text-zinc-500'}`}>
                      {formatDur(c.durationSecs)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.endReason
                      ? <Badge text={c.endReason} variant={endReasonVariant[c.endReason] ?? 'neutral'} />
                      : <Badge text="ongoing" variant="success" />
                    }
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{new Date(c.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-white/8 bg-white/5">
              <span className="text-xs text-zinc-500">{total} total</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16} /></button>
                <span className="text-xs text-zinc-400">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded-lg hover:bg-white/10 disabled:opacity-30 text-zinc-400 hover:text-white transition-colors"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function ReportsTab({
  api,
  reloadKey,
  selectedReport,
  onSelectReport,
}: {
  api: ReturnType<typeof adminApi>;
  reloadKey: number;
  selectedReport: Report | null;
  onSelectReport: (r: Report | null) => void;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/reports', { params: { status: statusFilter || undefined, page, limit: 15 } })
      .then(r => { setReports(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api, statusFilter, page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter]);

  const statusVariant: Record<string, BadgeVariant> = { open: 'warning', reviewed: 'info', closed: 'neutral' };

  return (
    <>
      <PageHeader title="Reports" subtitle="User-submitted reports" onRefresh={load} />

      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-zinc-500 text-xs font-medium">Filter:</span>
        {['', 'open', 'reviewed', 'closed'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
              statusFilter === s
                ? 'bg-white text-gray-900 border-white'
                : 'bg-white/8 border-white/12 text-zinc-400 hover:border-white/25 hover:text-white'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
          <Flag size={28} className="opacity-30" />
          <p className="text-sm">No reports found</p>
        </div>
      ) : (
        <div className="bg-[#17171F] rounded-2xl border border-white/8 shadow-sm overflow-hidden overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/8 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">Reported</th>
                <th className="text-left px-4 py-3 font-semibold">Reason</th>
                <th className="text-left px-4 py-3 font-semibold">Reporter</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {reports.map(r => (
                <tr
                  key={r.id}
                  onClick={() => onSelectReport(selectedReport?.id === r.id ? null : r)}
                  className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedReport?.id === r.id ? 'bg-purple-500/15' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={r.reported.anonAlias} size="sm" />
                      <div>
                        <p className="text-white font-medium">{r.reported.anonAlias}</p>
                        {r.reported.isBanned && <Badge text="BANNED" variant="danger" />}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{REASON_LABELS[r.reason] ?? r.reason}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{r.reporter.anonAlias}</td>
                  <td className="px-4 py-3"><Badge text={r.status} variant={statusVariant[r.status] ?? 'neutral'} /></td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{timeAgo(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Eye size={14} className="text-zinc-500 hover:bg-white/8 hover:text-white" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <Pagination page={page} total={total} limit={15} onChange={setPage} />
          </div>
        </div>
      )}
    </>
  );
}

function UsersTab({
  api,
  reloadKey,
  selectedUser,
  onSelectUser,
}: {
  api: ReturnType<typeof adminApi>;
  reloadKey: number;
  selectedUser: AdminUser | null;
  onSelectUser: (u: AdminUser | null) => void;
}) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [maleCount, setMaleCount] = useState(0);
  const [femaleCount, setFemaleCount] = useState(0);
  const [linkedCount, setLinkedCount] = useState(0);
  const [anonymousCount, setAnonymousCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
  const [accountFilter, setAccountFilter] = useState<'all' | 'linked' | 'anonymous'>('all');
  const [regionFilter, setRegionFilter] = useState('');
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/users/regions').then(r => setAvailableRegions(r.data)).catch(() => {});
  }, [api, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(() => {
    setLoading(true);
    const isLinked = accountFilter === 'linked' ? 'true' : accountFilter === 'anonymous' ? 'false' : undefined;
    api.get('/admin/users', { params: { page, limit: 15, search: search || undefined, gender: genderFilter === 'all' ? undefined : genderFilter, region: regionFilter || undefined, isLinked } })
      .then(r => { setUsers(r.data.data); setTotal(r.data.total); setMaleCount(r.data.maleCount); setFemaleCount(r.data.femaleCount); setLinkedCount(r.data.linkedCount); setAnonymousCount(r.data.anonymousCount); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api, page, search, genderFilter, accountFilter, regionFilter, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, genderFilter, accountFilter, regionFilter]);

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Manage platform users"
        onRefresh={load}
        searchValue={search}
        onSearch={setSearch}
      />

      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Account type filter */}
        {([
          { key: 'all', label: 'All' },
          { key: 'linked', label: '✓ Google', count: linkedCount },
          { key: 'anonymous', label: '👤 Anonymous', count: anonymousCount },
        ] as { key: 'all' | 'linked' | 'anonymous'; label: string; count?: number }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setAccountFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              accountFilter === f.key
                ? f.key === 'linked'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : f.key === 'anonymous'
                  ? 'bg-zinc-500/20 border-zinc-500/50 text-zinc-300'
                  : 'bg-white/15 border-white/30 text-white'
                : 'bg-white/5 border-white/10 text-zinc-500 hover:bg-white/8 hover:text-zinc-300'
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${accountFilter === f.key ? 'bg-white/20' : 'bg-white/8'}`}>{f.count}</span>
            )}
          </button>
        ))}

        <div className="w-px h-4 bg-white/10 mx-1" />

        {/* Gender filter */}
        {([
          { key: 'all', label: 'All Genders' },
          { key: 'male', label: `♂ Male`, count: maleCount },
          { key: 'female', label: `♀ Female`, count: femaleCount },
        ] as { key: 'all' | 'male' | 'female'; label: string; count?: number }[]).map(f => (
          <button
            key={f.key}
            onClick={() => setGenderFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              genderFilter === f.key
                ? f.key === 'male'
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : f.key === 'female'
                  ? 'bg-pink-500/20 border-pink-500/50 text-pink-300'
                  : 'bg-white/15 border-white/30 text-white'
                : 'bg-white/5 border-white/10 text-zinc-500 hover:bg-white/8 hover:text-zinc-300'
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                genderFilter === f.key ? 'bg-white/20' : 'bg-white/8'
              }`}>{f.count}</span>
            )}
          </button>
        ))}

        {/* Country filter dropdown */}
        {availableRegions.length > 0 && (
          <select
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
            className={`ml-auto px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all outline-none cursor-pointer ${
              regionFilter
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/8'
            }`}
            style={{ background: regionFilter ? '#2d1f08' : '#1a1a24', colorScheme: 'dark' }}
          >
            <option value="">🌍 All Countries</option>
            {availableRegions.map(code => (
              <option key={code} value={code}>{regionLabel(code)}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading...</div>
      ) : users.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
          <Users size={28} className="opacity-30" />
          <p className="text-sm">No users found</p>
        </div>
      ) : (
        <div className="bg-[#17171F] rounded-2xl border border-white/8 shadow-sm overflow-hidden overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/8 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">User</th>
                <th className="text-left px-4 py-3 font-semibold">Gender</th>
                <th className="text-left px-4 py-3 font-semibold">Region</th>
                <th className="text-left px-4 py-3 font-semibold">Reports</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map(u => (
                <tr
                  key={u.id}
                  onClick={() => onSelectUser(selectedUser?.id === u.id ? null : u)}
                  className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedUser?.id === u.id ? 'bg-purple-500/15' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <InitialAvatar name={u.anonAlias} size="sm" />
                      <div>
                        <p className="text-white font-medium">{u.anonAlias}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {u.isLinked
                            ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/25">✓ Google</span>
                            : <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/15 text-zinc-400 border border-zinc-500/20">👤 Anon</span>
                          }
                          {u.isPremium && <Badge text="PRO" variant="warning" />}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.gender === 'male'
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/25">♂ Male</span>
                      : u.gender === 'female'
                      ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-500/15 text-pink-300 border border-pink-500/25">♀ Female</span>
                      : <span className="text-zinc-600 text-xs">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    {u.region ? <RegionDisplay code={u.region} /> : <span className="text-zinc-600 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{u._count.receivedReports}</td>
                  <td className="px-4 py-3">
                    {u.isBanned ? <Badge text="Banned" variant="danger" /> : <Badge text="Active" variant="success" />}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{timeAgo(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Eye size={14} className="text-zinc-500 hover:bg-white/8 hover:text-white" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <Pagination page={page} total={total} limit={15} onChange={setPage} />
          </div>
        </div>
      )}
    </>
  );
}

function PaymentsTab({
  api,
  reloadKey,
  selectedPayment,
  onSelectPayment,
}: {
  api: ReturnType<typeof adminApi>;
  reloadKey: number;
  selectedPayment: PaymentRequest | null;
  onSelectPayment: (p: PaymentRequest | null) => void;
}) {
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/payments', { params: { status: statusFilter || undefined, plan: planFilter || undefined, page, limit: 15 } })
      .then(r => { setPayments(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api, statusFilter, planFilter, page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [statusFilter, planFilter]);

  const statusVariant: Record<string, BadgeVariant> = { pending: 'warning', approved: 'success', rejected: 'danger' };

  return (
    <>
      <PageHeader title="Payments" subtitle="Payment requests" onRefresh={load} />

      <div className="flex items-center gap-2 flex-wrap mb-3">
        <span className="text-zinc-500 text-xs font-medium">Status:</span>
        {['', 'pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all capitalize ${
              statusFilter === s
                ? 'bg-white text-gray-900 border-white'
                : 'bg-white/8 border-white/12 text-zinc-400 hover:border-white/25 hover:text-white'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-zinc-500 text-xs font-medium">Plan:</span>
        {[{ val: '', label: 'All' }, { val: '7day', label: '7 Days' }, { val: '15day', label: '15 Days' }, { val: '30day', label: '30 Days' }].map(({ val, label }) => (
          <button
            key={val}
            onClick={() => setPlanFilter(val)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
              planFilter === val
                ? 'bg-purple-500 text-white border-purple-500'
                : 'bg-white/8 border-white/12 text-zinc-400 hover:border-white/25 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading...</div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
          <CreditCard size={28} className="opacity-30" />
          <p className="text-sm">No payment requests found</p>
        </div>
      ) : (
        <div className="bg-[#17171F] rounded-2xl border border-white/8 shadow-sm overflow-hidden overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/8 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">User</th>
                <th className="text-left px-4 py-3 font-semibold">Method</th>
                <th className="text-left px-4 py-3 font-semibold">Amount</th>
                <th className="text-left px-4 py-3 font-semibold">Plan</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {payments.map(p => (
                <tr
                  key={p.id}
                  onClick={() => onSelectPayment(selectedPayment?.id === p.id ? null : p)}
                  className={`hover:bg-white/5 cursor-pointer transition-colors ${selectedPayment?.id === p.id ? 'bg-purple-500/15' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={p.user.anonAlias} size="sm" />
                      <span className="text-white font-medium">{p.user.anonAlias}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 capitalize">{p.method}</td>
                  <td className="px-4 py-3 text-white font-semibold">{p.amount} ৳</td>
                  <td className="px-4 py-3"><Badge text={p.plan} variant="purple" /></td>
                  <td className="px-4 py-3"><Badge text={p.status} variant={statusVariant[p.status] ?? 'neutral'} /></td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{timeAgo(p.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Eye size={14} className="text-zinc-500 hover:bg-white/8 hover:text-white" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <Pagination page={page} total={total} limit={15} onChange={setPage} />
          </div>
        </div>
      )}
    </>
  );
}

function IpBansTab({ api, reloadKey }: { api: ReturnType<typeof adminApi>; reloadKey: number }) {
  const [bans, setBans] = useState<IpBan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const [addIp, setAddIp] = useState('');
  const [addReason, setAddReason] = useState('');
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/ip-bans', { params: { page, limit: 20 } })
      .then(r => { setBans(r.data.data); setTotal(r.data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [api, page, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    setActing(id);
    try { await api.delete(`/admin/ip-bans/${id}`); load(); } catch (e) { console.error(e); } finally { setActing(null); }
  }

  async function add() {
    if (!addIp.trim()) return;
    setAdding(true);
    try {
      await api.post('/admin/ip-bans', { ip: addIp.trim(), reason: addReason.trim() || undefined });
      setAddIp(''); setAddReason(''); setShowAdd(false); load();
    } catch (e) { console.error(e); } finally { setAdding(false); }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-white font-bold text-xl">IP Bans</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Blocked IP addresses</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-xl bg-white/8 border border-white/12 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/20 shadow-sm transition-colors"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-gray-100 text-gray-900 text-sm font-semibold transition-colors"
          >
            <Plus size={14} /> Add IP Ban
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-[#17171F] border border-white/8 shadow-sm rounded-2xl p-5 flex flex-col gap-3 mb-4">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wide">New IP Ban</p>
          <input
            type="text"
            value={addIp}
            onChange={e => setAddIp(e.target.value)}
            placeholder="IP address (e.g. 192.168.1.1)"
            className="bg-white/8 border border-white/12 text-white placeholder:text-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
          />
          <input
            type="text"
            value={addReason}
            onChange={e => setAddReason(e.target.value)}
            placeholder="Reason (optional)"
            className="bg-white/8 border border-white/12 text-white placeholder:text-zinc-500 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
          />
          <div className="flex gap-2">
            <button
              onClick={add}
              disabled={!addIp.trim() || adding}
              className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all"
            >
              {adding ? 'Adding...' : 'Confirm Ban'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="px-5 py-2.5 bg-white/8 hover:bg-white/15 border border-white/12 text-zinc-300 text-sm rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48 text-zinc-500 text-sm">Loading...</div>
      ) : bans.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-zinc-500 gap-2">
          <Shield size={28} className="opacity-30" />
          <p className="text-sm">No IP bans yet</p>
        </div>
      ) : (
        <div className="bg-[#17171F] rounded-2xl border border-white/8 shadow-sm overflow-hidden overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-white/5 border-b border-white/8 text-zinc-500 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3 font-semibold">IP Address</th>
                <th className="text-left px-4 py-3 font-semibold">Reason</th>
                <th className="text-left px-4 py-3 font-semibold">Added</th>
                <th className="text-left px-4 py-3 font-semibold">Expires</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {bans.map(b => (
                <tr key={b.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield size={14} className="text-red-400 shrink-0" />
                      <span className="font-mono text-white font-medium">{b.ip}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{b.reason ?? '—'}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{timeAgo(b.createdAt)}</td>
                  <td className="px-4 py-3 text-zinc-500 text-xs">{b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : 'Never'}</td>
                  <td className="px-4 py-3">
                    <button
                      disabled={acting === b.id}
                      onClick={() => remove(b.id)}
                      className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 pb-3">
            <Pagination page={page} total={total} limit={20} onChange={setPage} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Posts Tab ───────────────────────────────────────────────────────────────

interface AdminPost {
  id: string;
  content: string;
  createdAt: string;
  author: { id: string; anonAlias: string };
  _count: { likes: number; comments: number };
}

function PostsTab({ api, reloadKey }: { api: ReturnType<typeof adminApi>; reloadKey: number }) {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get('/admin/posts', { params: { page, limit: 20 } })
      .then(r => { setPosts(r.data.data); setTotal(r.data.total); })
      .catch(console.error);
  }, [api, page]);

  useEffect(() => { load(); }, [load, reloadKey]);

  async function deletePost(id: string) {
    setDeleting(id);
    try { await api.delete(`/admin/posts/${id}`); load(); }
    catch (e) { console.error(e); }
    finally { setDeleting(null); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-white font-bold text-xl">Posts <span className="text-zinc-500 text-sm font-normal ml-2">{total} total</span></h1>
        <button onClick={load} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/8 transition-colors"><RefreshCw size={16} /></button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-zinc-600">
          <FileText size={32} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">No posts yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(p => (
            <div key={p.id} className="bg-[#17171F] border border-white/8 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/8 border border-white/12 flex items-center justify-center text-sm font-bold text-white shrink-0">
                  {p.author.anonAlias.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{p.author.anonAlias}</span>
                    <span className="text-xs text-zinc-500">{timeAgo(p.createdAt)}</span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">{p.content}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs text-zinc-500"><Heart size={12} /> {p._count.likes}</span>
                    <span className="flex items-center gap-1 text-xs text-zinc-500"><MessageCircle size={12} /> {p._count.comments}</span>
                  </div>
                </div>
                <button
                  onClick={() => deletePost(p.id)}
                  disabled={deleting === p.id}
                  className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-50 shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <div className="pt-2">
            <Pagination page={page} total={total} limit={20} onChange={setPage} />
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────

export default function AdminPage() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem(KEY_STORAGE) ?? '');
  const [keyInput, setKeyInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const VALID_TABS: Tab[] = ['stats', 'reports', 'users', 'ip-bans', 'payments', 'calls', 'posts'];
  const [tab, setTab] = useState<Tab>(() => {
    const hash = window.location.hash.replace('#', '') as Tab;
    return VALID_TABS.includes(hash) ? hash : 'stats';
  });
  const [reloadKey, setReloadKey] = useState(0);

  // Right panel selections
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequest | null>(null);
  const [selectedCall, setSelectedCall] = useState<AdminCall | null>(null);

  // ─── Pending payment toast queue ───────────────────────────
  const [pendingQueue, setPendingQueue] = useState<PaymentRequest[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const isLoggedIn = !!apiKey;
  const client = isLoggedIn ? adminApi(apiKey) : null;

  // Fetch pending payments and merge into queue (skip already dismissed/resolved)
  const fetchPending = useCallback(async (c: ReturnType<typeof adminApi>) => {
    try {
      const res = await c.get('/admin/payments', { params: { status: 'pending', limit: 100 } });
      const data: PaymentRequest[] = res.data.data ?? [];
      setPendingQueue(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newItems = data.filter(p => !existingIds.has(p.id));
        return [...prev.filter(p => data.some(d => d.id === p.id)), ...newItems];
      });
    } catch { /* ignore */ }
  }, []);

  // On login: fetch immediately, then poll every 30s
  useEffect(() => {
    if (!isLoggedIn || !client) return;
    fetchPending(client);
    const interval = setInterval(() => fetchPending(client), 30_000);
    return () => clearInterval(interval);
  }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Current toast = first non-dismissed pending request
  const activeToastPayment = pendingQueue.find(p => !dismissedIds.has(p.id)) ?? null;

  function dismissToast(id: string) {
    setDismissedIds(prev => new Set([...prev, id]));
  }

  function removePendingById(id: string) {
    setPendingQueue(prev => prev.filter(p => p.id !== id));
    setDismissedIds(prev => { const s = new Set(prev); s.delete(id); return s; });
  }

  const pendingCount = pendingQueue.filter(p => !dismissedIds.has(p.id)).length;

  function closePanel() {
    setSelectedReport(null);
    setSelectedUser(null);
    setSelectedPayment(null);
    setSelectedCall(null);
  }

  function handleTabChange(newTab: Tab) {
    setTab(newTab);
    window.location.hash = newTab;
    closePanel();
  }

  function onPanelUpdate() {
    setReloadKey(k => k + 1);
    closePanel();
  }

  // Called after payment approve/reject — removes from toast queue
  function onPaymentPanelUpdate(paymentId: string) {
    removePendingById(paymentId);
    setReloadKey(k => k + 1);
    closePanel();
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setVerifying(true);
    setLoginError('');
    try {
      await adminApi(keyInput.trim()).get('/admin/stats');
      sessionStorage.setItem(KEY_STORAGE, keyInput.trim());
      setApiKey(keyInput.trim());
      setKeyInput('');
    } catch {
      setLoginError('Invalid password. Try again.');
    } finally {
      setVerifying(false);
    }
  }

  function logout() {
    sessionStorage.removeItem(KEY_STORAGE);
    setApiKey('');
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#0D0D14] flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="AppleTalk" className="w-16 h-16 mx-auto mb-3" />
            <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
            <p className="text-zinc-400 text-sm mt-1">Enter your password to continue</p>
          </div>
          <form onSubmit={handleLogin} className="bg-[#17171F] border border-white/8 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-1.5 uppercase tracking-wide">Password</label>
              <input
                type="password"
                value={keyInput}
                onChange={e => setKeyInput(e.target.value)}
                placeholder="Enter password..."
                autoFocus
                className="w-full bg-white/8 border border-white/12 text-white placeholder:text-zinc-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500"
              />
            </div>
            {loginError && <p className="text-red-600 text-xs">{loginError}</p>}
            <button
              type="submit"
              disabled={verifying || !keyInput.trim()}
              className="w-full bg-white hover:bg-gray-100 disabled:opacity-40 text-gray-900 font-semibold py-3 rounded-xl text-sm transition-all"
            >
              {verifying ? 'Verifying...' : 'Enter Admin Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'stats',    label: 'Stats',    icon: <BarChart3 size={20} /> },
    { id: 'calls',    label: 'Calls',    icon: <Phone size={20} /> },
    { id: 'reports',  label: 'Reports',  icon: <Flag size={20} /> },
    { id: 'users',    label: 'Users',    icon: <Users size={20} /> },
    { id: 'posts',    label: 'Posts',    icon: <FileText size={20} /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard size={20} /> },
    { id: 'ip-bans',  label: 'IP Bans',  icon: <Shield size={20} /> },
  ];

  return (
    <div className="h-screen bg-[#0D0D14] flex overflow-hidden">
      {/* Left Sidebar — desktop only */}
      <aside className="hidden md:flex w-16 bg-[#17171F] border-r border-white/8 shadow-sm flex-col items-center py-4 shrink-0 fixed top-0 left-0 h-full z-20">
        {/* Logo */}
        <div className="mb-6">
          <img src="/logo.png" alt="AppleTalk" className="w-8 h-8" />
        </div>

        {/* Nav Icons */}
        <nav className="flex-1 flex flex-col items-center gap-1 w-full px-2">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              title={t.label}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                tab === t.id
                  ? 'bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30'
                  : 'text-zinc-500 hover:bg-white/8 hover:text-zinc-300'
              }`}
            >
              {t.icon}
            </button>
          ))}
        </nav>

        {/* Bottom icons */}
        <div className="flex flex-col items-center gap-1 px-2">
          <button
            title="Notifications"
            onClick={() => handleTabChange('payments')}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-white/8 hover:text-white transition-all relative"
          >
            <Bell size={20} />
            {pendingCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-500 text-[9px] font-bold text-black flex items-center justify-center leading-none">
                {pendingCount > 9 ? '9+' : pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={logout}
            title="Logout"
            className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:bg-red-500/15 hover:text-red-400 transition-all"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 bg-[#17171F] border-b border-white/8 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="AppleTalk" className="w-7 h-7" />
          <span className="text-white font-bold text-sm">{TABS.find(t => t.id === tab)?.label ?? 'Admin'}</span>
        </div>
        <button onClick={logout} className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors">
          <LogOut size={18} />
        </button>
      </div>

      {/* Main content area */}
      <div className="flex-1 md:ml-16 flex h-full min-h-0">
        <main className="flex-1 overflow-y-auto p-3 md:p-6 pt-16 md:pt-6 pb-20 md:pb-6">
          {tab === 'stats' && <StatsTab api={client!} reloadKey={reloadKey} />}
          {tab === 'calls' && (
            <CallsTab api={client!} reloadKey={reloadKey} selectedCall={selectedCall}
              onSelectCall={c => { closePanel(); if (c) setSelectedCall(c); }} />
          )}
          {tab === 'reports' && (
            <ReportsTab api={client!} reloadKey={reloadKey} selectedReport={selectedReport}
              onSelectReport={r => { closePanel(); if (r) setSelectedReport(r); }} />
          )}
          {tab === 'users' && (
            <UsersTab api={client!} reloadKey={reloadKey} selectedUser={selectedUser}
              onSelectUser={u => { closePanel(); if (u) setSelectedUser(u); }} />
          )}
          {tab === 'payments' && (
            <PaymentsTab api={client!} reloadKey={reloadKey} selectedPayment={selectedPayment}
              onSelectPayment={p => { closePanel(); if (p) setSelectedPayment(p); }} />
          )}
          {tab === 'ip-bans' && <IpBansTab api={client!} reloadKey={reloadKey} />}
          {tab === 'posts' && <PostsTab api={client!} reloadKey={reloadKey} />}
        </main>
      </div>

      {/* User Detail Modal — landscape */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" onClick={closePanel}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative bg-[#17171F] rounded-2xl shadow-2xl border border-white/10 w-full max-w-3xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <UserPanel user={selectedUser} api={client!} onClose={closePanel} onUpdate={onPanelUpdate} />
          </div>
        </div>
      )}

      {/* Report Detail Modal — landscape */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" onClick={closePanel}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative bg-[#17171F] rounded-2xl shadow-2xl border border-white/10 w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <ReportPanel report={selectedReport} api={client!} onClose={closePanel} onUpdate={onPanelUpdate} />
          </div>
        </div>
      )}

      {/* Call Detail Modal — landscape */}
      {selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" onClick={closePanel}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative bg-[#17171F] rounded-2xl shadow-2xl border border-white/10 w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <CallPanel call={selectedCall} onClose={closePanel} />
          </div>
        </div>
      )}

      {/* Payment Detail Modal — landscape */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8" onClick={closePanel}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
          <div className="relative bg-[#17171F] rounded-2xl shadow-2xl border border-white/10 w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <PaymentPanel payment={selectedPayment} api={client!} onClose={closePanel} onUpdate={() => onPaymentPanelUpdate(selectedPayment.id)} />
          </div>
        </div>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-20 bg-[#17171F] border-t border-white/8 flex items-center justify-around px-1 py-1.5">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-xl transition-all ${
              tab === t.id ? 'text-white' : 'text-zinc-500'
            }`}
          >
            <span>{t.icon}</span>
            <span className="text-[9px] font-medium leading-none">{t.label}</span>
          </button>
        ))}
      </nav>

      {/* ── Pending Payment Toast ── */}
      {activeToastPayment && (
        <div
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[60] w-80 max-w-[calc(100vw-2rem)]"
          style={{ animation: 'slideInToast 0.3s ease' }}
        >
          <style>{`
            @keyframes slideInToast {
              from { transform: translateY(20px); opacity: 0; }
              to   { transform: translateY(0);    opacity: 1; }
            }
          `}</style>
          <div className="bg-[#1e1e2e] border border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 bg-amber-500/10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">New Payment Request</span>
              </div>
              <div className="flex items-center gap-2">
                {pendingQueue.filter(p => !dismissedIds.has(p.id)).length > 1 && (
                  <span className="text-[10px] text-zinc-500 font-medium">
                    +{pendingQueue.filter(p => !dismissedIds.has(p.id)).length - 1} more
                  </span>
                )}
                <button
                  onClick={() => dismissToast(activeToastPayment.id)}
                  className="text-zinc-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <InitialAvatar name={activeToastPayment.user.anonAlias} size="md" />
                <div>
                  <p className="text-sm font-bold text-white">{activeToastPayment.user.anonAlias}</p>
                  <p className="text-xs text-zinc-500">{timeAgo(activeToastPayment.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 font-semibold border border-purple-500/25">
                  {activeToastPayment.plan}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/8 text-zinc-300 font-semibold">
                  {activeToastPayment.method === 'bkash' ? 'bKash' : 'Nagad'}
                </span>
                <span className="ml-auto font-bold text-amber-400">{activeToastPayment.amount} ৳</span>
              </div>
              <p className="text-[11px] text-zinc-600 font-mono truncate">TXN: {activeToastPayment.transactionId}</p>
            </div>

            {/* Actions */}
            <div className="px-4 pb-3 flex gap-2">
              <button
                onClick={() => {
                  setSelectedPayment(activeToastPayment);
                  handleTabChange('payments');
                }}
                className="flex-1 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 text-xs font-bold transition-all border border-amber-500/25"
              >
                Review
              </button>
              <button
                onClick={() => dismissToast(activeToastPayment.id)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-semibold transition-all"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
