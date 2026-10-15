import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Share2, Send, Trash2, Crown, ChevronDown, ChevronUp, UserPlus, UserCheck, Rss, Users, Sparkles } from 'lucide-react';
import { VerifiedBadge } from '../components/VerifiedBadge';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useFriendStore } from '../store/friend.store';
import { useSocket } from '../hooks/useSocket';
import { PostSkeleton, CommentSkeleton } from '../components/Shimmer';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { useOnlineCount } from '../hooks/useOnlineCount';

interface PostAuthor {
  id: string;
  anonAlias: string;
  isPremium: boolean;
  isLinked: boolean;
  gender: string | null;
  region: string | null;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
}

interface Post {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function InitialAvatar({ size = 40, premium = false }: { name?: string; size?: number; premium?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: premium
        ? 'linear-gradient(150deg,#78350f,#1c0d00)'
        : 'linear-gradient(150deg,#1f5c3d,#0c2e1d)',
      border: premium
        ? '1.5px solid rgba(245,158,11,0.35)'
        : '1.5px solid rgba(163,230,53,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      <img src="/logo.png" alt="avatar" style={{ width: size * 0.58, height: size * 0.58, objectFit: 'contain' }} />
    </div>
  );
}

function PostCard({ post, currentUserId, currentUserIsPremium, onDelete, onLikeToggle }: {
  post: Post;
  currentUserId: string;
  currentUserIsPremium: boolean;
  onDelete: (id: string) => void;
  onLikeToggle: (id: string, liked: boolean, count: number) => void;
}) {
  const { hasFriend, hasRequest, sendRequest, cancelRequest } = useFriendStore();
  const socket = useSocket();
  const [liked, setLiked] = useState(post.likedByMe);
  const [likeCount, setLikeCount] = useState(post.likeCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [commentCount, setCommentCount] = useState(post.commentCount);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const COLLAPSE_LINES = 4;
  const isLong = post.content.split('\n').length > COLLAPSE_LINES || post.content.length > 280;

  const isMine = post.author.id === currentUserId;
  const isFriend = hasFriend(post.author.id);
  const requestSent = hasRequest(post.author.id);
  const isPremiumAuthor = post.author.isPremium;
  const accent = isPremiumAuthor ? '#f59e0b' : '#a3e635';

  // Name & gender visible if: own post, friend, or current user is premium
  const canSeeDetails = isMine || isFriend || currentUserIsPremium;
  const displayName = canSeeDetails ? post.author.anonAlias : 'Stranger';
  const showGender = canSeeDetails && !!post.author.gender;

  async function toggleLike() {
    if (likeLoading) return;
    setLikeLoading(true);
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c + 1 : c - 1);
    try {
      const res = await api.post<{ liked: boolean; likeCount: number }>(`/posts/${post.id}/like`);
      setLiked(res.data.liked);
      setLikeCount(res.data.likeCount);
      onLikeToggle(post.id, res.data.liked, res.data.likeCount);
    } catch { setLiked(!newLiked); setLikeCount(c => newLiked ? c - 1 : c + 1); }
    finally { setLikeLoading(false); }
  }

  async function loadComments() {
    if (commentsLoaded) { setCommentOpen(v => !v); return; }
    setCommentOpen(true);
    try {
      const res = await api.get<Comment[]>(`/posts/${post.id}/comments`);
      setComments(res.data);
      setCommentsLoaded(true);
    } catch { setCommentsLoaded(true); /* show empty state on error */ }
  }

  async function submitComment() {
    const text = commentText.trim();
    if (!text || commentLoading) return;
    setCommentLoading(true);
    try {
      const res = await api.post<Comment>(`/posts/${post.id}/comments`, { content: text });
      setComments(prev => [...prev, res.data]);
      setCommentCount(c => c + 1);
      setCommentText('');
    } catch { /* ignore */ }
    finally { setCommentLoading(false); }
  }

  async function sharePost() {
    const url = `${window.location.origin}/post/${post.id}`;
    const shareData = {
      title: 'AppleTalk Post',
      text: `"${post.content}" — ${post.author.anonAlias} on AppleTalk`,
      url,
    };
    if (navigator.share && navigator.canShare?.(shareData)) {
      try { await navigator.share(shareData); return; } catch { /* user cancelled or error */ }
    }
    // Fallback: copy link to clipboard
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  function handleAddFriend() {
    if (isMine || isFriend || requestSent) return;
    sendRequest({ id: post.author.id, alias: post.author.anonAlias });
    socket.emit('friend:request', { targetUserId: post.author.id });
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 18,
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Premium top bar */}
      {isPremiumAuthor && (
        <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)' }} />
      )}

      <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
        {/* Author row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <InitialAvatar name={post.author.anonAlias} size={40} premium={isPremiumAuthor} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: !canSeeDetails ? '#6f9c81' : isPremiumAuthor ? '#fbbf24' : '#d4f5e2', fontFamily: "'Kanit', sans-serif" }}>
                {displayName}
              </span>
              {isPremiumAuthor && canSeeDetails && <Crown size={12} color="#f59e0b" />}
              {post.author.isLinked && <VerifiedBadge size={12} />}
              {showGender && (
                <span style={{ fontSize: 11, color: post.author.gender === 'male' ? '#60a5fa' : '#f472b6' }}>
                  {post.author.gender === 'male' ? '♂' : '♀'}
                </span>
              )}
            </div>
            <p style={{ fontSize: 11, color: '#3d6b52', margin: 0 }}>{timeAgo(post.createdAt)}</p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Add friend / Friend badge */}
            {!isMine && (
              isFriend ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 99, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.20)', fontSize: 11.5, fontWeight: 600, color: '#4ade80' }}>
                  <UserCheck size={12} /> Friend
                </div>
              ) : requestSent ? (
                <button onClick={() => cancelRequest(post.author.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 99, background: 'rgba(255,255,255,0.05)', border: 'none', fontSize: 11.5, fontWeight: 600, color: '#8fcea8', cursor: 'pointer', fontFamily: 'inherit' }}>
                  <UserPlus size={12} /> Sent
                </button>
              ) : (
                <button onClick={handleAddFriend} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 99, background: `rgba(${isPremiumAuthor ? '245,158,11' : '163,230,53'},0.08)`, border: `1px solid rgba(${isPremiumAuthor ? '245,158,11' : '163,230,53'},0.25)`, fontSize: 11.5, fontWeight: 700, color: accent, cursor: 'pointer', fontFamily: 'inherit' }}>
                  <UserPlus size={12} /> Add
                </button>
              )
            )}

            {/* Delete (own post) */}
            {isMine && (
              showDeleteConfirm ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 11, fontWeight: 600, color: '#8fcea8', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Cancel
                  </button>
                  <button onClick={() => { setShowDeleteConfirm(false); onDelete(post.id); }} style={{ padding: '4px 10px', borderRadius: 99, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.30)', fontSize: 11, fontWeight: 600, color: '#f87171', cursor: 'pointer', fontFamily: 'inherit' }}>
                    Delete
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowDeleteConfirm(true)} style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  <Trash2 size={12} color="#f87171" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Content */}
        <div
          onClick={() => isLong && setExpanded(v => !v)}
          style={{ cursor: isLong ? 'pointer' : 'default' }}
        >
          <p style={{ fontSize: 14.5, color: '#e8f5e2', lineHeight: 1.68, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', userSelect: 'text', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: expanded ? undefined : COLLAPSE_LINES, overflow: expanded ? 'visible' : 'hidden' }}>
            {post.content}
          </p>
          {isLong && (
            <div style={{ textAlign: 'center', paddingTop: 6 }}>
              <button
                onClick={e => { e.stopPropagation(); setExpanded(v => !v); }}
                style={{ background: 'none', border: 'none', padding: '2px 12px', fontSize: 12.5, fontWeight: 700, color: '#a3e635', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                {expanded ? 'See less' : 'See more'}
              </button>
            </div>
          )}
        </div>

        {/* Stats row */}
        {(likeCount > 0 || commentCount > 0) && (
          <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: '#3d6b52', paddingBottom: 2 }}>
            {likeCount > 0 && <span>{likeCount} {likeCount === 1 ? 'like' : 'likes'}</span>}
            {commentCount > 0 && <span>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</span>}
          </div>
        )}

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={toggleLike}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 6px', borderRadius: 10, background: 'transparent', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'inherit' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <Heart size={15} fill={liked ? '#ef4444' : 'none'} color={liked ? '#ef4444' : '#6f9c81'} strokeWidth={2} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: liked ? '#f87171' : '#6f9c81' }}>Like</span>
          </button>

          <button
            onClick={loadComments}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 6px', borderRadius: 10, background: 'transparent', border: '1px solid transparent', cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.18s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <MessageCircle size={15} color="#6f9c81" strokeWidth={2} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#6f9c81' }}>Comment</span>
            {commentOpen ? <ChevronUp size={11} color="#4d7a60" /> : <ChevronDown size={11} color="#4d7a60" />}
          </button>

          <button
            onClick={sharePost}
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 6px', borderRadius: 10, background: copied ? 'rgba(163,230,53,0.08)' : 'transparent', border: '1px solid transparent', cursor: 'pointer', transition: 'all 0.18s', fontFamily: 'inherit' }}
            onMouseEnter={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { if (!copied) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <Share2 size={15} color={copied ? '#a3e635' : '#6f9c81'} strokeWidth={2} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: copied ? '#a3e635' : '#6f9c81' }}>{copied ? 'Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* Comments section */}
        {commentOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
            {!commentsLoaded ? (
              <>
                <CommentSkeleton />
                <CommentSkeleton />
                <CommentSkeleton />
              </>
            ) : comments.length === 0 ? (
              <p style={{ fontSize: 12.5, color: '#3d6b52', textAlign: 'center', padding: '8px 0', margin: 0 }}>No comments yet. Be the first!</p>
            ) : (
              comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                  <InitialAvatar name={c.author.anonAlias} size={28} premium={c.author.isPremium} />
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '8px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.author.isPremium ? '#fbbf24' : '#a3e635' }}>{c.author.anonAlias}</span>
                      {c.author.isPremium && <Crown size={10} color="#f59e0b" />}
                      <span style={{ fontSize: 10, color: '#3d6b52', marginLeft: 'auto' }}>{timeAgo(c.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#c5dfc8', margin: 0, lineHeight: 1.5, userSelect: 'text' }}>{c.content}</p>
                  </div>
                </div>
              ))
            )}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <InitialAvatar name={currentUserId} size={28} />
              <div style={{ flex: 1, display: 'flex', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 99, padding: '5px 5px 5px 13px', alignItems: 'center' }}>
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitComment()}
                  placeholder="Write a comment..."
                  style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: '#e8f5e2', fontFamily: 'inherit' }}
                />
                <button
                  onClick={submitComment}
                  disabled={!commentText.trim() || commentLoading}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: commentText.trim() ? 'linear-gradient(150deg,#bef264,#84cc16)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: commentText.trim() ? 'pointer' : 'default', flexShrink: 0 }}
                >
                  <Send size={12} color={commentText.trim() ? '#1a2e05' : '#4d7a60'} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

function LeftSidebar({ user, postCount }: { user: any; postCount: number }) {
  const isPremium = user?.isPremium ?? false;
  const { friends } = useFriendStore();
  const onlineCount = friends.filter((f: any) => f.isOnline).length;
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Profile card */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 18, overflow: 'hidden' }}>
        {/* Cover gradient */}
        <div style={{ height: 56, background: isPremium ? 'linear-gradient(135deg,#78350f,#1c0d00,#3b1106)' : 'linear-gradient(135deg,#0a2e1a,#052210,#062b1a)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 50%,rgba(163,230,53,0.08),transparent 70%)' }} />
        </div>

        <div style={{ padding: '0 16px 16px', position: 'relative' }}>
          {/* Avatar overlapping cover */}
          <div style={{ marginTop: -24, marginBottom: 10 }}>
            <InitialAvatar name={user?.anonAlias ?? 'A'} size={48} premium={isPremium} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: isPremium ? '#fbbf24' : '#d4f5e2', fontFamily: "'Kanit', sans-serif" }}>
              {user?.anonAlias ?? 'Anonymous'}
            </span>
            {isPremium && <Crown size={13} color="#f59e0b" />}
            {user?.gender && (
              <span style={{ fontSize: 10, fontWeight: 600, color: user.gender === 'male' ? '#60a5fa' : '#f472b6', background: user.gender === 'male' ? 'rgba(96,165,250,0.1)' : 'rgba(244,114,182,0.1)', border: `1px solid ${user.gender === 'male' ? 'rgba(96,165,250,0.2)' : 'rgba(244,114,182,0.2)'}`, borderRadius: 99, padding: '1px 7px' }}>
                {user.gender === 'male' ? 'Male' : 'Female'}
              </span>
            )}
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 4 }}>
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#a3e635', margin: 0, fontFamily: "'Oxanium', sans-serif" }}>{postCount}</p>
              <p style={{ fontSize: 10, color: '#3d6b52', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Posts</p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#a3e635', margin: 0, fontFamily: "'Oxanium', sans-serif" }}>{friends.length}</p>
              <p style={{ fontSize: 10, color: '#3d6b52', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Friends</p>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#4ade80', margin: 0, fontFamily: "'Oxanium', sans-serif" }}>{onlineCount}</p>
              <p style={{ fontSize: 10, color: '#3d6b52', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Online</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick links */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { icon: <Rss size={14} />, label: 'Feed', active: true, onClick: undefined },
          { icon: <Users size={14} />, label: 'Friends', active: false, onClick: () => navigate('/friends') },
        ].map(({ icon, label, active, onClick }) => (
          <div key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 10, background: active ? 'rgba(163,230,53,0.08)' : 'transparent', cursor: 'pointer', transition: 'background 0.15s' }}>
            <span style={{ color: active ? '#a3e635' : '#4d7a60' }}>{icon}</span>
            <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#a3e635' : '#6f9c81' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Right Sidebar ─────────────────────────────────────────────────────────────

function RightSidebar() {
  const { friends } = useFriendStore();
  const onlineFriends = friends.filter((f: any) => f.isOnline).slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Online Friends */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 6px #4ade80', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8fcea8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Friends Online</span>
        </div>
        {onlineFriends.length === 0 ? (
          <p style={{ fontSize: 12, color: '#3d6b52', margin: 0, textAlign: 'center', padding: '8px 0' }}>No friends online</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {onlineFriends.map((f: any) => (
              <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <InitialAvatar name={f.alias} size={32} />
                  <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, borderRadius: '50%', background: '#4ade80', border: '1.5px solid #05140d' }} />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#d4f5e2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.alias}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* App info card */}
      <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <Sparkles size={14} color="#a3e635" />
          <span style={{ fontSize: 12, fontWeight: 700, color: '#8fcea8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>AppleTalk Feed</span>
        </div>
        <p style={{ fontSize: 12, color: '#3d6b52', margin: '0 0 8px', lineHeight: 1.55 }}>
          Share thoughts anonymously. Connect with strangers worldwide.
        </p>
        <div style={{ fontSize: 11, color: '#2d5040', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>• Posts are anonymous by alias</span>
          <span>• Add friends from their posts</span>
          <span>• Likes & comments are real-time</span>
        </div>
      </div>
    </div>
  );
}

// ─── Create Post Box ───────────────────────────────────────────────────────────

function CreatePostBox({ user, onPost }: { user: any; onPost: (post: Post) => void }) {
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isPremium = user?.isPremium ?? false;
  const accentGradient = isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)';
  const charLeft = 1000 - postText.length;

  async function submitPost() {
    const text = postText.trim();
    if (!text || posting || postText.length > 1000) return;
    setPosting(true);
    try {
      const res = await api.post<Post>('/posts', { content: text });
      const newPost: Post = { ...res.data, likeCount: 0, commentCount: 0, likedByMe: false };
      onPost(newPost);
      setPostText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    } catch { /* ignore */ }
    finally { setPosting(false); }
  }

  function autoResize(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setPostText(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <InitialAvatar name={user?.anonAlias ?? 'A'} size={40} premium={isPremium} />
        <textarea
          ref={textareaRef}
          value={postText}
          onChange={autoResize}
          placeholder="What's on your mind? Share anonymously..."
          rows={2}
          style={{
            flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 14, padding: '11px 14px', fontSize: 14, color: '#e8f5e2',
            fontFamily: 'inherit', outline: 'none', resize: 'none', lineHeight: 1.55,
            minHeight: 52, maxHeight: 200, overflow: 'auto', transition: 'border-color 0.2s',
          }}
          onFocus={e => { e.target.style.borderColor = 'rgba(163,230,53,0.35)'; }}
          onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.10)'; }}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 52 }}>
        <span style={{
          fontSize: 11.5,
          fontWeight: 600,
          color: postText.length > 900 ? '#f87171' : postText.length > 700 ? '#f59e0b' : '#3d6b52',
          fontFamily: "'Oxanium', sans-serif",
          letterSpacing: '0.02em',
        }}>
          {postText.length} / 1000
        </span>
        <button
          onClick={submitPost}
          disabled={!postText.trim() || posting || postText.length > 1000}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '9px 22px', borderRadius: 99,
            border: 'none', cursor: postText.trim() ? 'pointer' : 'default', fontFamily: 'inherit',
            fontSize: 13, fontWeight: 700, color: '#1a2e05', transition: 'all 0.2s',
            background: postText.trim() ? accentGradient : 'rgba(255,255,255,0.08)',
            opacity: posting ? 0.7 : 1,
          }}
        >
          <Send size={13} color={postText.trim() ? '#1a2e05' : '#4d7a60'} />
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { user } = useAuthStore();
  const { loginWithGoogle } = useGoogleAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const LIMIT = 20;

  const onlineCount = useOnlineCount();
  const myPostCount = posts.filter(p => p.author.id === user?.id).length;

  const filteredPosts = posts.filter(p => {
    if (dateFilter === 'all') return true;
    const postDate = new Date(p.createdAt);
    const now = new Date();
    if (dateFilter === 'today') {
      return postDate.toDateString() === now.toDateString();
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return postDate >= weekAgo;
    }
    if (dateFilter === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
      return postDate >= monthAgo;
    }
    return true;
  });

  useEffect(() => {
    loadFeed(1, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadFeed(p: number, reset = false) {
    if (reset) setLoading(true); else setLoadingMore(true);
    try {
      const res = await api.get<{ data: Post[]; total: number }>('/posts', { params: { page: p, limit: LIMIT } });
      if (reset) setPosts(res.data.data);
      else setPosts(prev => [...prev, ...res.data.data]);
      setHasMore(p * LIMIT < res.data.total);
      setPage(p);
    } catch { /* ignore */ }
    finally { setLoading(false); setLoadingMore(false); }
  }

  function handleNewPost(post: Post) {
    setPosts(prev => [post, ...prev]);
  }

  function handleDelete(postId: string) {
    api.delete(`/posts/${postId}`).then(() => {
      setPosts(prev => prev.filter(p => p.id !== postId));
    }).catch(() => {});
  }

  function handleLikeToggle(postId: string, liked: boolean, likeCount: number) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, liked, likeCount, likedByMe: liked } : p));
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <style>{`
        .feed-page-root {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          padding: 20px 16px max(88px, calc(80px + env(safe-area-inset-bottom, 0px)));
        }

        /* Mobile: single column */
        .feed-layout {
          display: flex;
          flex-direction: column;
          gap: 12px;
          max-width: 640px;
          margin: 0 auto;
        }
        .feed-left-sidebar { display: none; }
        .feed-right-sidebar { display: none; }
        .feed-center { display: flex; flex-direction: column; gap: 12px; }

        /* Desktop: 3-column */
        @media (min-width: 1024px) {
          .feed-page-root {
            padding: 24px 24px 32px;
          }
          .feed-layout {
            display: grid;
            grid-template-columns: 240px 1fr 220px;
            grid-template-rows: auto;
            gap: 20px;
            max-width: 1100px;
            margin: 0 auto;
            align-items: start;
          }
          .feed-left-sidebar {
            display: block;
            grid-column: 1;
            position: sticky;
            top: 24px;
          }
          .feed-center {
            grid-column: 2;
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .feed-right-sidebar {
            display: block;
            grid-column: 3;
            position: sticky;
            top: 24px;
          }
        }

        /* Wide desktop: wider columns */
        @media (min-width: 1280px) {
          .feed-layout {
            grid-template-columns: 260px 1fr 250px;
            gap: 24px;
          }
        }

        .feed-load-more-btn {
          padding: 13px;
          border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: none;
          color: #6f9c81;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: background 0.18s;
        }
        .feed-load-more-btn:hover {
          background: rgba(255,255,255,0.07);
        }
        .feed-load-more-btn:disabled {
          opacity: 0.6;
          cursor: default;
        }

      `}</style>

      {/* Sliding keywords + online count */}
      <div className="shrink-0 flex items-center" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ flex: 1, overflow: 'hidden', padding: '10px 0' }}>
          <div style={{ display: 'flex', width: 'max-content', animation: 'slideKeywordsFeed 22s linear infinite', alignItems: 'center' }}>
            {['Anonymous', 'Voice Only', 'No Camera', 'No Signup', 'Bangladesh', 'Interest Match', 'Make Friends', 'English Practice', 'Blind Date', 'Free Forever',
              'Anonymous', 'Voice Only', 'No Camera', 'No Signup', 'Bangladesh', 'Interest Match', 'Make Friends', 'English Practice', 'Blind Date', 'Free Forever'].map((kw, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 500, color: '#6f9c81' }}>
                {kw}
                <span style={{ margin: '0 14px', color: 'rgba(111,156,129,0.4)', fontSize: 10 }}>·</span>
              </span>
            ))}
          </div>
          <style>{`
            @keyframes slideKeywordsFeed {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
        <div style={{ flexShrink: 0, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 6, borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: user?.isPremium ? '#f59e0b' : '#a3e635', flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: user?.isPremium ? '#fef3c7' : '#d3f099', fontWeight: 700, whiteSpace: 'nowrap' }}>
            {onlineCount.toLocaleString()} online
          </span>
        </div>
      </div>

      <div className="feed-page-root">
        <div className="feed-layout">
          {/* Left sidebar (desktop only) */}
          <div className="feed-left-sidebar">
            <LeftSidebar user={user} postCount={myPostCount} />
          </div>

          {/* Center column: create post + feed */}
          <div className="feed-center">
            {/* Section header (desktop) */}
            <div style={{ display: 'none' }} className="feed-header-desktop">
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#d4f5e2', margin: 0, fontFamily: "'Kanit', sans-serif" }}>Feed</h2>
            </div>

            {/* Create post — only for Google-linked users */}
            {user?.isLinked ? (
              <CreatePostBox user={user} onPost={handleNewPost} />
            ) : (
              <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ fontSize: 20 }}>✍️</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.45)', margin: '0 0 2px' }}>Want to post?</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', margin: 0 }}>Login with Google to share your thoughts</p>
                </div>
                <button
                  onClick={() => loginWithGoogle('/')}
                  style={{ flexShrink: 0, background: '#fff', border: 'none', borderRadius: 12, padding: '8px 14px', fontSize: 12, fontWeight: 700, color: '#1a1a1a', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  Login
                </button>
              </div>
            )}

            {/* Date filter bar */}
            {!loading && posts.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
                {([
                  { key: 'all', label: 'All' },
                  { key: 'today', label: 'Today' },
                  { key: 'week', label: 'This Week' },
                  { key: 'month', label: 'This Month' },
                ] as { key: typeof dateFilter; label: string }[]).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setDateFilter(key)}
                    style={{
                      padding: '6px 14px', borderRadius: 99, border: 'none',
                      fontSize: 12.5, fontWeight: dateFilter === key ? 700 : 500,
                      cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
                      transition: 'all 0.18s',
                      background: dateFilter === key
                        ? (user?.isPremium ? 'linear-gradient(150deg,#fde68a,#f59e0b)' : 'linear-gradient(150deg,#bef264,#84cc16)')
                        : 'rgba(255,255,255,0.05)',
                      color: dateFilter === key ? '#1a2e05' : '#6f9c81',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Feed list */}
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map(i => <PostSkeleton key={i} />)}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 24px', color: '#3d6b52', background: 'rgba(255,255,255,0.02)', borderRadius: 18 }}>
                <MessageCircle size={36} style={{ opacity: 0.25, marginBottom: 12 }} />
                <p style={{ fontSize: 14, margin: 0 }}>
                  {dateFilter === 'all' ? 'No posts yet. Be the first to share something!' : `No posts found for this time period.`}
                </p>
              </div>
            ) : (
              <>
                {filteredPosts.map(post => (
                  <PostCard
                    key={post.id}
                    post={post}
                    currentUserId={user?.id ?? ''}
                    currentUserIsPremium={user?.isPremium ?? false}
                    onDelete={handleDelete}
                    onLikeToggle={handleLikeToggle}
                  />
                ))}
                {hasMore && dateFilter === 'all' && (
                  <button
                    className="feed-load-more-btn"
                    onClick={() => loadFeed(page + 1)}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Right sidebar (desktop only) */}
          <div className="feed-right-sidebar">
            <RightSidebar />
          </div>
        </div>
      </div>
    </div>
  );
}
