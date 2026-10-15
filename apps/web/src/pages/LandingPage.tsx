import { useNavigate } from 'react-router-dom';
import {
  Mic, Shield, Zap, Users, Phone, MessageSquare,
  Shuffle, UserPlus, Smile, Star, ChevronDown,
  Check, X, MapPin, Heart, BookOpen, Gamepad2,
  Music, Plane, Video, Lock, ArrowUpRight,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { api } from '../lib/api';
import { usePwaInstall } from '../hooks/usePwaInstall';

const BG = {
  background:
    'radial-gradient(120% 70% at 50% -8%, rgba(163,230,53,0.20), transparent 55%),' +
    'radial-gradient(90% 60% at 88% 22%, rgba(16,185,129,0.13), transparent 60%),' +
    'radial-gradient(120% 80% at 0% 100%, rgba(88,163,64,0.08), transparent 55%),' +
    'linear-gradient(180deg,#0a2013,#05140d 60%,#030f09)',
};

const SECTION_BG = 'rgba(255,255,255,0.03)';
const BORDER = '1px solid rgba(255,255,255,0.07)';


function SectionLabel({ text }: { text: string }) {
  return (
    <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#6f9c81', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
      {text}
    </p>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ textAlign: 'center', fontSize: 'clamp(26px,5vw,40px)', fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.03em', marginBottom: 40 }}>
      {children}
    </h2>
  );
}


export default function LandingPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [onlineCount, setOnlineCount] = useState<number>(100);
  const { canInstall, triggerInstall } = usePwaInstall();
  const autoTriggered = useRef(false);

  useEffect(() => {
    api.get('/online-count').then(r => setOnlineCount((r.data.count ?? 0) + 100)).catch(() => {});
  }, []);

  // Auto-show install prompt on every fresh visit to landing page
  useEffect(() => {
    if (canInstall && !autoTriggered.current) {
      autoTriggered.current = true;
      const timer = setTimeout(() => triggerInstall(), 1500);
      return () => clearTimeout(timer);
    }
  }, [canInstall]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col" style={{ ...BG, minHeight: '100dvh', height: '100dvh', overflowY: 'auto' }}>

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-16 py-4" style={{ background: 'rgba(5,20,13,0.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <img src="/logo.png" alt="AppleTalk" style={{ width: 36, height: 36 }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.02em' }}>
            Apple<span style={{ color: '#a3e635' }}>Talk</span>
          </span>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(163,230,53,0.10)',
              border: '1px solid rgba(163,230,53,0.30)',
              borderRadius: 99, padding: '8px 28px',
              fontSize: 13, fontWeight: 700, color: '#d3f099',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            Launch App <ArrowUpRight size={14} strokeWidth={2.5} />
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 lg:px-16 flex flex-col gap-24 pb-24 pt-24">

        {/* ── Hero ── */}
        <section className="flex flex-col items-center text-center gap-4 pt-8 lg:pt-12">

          <style>{`
            @keyframes orbRingLanding {
              0%   { transform: scale(1);    opacity: 0.55; }
              100% { transform: scale(1.6);  opacity: 0; }
            }
            @keyframes fadeInUp {
              from { opacity: 0; transform: translateY(10px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes pulseDot {
              0%, 100% { opacity: 1; }
              50%       { opacity: 0.35; }
            }
            @keyframes ticker {
              0%   { opacity: 0; transform: translateY(8px); }
              12%  { opacity: 1; transform: translateY(0); }
              88%  { opacity: 1; transform: translateY(0); }
              100% { opacity: 0; transform: translateY(-8px); }
            }
          `}</style>

          {/* Live status strip */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', alignItems: 'center',
          }}>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(38px, 8.5vw, 80px)',
            fontWeight: 900, color: '#ffffff',
            letterSpacing: '-0.04em', lineHeight: 0.94, margin: 0,
            fontFamily: "'Oxanium', sans-serif",
          }}>
            Talk to strangers.<br />
            <span style={{ color: '#a3e635' }}>Stay anonymous.</span>
          </h1>

          <p style={{
            fontSize: 'clamp(15px, 2vw, 18px)',
            color: '#7aaa8e', lineHeight: 1.65,
            maxWidth: 500, margin: '0 auto',
          }}>
            Bangladesh's free anonymous voice chat. No camera, no signup, no password.
            Match by interest in seconds.
          </p>

          {/* Install button + note */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            {canInstall && (
              <button
                onClick={triggerInstall}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 99, padding: '10px 22px',
                  fontSize: 13, fontWeight: 600, color: '#9dbfaa',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.09)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              >
                📲 Install App — Add to Home Screen
              </button>
            )}
            <p style={{ fontSize: 11.5, color: 'rgba(143,206,168,0.4)', letterSpacing: '0.01em' }}>No account needed · 100% free · Voice only</p>
          </div>

          {/* ── Feature widget cards ── */}
          <div style={{ width: '100%', maxWidth: 700, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }} className="grid-cols-3-hero">
            {[
              { icon: <Shield size={20} color="#a3e635" />, title: '100% Anonymous', desc: 'No name, no photo, no trace' },
              { icon: <Zap size={20} color="#a3e635" />, title: 'No Signup', desc: 'Open and start — instantly' },
              { icon: <Mic size={20} color="#a3e635" />, title: 'Voice Only', desc: 'No camera, no video, ever' },
              { icon: <Users size={20} color="#a3e635" />, title: 'Interest Match', desc: 'Talk about what you love' },
              { icon: <Phone size={20} color="#a3e635" />, title: 'Friend Calls', desc: 'Stay connected with anyone' },
              { icon: <MessageSquare size={20} color="#a3e635" />, title: 'In-Call Chat', desc: 'Text while you talk' },
            ].map((f, i) => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16, padding: '16px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                textAlign: 'left',
                animation: `fadeInUp 0.4s ease ${i * 0.06}s both`,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#f4fbe9', margin: 0 }}>{f.title}</p>
                  <p style={{ fontSize: 11.5, color: '#6f9c81', margin: '3px 0 0', lineHeight: 1.4 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <style>{`
            @media (max-width: 560px) {
              .grid-cols-3-hero { grid-template-columns: repeat(2, 1fr) !important; }
            }
          `}</style>



        </section>

        {/* ── How It Works ── */}
        <section>
          <SectionLabel text="How it works" />
          <SectionHeading>Start a conversation in 3 steps</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <Users size={28} className="text-green-400" />, step: '01', title: 'Pick your gender & interests', desc: 'No real name, no photo. Just select your gender once and choose interests like music, gaming, or travel to get better matches.' },
              { icon: <Shuffle size={28} className="text-green-400" />, step: '02', title: 'Get randomly matched', desc: 'AppleTalk pairs you with another anonymous user based on shared interests and your region. Matching takes under 30 seconds.' },
              { icon: <Mic size={28} className="text-green-400" />, step: '03', title: 'Talk, chat & make friends', desc: 'A peer-to-peer voice call starts instantly. Chat via text during the call. Add the person as a friend or skip for someone new.' },
            ].map((s, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 20, padding: '28px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {s.icon}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(163,230,53,0.4)', letterSpacing: '0.06em' }}>STEP {s.step}</span>
                </div>
                <h3 style={{ fontSize: 17, fontWeight: 700, color: '#f4fbe9', marginBottom: 8 }}>{s.title}</h3>
                <p style={{ fontSize: 14, color: '#7aaa8e', lineHeight: 1.65 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Use Cases ── */}
        <section>
          <SectionLabel text="Who is it for?" />
          <SectionHeading>A conversation for every mood</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                icon: <Mic size={30} className="text-green-400" />,
                title: 'English Practice',
                desc: 'Want to improve your spoken English? AppleTalk connects you with people who want to practice too. Talk freely without judgment.',
                tags: ['Speaking Practice', 'No Pressure', 'Daily Sessions'],
              },
              {
                icon: <Heart size={30} style={{ color: '#f472b6' }} />,
                title: 'Blind Date',
                desc: 'Meet someone new in a safe, anonymous way. No photos, no profiles — just pure conversation. Let your personality do the talking.',
                tags: ['Anonymous', 'Safe', 'Fun'],
              },
              {
                icon: <Users size={30} className="text-blue-400" />,
                title: 'Make Friends',
                desc: 'Feeling lonely? AppleTalk connects you with people who share your interests. From anime fans to football lovers — find your people.',
                tags: ['Shared Interests', 'Friend System', 'Stay Connected'],
              },
            ].map((u, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 20, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {u.icon}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f4fbe9', marginBottom: 8 }}>{u.title}</h3>
                  <p style={{ fontSize: 14, color: '#7aaa8e', lineHeight: 1.65 }}>{u.desc}</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                  {u.tags.map(t => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 600, color: '#6f9c81', background: 'rgba(255,255,255,0.04)', border: BORDER, borderRadius: 99, padding: '4px 10px' }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Interest Showcase ── */}
        <section style={{ textAlign: 'center' }}>
          <SectionLabel text="Match by interest" />
          <SectionHeading>Find people who get you</SectionHeading>
          <p style={{ color: '#7aaa8e', fontSize: 15, maxWidth: 500, margin: '0 auto 32px', lineHeight: 1.65 }}>
            Select your interests before matching. AppleTalk prioritises pairing you with someone who shares your vibe.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {[
              { icon: <Music size={14} />, label: 'Music' },
              { icon: <Gamepad2 size={14} />, label: 'Gaming' },
              { icon: <Zap size={14} />, label: 'Anime' },
              { icon: <BookOpen size={14} />, label: 'Books' },
              { icon: <Plane size={14} />, label: 'Travel' },
              { icon: <Mic size={14} />, label: 'English Practice' },
              { icon: <Heart size={14} />, label: 'Blind Date' },
              { icon: <Users size={14} />, label: 'Make Friends' },
              { icon: <Shield size={14} />, label: 'Tech' },
              { icon: <Smile size={14} />, label: 'Fitness' },
              { icon: <Phone size={14} />, label: 'Coding' },
              { icon: <MessageSquare size={14} />, label: 'Movies' },
            ].map((i, idx) => (
              <div key={idx} style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: idx % 3 === 0 ? 'rgba(163,230,53,0.10)' : 'rgba(255,255,255,0.05)',
                border: idx % 3 === 0 ? '1px solid rgba(163,230,53,0.25)' : BORDER,
                borderRadius: 99, padding: '9px 16px',
                fontSize: 13, fontWeight: 600,
                color: idx % 3 === 0 ? '#a3e635' : '#9dbfaa',
              }}>
                {i.icon}{i.label}
              </div>
            ))}
          </div>
        </section>

        {/* ── City Section ── */}
        <section>
          <SectionLabel text="Available across Bangladesh" />
          <SectionHeading>Connect with people from your city</SectionHeading>
          <p style={{ textAlign: 'center', color: '#7aaa8e', fontSize: 15, maxWidth: 520, margin: '0 auto 36px', lineHeight: 1.65 }}>
            AppleTalk matches you by region so you can talk to people near you — or anywhere in Bangladesh.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { city: 'Dhaka', desc: 'Capital city · Most active' },
              { city: 'Chittagong', desc: 'Port city · Growing fast' },
              { city: 'Sylhet', desc: 'Tea garden vibes' },
              { city: 'Rajshahi', desc: 'University crowd' },
              { city: 'Khulna', desc: 'Coastal connections' },
              { city: 'Comilla', desc: 'Historical city' },
              { city: 'Barishal', desc: 'River delta region' },
              { city: 'Mymensingh', desc: 'Agricultural hub' },
            ].map((c, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 16, padding: '18px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <MapPin size={15} color="#a3e635" style={{ flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#f4fbe9' }}>{c.city}</p>
                  <p style={{ fontSize: 11, color: '#6f9c81', marginTop: 2 }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comparison Table ── */}
        <section>
          <SectionLabel text="Why AppleTalk?" />
          <SectionHeading>How we compare</SectionHeading>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={{ padding: '14px 16px', textAlign: 'left', color: '#6f9c81', fontWeight: 600, fontSize: 12, borderBottom: BORDER }}>Feature</th>
                  {['AppleTalk', 'Omegle', 'Chatroulette', 'Discord'].map(app => (
                    <th key={app} style={{ padding: '14px 16px', textAlign: 'center', color: app === 'AppleTalk' ? '#a3e635' : '#6f9c81', fontWeight: 700, fontSize: 13, borderBottom: BORDER }}>
                      {app}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { feature: '100% Anonymous', vals: [true, true, false, false] },
                  { feature: 'No Signup Required', vals: [true, true, false, false] },
                  { feature: 'Voice Only · No Camera', vals: [true, false, false, true] },
                  { feature: 'Interest Matching', vals: [true, false, false, true] },
                  { feature: 'Friend System', vals: [true, false, false, true] },
                  { feature: 'Bangladesh Focus', vals: [true, false, false, false] },
                  { feature: 'In-Call Text Chat', vals: [true, true, false, true] },
                  { feature: 'Completely Free', vals: [true, true, true, true] },
                ].map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent' }}>
                    <td style={{ padding: '13px 16px', color: '#c5dfc8', fontWeight: 500 }}>{row.feature}</td>
                    {row.vals.map((v, j) => (
                      <td key={j} style={{ padding: '13px 16px', textAlign: 'center' }}>
                        {v
                          ? <Check size={16} color="#4ade80" style={{ margin: '0 auto' }} />
                          : <X size={16} color="#6f9c81" style={{ margin: '0 auto', opacity: 0.5 }} />
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Features Grid ── */}
        <section>
          <SectionLabel text="Features" />
          <SectionHeading>Everything you need, nothing you don't</SectionHeading>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: <Shield size={22} />, title: 'Fully Anonymous', desc: 'No real name, no profile photo, no camera. You are only known by a randomly generated alias.' },
              { icon: <Zap size={22} />, title: 'No Account Required', desc: 'No email, phone number, or password. Open the app and you are ready to talk in seconds.' },
              { icon: <Mic size={22} />, title: 'Voice Only · No Video', desc: 'Audio-only calls via WebRTC. No camera access ever requested. Private by design.' },
              { icon: <Users size={22} />, title: 'Interest-Based Matching', desc: 'Match with people who share your vibe — gaming, music, anime, books, travel, and more.' },
              { icon: <UserPlus size={22} />, title: 'Friend System', desc: 'Add someone as an anonymous friend and call or message them directly anytime.' },
              { icon: <MessageSquare size={22} />, title: 'In-Call Text Chat', desc: 'Send text messages while on a live voice call without interrupting the conversation.' },
              { icon: <Phone size={22} />, title: 'Call History', desc: 'See who you talked to recently and call them again if they are online.' },
              { icon: <Smile size={22} />, title: 'Voice Reactions', desc: 'Send live emoji reactions during a call to express yourself without speaking.' },
              { icon: <Shuffle size={22} />, title: 'Instant Skip', desc: 'Not vibing? Skip to a new random match instantly. No awkward goodbyes needed.' },
            ].map((f, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 18, padding: '22px 20px' }}>
                <div style={{ color: '#4ade80', marginBottom: 12 }}>{f.icon}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f4fbe9', marginBottom: 6 }}>{f.title}</h3>
                <p style={{ fontSize: 13, color: '#7aaa8e', lineHeight: 1.6 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Privacy / Trust ── */}
        <section style={{ background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.12)', borderRadius: 24, padding: '40px 32px' }}>
          <SectionLabel text="Privacy & Trust" />
          <SectionHeading>Your privacy is our priority</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Lock size={24} />, title: 'No Audio Recording', desc: 'All calls are peer-to-peer via WebRTC. We never record, store, or access your voice calls. Audio goes directly between you and the other person.' },
              { icon: <Video size={24} />, title: 'No Camera Ever', desc: 'We never request camera access. AppleTalk is voice-only by design. No video, no screenshots, no visual identity.' },
              { icon: <Shield size={24} />, title: 'No Data Selling', desc: 'We do not sell, share, or rent your data to any third party under any circumstances. Your anonymous identity stays anonymous.' },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(163,230,53,0.10)', border: '1px solid rgba(163,230,53,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3e635' }}>
                  {p.icon}
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f4fbe9' }}>{p.title}</h3>
                <p style={{ fontSize: 13.5, color: '#7aaa8e', lineHeight: 1.7 }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Stats ── */}
        <section style={{ background: SECTION_BG, border: BORDER, borderRadius: 24, padding: '40px 32px', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px,4vw,34px)', fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.02em', marginBottom: 8 }}>
            Bangladesh's anonymous voice chat
          </h2>
          <p style={{ color: '#7aaa8e', fontSize: 15, maxWidth: 500, margin: '0 auto 36px', lineHeight: 1.6 }}>
            Thousands of conversations happening every day — completely anonymous, completely free.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { value: '100%', label: 'Free Forever' },
              { value: '0', label: 'Data Shared' },
              { value: '<30s', label: 'Average Match Time' },
              { value: '0', label: 'Cameras Required' },
            ].map((s, i) => (
              <div key={i}>
                <p style={{ fontSize: 'clamp(28px,5vw,44px)', fontWeight: 900, color: '#a3e635', letterSpacing: '-0.03em' }}>{s.value}</p>
                <p style={{ fontSize: 13, color: '#7aaa8e', marginTop: 4 }}>{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section>
          <SectionLabel text="What people say" />
          <SectionHeading>Real conversations. Real connections.</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { text: 'I was nervous to talk to strangers but AppleTalk made it so easy. Nobody knows who I am and that makes it so much fun.', alias: 'Mango#2841', interest: 'Music & Gaming', city: 'Dhaka' },
              { text: 'Found someone to practice English with every day. This app is honestly the best thing for improving your speaking skills.', alias: 'Apple#5512', interest: 'English Practice', city: 'Chittagong' },
              { text: 'Met a friend from Sylhet on here. We have been talking for weeks via the friend feature. Genuinely amazing app!', alias: 'Leaf#9073', interest: 'Travel & Books', city: 'Rajshahi' },
            ].map((t, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 20, padding: '24px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 2 }}>
                  {[1,2,3,4,5].map(s => <Star key={s} size={13} fill="#a3e635" color="#a3e635" />)}
                </div>
                <p style={{ fontSize: 14, color: '#c5dfc8', lineHeight: 1.7, flex: 1 }}>"{t.text}"</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#f4fbe9' }}>{t.alias}</p>
                    <p style={{ fontSize: 11, color: '#6f9c81', marginTop: 2 }}>{t.interest}</p>
                  </div>
                  <span style={{ fontSize: 11, color: '#6f9c81', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <MapPin size={10} />{t.city}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── FAQ ── */}
        <section>
          <SectionLabel text="FAQ" />
          <SectionHeading>Frequently asked questions</SectionHeading>
          <div className="max-w-2xl mx-auto flex flex-col gap-3">
            {[
              { q: 'What is AppleTalk?', a: 'AppleTalk is a free anonymous voice chat app for Bangladesh. It connects you with random strangers via voice-only calls. No camera, no signup, and no password required.' },
              { q: 'Is AppleTalk free?', a: 'Yes, completely free. No subscriptions, no ads, no hidden charges. Just open the app and start talking.' },
              { q: 'Do I need to create an account?', a: 'No account needed. AppleTalk automatically gives you a randomly generated anonymous alias. Just pick your gender once and you are ready.' },
              { q: 'Is AppleTalk anonymous?', a: 'Yes, 100% anonymous. No real name, no profile photo, no camera. You are identified only by a randomly generated alias like Apple#1234.' },
              { q: 'Is AppleTalk an Omegle alternative?', a: 'Yes. AppleTalk is a voice-only Omegle alternative focused on Bangladesh with interest-based matching and no video.' },
              { q: 'How does AppleTalk match people?', a: 'AppleTalk matches you based on shared interests like music, gaming, books, and your region. Matching usually takes under 30 seconds.' },
              { q: 'Is my voice call private?', a: 'Yes. All calls are peer-to-peer using WebRTC. We do not record, store, or listen to any audio from your calls.' },
              { q: 'Can I add someone as a friend?', a: 'Yes. During or after a call you can send a friend request. If they accept, you can call or message them directly anytime.' },
              { q: 'Which cities in Bangladesh can I talk to people from?', a: 'AppleTalk works across all of Bangladesh — Dhaka, Chittagong, Sylhet, Rajshahi, Khulna, Comilla, Barishal, Mymensingh, and more.' },
              { q: 'Can I use AppleTalk on mobile?', a: 'Yes. AppleTalk works on any device with a browser and microphone — Android, iPhone, or desktop. No app download required.' },
            ].map((item, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 16, overflow: 'hidden' }}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                >
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#f4fbe9' }}>{item.q}</span>
                  <ChevronDown size={16} color="#6f9c81" style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                {openFaq === i && (
                  <div style={{ padding: '0 20px 18px' }}>
                    <p style={{ fontSize: 14, color: '#7aaa8e', lineHeight: 1.7 }}>{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>


      </main>

      {/* ── Footer ── */}
      <footer style={{ borderTop: BORDER, padding: '28px 24px', marginTop: 8 }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="AppleTalk" style={{ width: 24, height: 24 }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: '#d3f099' }}>Apple<span style={{ color: '#a3e635' }}>Talk</span></span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { label: 'About', path: '/about' },
              { label: 'FAQ', path: '/faq' },
              { label: 'Privacy', path: '/privacy' },
              { label: 'Terms', path: '/terms' },
            ].map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'rgba(143,206,168,0.5)', padding: 0 }}>{label}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'rgba(143,206,168,0.35)' }}>
            © {new Date().getFullYear()} AppleTalk
          </p>
        </div>
      </footer>
    </div>
  );
}
