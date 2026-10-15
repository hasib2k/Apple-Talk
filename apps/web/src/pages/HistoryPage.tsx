import { useState, useRef, useEffect } from 'react';
import { History, Phone, UserPlus, Flag, X, Crown } from 'lucide-react';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { useAuthStore } from '../store/auth.store';
import { RowSkeleton } from '../components/Shimmer';
import { useFriendStore } from '../store/friend.store';
import { useSocket, useSocketEvent } from '../hooks/useSocket';
import { api } from '../lib/api';
import { formatDuration, cn } from '../lib/utils';

interface CallHistoryEntry {
  id: string;
  partnerId: string;
  partnerAlias: string;
  partnerRegion: string | null;
  partnerGender: string | null;
  partnerIsPremium: boolean;
  partnerIsLinked: boolean;
  startedAt: string;
  durationSecs: number;
}

const REPORT_REASONS = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'hate_speech', label: 'Hate speech' },
  { value: 'other', label: 'Other' },
];

function Avatar({ size = 'sm', premium = false }: { name: string; size?: 'sm' | 'md'; premium?: boolean }) {
  const sizeClass = size === 'sm' ? 'w-9 h-9' : 'w-11 h-11';
  const imgSize = size === 'sm' ? 22 : 26;
  return (
    <div className={`${sizeClass} rounded-full bg-leaf-500 flex items-center justify-center overflow-hidden select-none`}
      style={premium ? { boxShadow: '0 0 0 2px #f59e0b' } : undefined}>
      <img src="/logo.png" alt="user" style={{ width: imgSize, height: imgSize, objectFit: 'contain' }} />
    </div>
  );
}

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function HistoryPage() {
  const { user } = useAuthStore();
  const isPremium = user?.isPremium ?? false;
  const { hasFriend, hasRequest, sendRequest, setOutgoingFriendCall, loadFriends } = useFriendStore();
  const socket = useSocket();

  const [callHistory, setCallHistory] = useState<CallHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyOnlineIds, setHistoryOnlineIds] = useState<Set<string>>(new Set());
  const [offlineToast, setOfflineToast] = useState<string | null>(null);
  const [alreadyFriendToast, setAlreadyFriendToast] = useState<string | null>(null);

  const [allowIncomingCalls, setAllowIncomingCalls] = useState<boolean>(() => {
    try { return localStorage.getItem('mangotalk_allow_incoming') !== 'false'; } catch { return true; }
  });

  function toggleAllowIncomingCalls() {
    const next = !allowIncomingCalls;
    setAllowIncomingCalls(next);
    localStorage.setItem('mangotalk_allow_incoming', String(next));
  }

  const [reportTarget, setReportTarget] = useState<{ id: string; alias: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDoneToast, setReportDoneToast] = useState(false);

  const callHistoryRef = useRef<CallHistoryEntry[]>([]);
  const historyCheckPendingRef = useRef(false);

  function emitHistoryStatusCheck(entries: CallHistoryEntry[]) {
    if (entries.length === 0) return;
    historyCheckPendingRef.current = true;
    socket.emit('users:status-check', { userIds: entries.map(e => e.partnerId) });
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const { data } = await api.get('/calls/history');
      const entries = data as CallHistoryEntry[];
      setCallHistory(entries);
      callHistoryRef.current = entries;
      emitHistoryStatusCheck(entries);
    } catch (err) {
      console.error('Failed to load history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
    loadFriends();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onConnect() {
      emitHistoryStatusCheck(callHistoryRef.current);
    }
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => {
      emitHistoryStatusCheck(callHistoryRef.current);
    }, 30_000);
    return () => clearInterval(interval);
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  useSocketEvent('users:online-status', ({ onlineIds }) => {
    const historyPartnerIds = new Set(callHistoryRef.current.map(e => e.partnerId));
    if (historyCheckPendingRef.current) {
      historyCheckPendingRef.current = false;
      setHistoryOnlineIds(new Set(onlineIds.filter(id => historyPartnerIds.has(id))));
    } else {
      const onlineHistoryIds = onlineIds.filter(id => historyPartnerIds.has(id));
      if (onlineHistoryIds.length > 0) {
        setHistoryOnlineIds(prev => new Set([...prev, ...onlineHistoryIds]));
      }
    }
  });

  useSocketEvent('friend:online', ({ userId }) => {
    setHistoryOnlineIds(prev => new Set([...prev, userId]));
  });

  useSocketEvent('friend:offline', ({ userId }) => {
    setHistoryOnlineIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
  });

  function callHistoryUser(partnerId: string, partnerAlias: string) {
    if (!historyOnlineIds.has(partnerId)) {
      setOfflineToast(partnerAlias);
      setTimeout(() => setOfflineToast(null), 3000);
      return;
    }
    setOutgoingFriendCall({ toId: partnerId, toAlias: partnerAlias });
    socket.emit('friend:call', { targetUserId: partnerId });
  }

  async function submitReport() {
    if (!reportTarget || !reportReason) return;
    setReportSubmitting(true);
    try {
      await api.post('/reports', {
        reportedUserId: reportTarget.id,
        reason: reportReason,
        description: reportDescription || undefined,
      });
      setReportTarget(null);
      setReportReason('');
      setReportDescription('');
      setReportDoneToast(true);
      setTimeout(() => setReportDoneToast(false), 3000);
    } catch (err) {
      console.error('Failed to submit report:', err);
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Allow incoming calls toggle */}
      <div className="shrink-0 border-b border-leaf-700 bg-leaf-900">
        <div className="w-full max-w-2xl mx-auto px-4 py-3">
        <button
          onClick={toggleAllowIncomingCalls}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-leaf-800 border border-leaf-700 hover:border-leaf-600 transition-colors"
        >
          <span className="text-sm text-leaf-50 font-medium">Allow Incoming Call Requests</span>
          <div
            className="shrink-0 transition-colors duration-200"
            style={{
              width: '40px', height: '22px', borderRadius: '11px',
              background: allowIncomingCalls ? '#22c55e' : '#113d27',
              position: 'relative',
            }}
          >
            <div
              className="absolute bg-white"
              style={{
                width: '18px', height: '18px', borderRadius: '9px',
                top: '2px', left: allowIncomingCalls ? '20px' : '2px',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }}
            />
          </div>
        </button>
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto mob-nav-pb">
        <div className="w-full max-w-2xl mx-auto px-4 py-3">
        {historyLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[1, 2, 3, 4, 5, 6].map(i => <RowSkeleton key={i} />)}
          </div>
        ) : callHistory.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-leaf-300 gap-2 py-20">
            <History size={40} className="opacity-30" />
            <p className="text-sm text-leaf-300">No call history yet</p>
            <p className="text-xs text-leaf-300/70">Completed calls will appear here</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {callHistory.map(entry => {
              const isOnline = historyOnlineIds.has(entry.partnerId);
              const entryIsFriend = hasFriend(entry.partnerId);
              const entryDisplayName = entryIsFriend ? entry.partnerAlias : 'Stranger';
              const requestSent = hasRequest(entry.partnerId);

              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-leaf-800 transition-colors"
                >
                  <div
                    className="relative shrink-0"
                    onClick={entryIsFriend ? () => useFriendStore.getState().setViewProfileId(entry.partnerId) : undefined}
                    style={entryIsFriend ? { cursor: 'pointer' } : undefined}
                  >
                    <Avatar name={entryDisplayName} size="sm" premium={entry.partnerIsPremium} />
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-leaf-900 ${
                        isOnline ? (entry.partnerIsPremium ? 'bg-yellow-400' : 'bg-green-400') : 'bg-gray-500'
                      }`}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                    <p
                      className={`text-sm font-semibold truncate ${
                        entry.partnerIsPremium ? 'text-amber-400' : user?.isPremium && entry.partnerGender === 'female' ? 'text-pink-400' : 'text-leaf-50'
                      }`}
                    >
                      {entryDisplayName}
                    </p>
                    {entry.partnerIsPremium && <Crown size={12} color="#f59e0b" className="shrink-0" />}
                    {entry.partnerIsLinked && <VerifiedBadge size={12} />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-leaf-300 font-mono">{formatDuration(entry.durationSecs)}</span>
                      <span className="text-xs text-leaf-300/70">{timeAgo(entry.startedAt)}</span>
                    </div>
                  </div>

                  {/* Add friend button */}
                  <button
                    disabled={requestSent}
                    onClick={() => {
                      if (entryIsFriend) {
                        setAlreadyFriendToast(entry.partnerAlias);
                        setTimeout(() => setAlreadyFriendToast(null), 3000);
                        return;
                      }
                      if (requestSent) return;
                      sendRequest({ id: entry.partnerId, alias: entry.partnerAlias });
                      socket.emit('friend:request', { targetUserId: entry.partnerId });
                    }}
                    className={cn(
                      'shrink-0 p-1.5 rounded-full transition-all active:scale-95',
                      entryIsFriend
                        ? 'bg-leaf-800 text-green-400 hover:bg-leaf-700'
                        : requestSent
                        ? 'bg-leaf-800 text-leaf-300 cursor-default'
                        : 'bg-leaf-800 hover:bg-leaf-700 text-leaf-50',
                    )}
                    title={
                      entryIsFriend
                        ? 'Already friends'
                        : requestSent
                        ? 'Request sent'
                        : `Add ${entry.partnerAlias}`
                    }
                  >
                    <UserPlus size={15} />
                  </button>

                  {/* Call button */}
                  <button
                    onClick={() => callHistoryUser(entry.partnerId, entryDisplayName)}
                    className={cn(
                      'shrink-0 p-1.5 rounded-full transition-all active:scale-95',
                      isOnline
                        ? isPremium ? 'bg-skin-500 hover:bg-skin-600 text-white' : 'bg-mango-500 hover:bg-mango-600 text-leaf-800'
                        : 'bg-leaf-800 text-leaf-300 cursor-not-allowed',
                    )}
                    title={isOnline ? `Call ${entryDisplayName}` : 'Offline'}
                  >
                    <Phone size={15} />
                  </button>

                  {/* Report button */}
                  <button
                    onClick={() => {
                      setReportTarget({ id: entry.partnerId, alias: entry.partnerAlias });
                      setReportReason('');
                      setReportDescription('');
                    }}
                    className="shrink-0 p-1.5 rounded-full bg-leaf-800 hover:bg-red-900/40 text-red-400 hover:text-red-300 transition-all active:scale-95"
                    title="Report user"
                  >
                    <Flag size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        </div>
      </div>

      {/* Toasts */}
      {alreadyFriendToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-700 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <span className="text-sm text-leaf-50">
            You and <span className="text-mango-500">{alreadyFriendToast}</span> are already friends
          </span>
        </div>
      )}

      {offlineToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-700 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-gray-500 shrink-0" />
          <span className="text-sm text-leaf-50">User is offline — can't call right now</span>
        </div>
      )}

      {reportDoneToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-leaf-800 border border-leaf-700 rounded-2xl px-4 py-3 shadow-xl animate-slide-up">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <span className="text-sm text-leaf-50">Report submitted. We'll review it.</span>
        </div>
      )}

      {/* Report Modal */}
      {reportTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setReportTarget(null)} />
          <div className="relative w-full sm:max-w-sm bg-leaf-800 rounded-t-2xl sm:rounded-2xl border border-leaf-700 p-5 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flag size={16} className="text-red-400" />
                <span className="font-semibold text-leaf-50 text-sm">Report user</span>
              </div>
              <button onClick={() => setReportTarget(null)} className="text-leaf-300 hover:text-leaf-50 transition-colors">
                <X size={18} />
              </button>
            </div>
            <p className="text-leaf-300 text-xs">
              Reporting <span className="text-leaf-50 font-medium">{reportTarget.alias}</span>. Reports are anonymous and reviewed by our team.
            </p>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide">Reason</p>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map(r => (
                  <button
                    key={r.value}
                    onClick={() => setReportReason(r.value)}
                    className={cn(
                      'px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
                      reportReason === r.value
                        ? 'border-red-500 bg-red-500/20 text-red-400'
                        : 'border-leaf-700 text-leaf-300 hover:border-leaf-600',
                    )}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-leaf-300 uppercase tracking-wide mb-1.5">
                Details <span className="text-leaf-300/50 font-normal normal-case">(optional)</span>
              </p>
              <textarea
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Describe what happened..."
                className="w-full bg-leaf-700 text-leaf-50 placeholder:text-leaf-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 resize-none"
              />
            </div>
            <button
              onClick={submitReport}
              disabled={!reportReason || reportSubmitting}
              className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              {reportSubmitting ? 'Submitting...' : <><Flag size={14} /> Submit Report</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
