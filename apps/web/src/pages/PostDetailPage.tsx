import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Crown } from 'lucide-react';
import { api } from '../lib/api';
import { PostSkeleton, CommentSkeleton } from '../components/Shimmer';
import { VerifiedBadge } from '../components/VerifiedBadge';

interface PostAuthor {
  id: string;
  anonAlias: string;
  isPremium: boolean;
  isLinked: boolean;
  gender: string | null;
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

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: PostAuthor;
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function Avatar({ size = 40, premium = false }: { size?: number; premium?: boolean }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: premium ? 'linear-gradient(150deg,#78350f,#1c0d00)' : 'linear-gradient(150deg,#1f5c3d,#0c2e1d)',
      border: premium ? '1.5px solid rgba(245,158,11,0.35)' : '1.5px solid rgba(163,230,53,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    }}>
      <img src="/logo.png" alt="avatar" style={{ width: size * 0.58, height: size * 0.58, objectFit: 'contain' }} />
    </div>
  );
}

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.get<Post>(`/posts/${id}`)
      .then(res => {
        setPost(res.data);
        return api.get<Comment[]>(`/posts/${id}/comments`);
      })
      .then(res => setComments(res.data))
      .catch(() => setNotFound(true))
      .finally(() => { setLoading(false); setCommentsLoading(false); });
  }, [id]);

  return (
    <div style={{ minHeight: '100dvh', background: '#05140d', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,20,13,0.95)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
        >
          <ArrowLeft size={16} color="#a3e635" />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: '#d4f5e2' }}>Post</span>
      </div>

      <div style={{ flex: 1, maxWidth: 640, width: '100%', margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <PostSkeleton />
        ) : notFound ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <p style={{ fontSize: 15, color: '#6f9c81', marginBottom: 16 }}>This post is no longer available.</p>
            <button
              onClick={() => navigate('/')}
              style={{ padding: '10px 24px', borderRadius: 99, background: 'rgba(163,230,53,0.10)', border: '1px solid rgba(163,230,53,0.25)', color: '#a3e635', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Go to Feed
            </button>
          </div>
        ) : post && (
          <>
            {/* Post card */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 18, overflow: 'hidden' }}>
              {post.author.isPremium && (
                <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#f59e0b,transparent)' }} />
              )}
              <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 13 }}>
                {/* Author */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                  <Avatar size={40} premium={post.author.isPremium} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: post.author.isPremium ? '#fbbf24' : '#d4f5e2', fontFamily: "'Kanit', sans-serif" }}>
                        {post.author.anonAlias}
                      </span>
                      {post.author.isPremium && <Crown size={12} color="#f59e0b" />}
                      {post.author.isLinked && <VerifiedBadge size={12} />}
                      {post.author.gender && (
                        <span style={{ fontSize: 11, color: post.author.gender === 'male' ? '#60a5fa' : '#f472b6' }}>
                          {post.author.gender === 'male' ? '♂' : '♀'}
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 11, color: '#3d6b52', margin: 0 }}>{timeAgo(post.createdAt)}</p>
                  </div>
                </div>

                {/* Content */}
                <p style={{ fontSize: 14.5, color: '#e8f5e2', lineHeight: 1.68, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {post.content}
                </p>

                {/* Stats */}
                {(post.likeCount > 0 || post.commentCount > 0) && (
                  <div style={{ display: 'flex', gap: 14, fontSize: 11.5, color: '#3d6b52' }}>
                    {post.likeCount > 0 && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Heart size={11} fill={post.likedByMe ? '#ef4444' : 'none'} color={post.likedByMe ? '#ef4444' : '#3d6b52'} />
                        {post.likeCount} {post.likeCount === 1 ? 'like' : 'likes'}
                      </span>
                    )}
                    {post.commentCount > 0 && <span>{post.commentCount} {post.commentCount === 1 ? 'comment' : 'comments'}</span>}
                  </div>
                )}
              </div>
            </div>

            {/* Comments */}
            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 18, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#6f9c81', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>Comments</p>
              {commentsLoading ? (
                <>
                  <CommentSkeleton />
                  <CommentSkeleton />
                  <CommentSkeleton />
                </>
              ) : comments.length === 0 ? (
                <p style={{ fontSize: 12.5, color: '#3d6b52', textAlign: 'center', padding: '8px 0', margin: 0 }}>No comments yet.</p>
              ) : (
                comments.map(c => (
                  <div key={c.id} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                    <Avatar size={28} premium={c.author.isPremium} />
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '8px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: c.author.isPremium ? '#fbbf24' : '#a3e635' }}>{c.author.anonAlias}</span>
                        {c.author.isPremium && <Crown size={10} color="#f59e0b" />}
                        <span style={{ fontSize: 10, color: '#3d6b52', marginLeft: 'auto' }}>{timeAgo(c.createdAt)}</span>
                      </div>
                      <p style={{ fontSize: 13, color: '#c5dfc8', margin: 0, lineHeight: 1.5 }}>{c.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Open in feed */}
            <button
              onClick={() => navigate('/')}
              style={{ padding: '12px', borderRadius: 14, background: 'rgba(163,230,53,0.06)', border: '1px solid rgba(163,230,53,0.15)', color: '#a3e635', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              Open Feed
            </button>
          </>
        )}
      </div>
    </div>
  );
}
