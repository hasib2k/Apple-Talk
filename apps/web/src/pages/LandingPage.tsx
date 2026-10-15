import { useNavigate } from 'react-router-dom';
import {
  Mic, Shield, Zap, Users, MessageSquare, Hand,
  Link2, Crown, ChevronDown, Lock, Video, ArrowUpRight, Download,
} from 'lucide-react';
import { useState } from 'react';
import { usePwaInstall } from '../hooks/usePwaInstall';

const BG = {
  background:
    'radial-gradient(120% 70% at 50% -8%, rgba(163,230,53,0.20), transparent 55%),' +
    'radial-gradient(90% 60% at 88% 22%, rgba(16,185,129,0.13), transparent 60%),' +
    'radial-gradient(120% 80% at 0% 100%, rgba(88,163,64,0.08), transparent 55%),' +
    'linear-gradient(180deg,#0a2417,#0b2417 60%,#071a10)',
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
  const { canInstall, triggerInstall } = usePwaInstall();

  return (
    <div className="flex flex-col" style={{ ...BG, minHeight: '100dvh', height: '100dvh', overflowY: 'auto' }}>

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-16 py-4" style={{ background: 'rgba(7,26,16,0.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <img src="/logo.png" alt="AppleTalk" style={{ width: 36, height: 36 }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.02em' }}>
            Apple<span style={{ color: '#a3e635' }}>Talk</span>
          </span>
        </button>
        <button onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(163,230,53,0.10)', border: '1px solid rgba(163,230,53,0.30)', borderRadius: 99, padding: '8px 28px', fontSize: 13, fontWeight: 700, color: '#d3f099', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          Launch App <ArrowUpRight size={14} strokeWidth={2.5} />
        </button>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-6 lg:px-16 flex flex-col gap-24 pb-24 pt-24">

        {/* ── Hero ── */}
        <section className="flex flex-col items-center text-center gap-5 pt-8 lg:pt-12">
          <style>{`@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>

          <h1 style={{ fontSize: 'clamp(38px, 8.5vw, 80px)', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.04em', lineHeight: 0.96, margin: 0, fontFamily: "'Oxanium', sans-serif" }}>
            Audio meetings<br /><span style={{ color: '#a3e635' }}>for everyone.</span>
          </h1>

          <p style={{ fontSize: 'clamp(15px, 2vw, 18px)', color: '#7aaa8e', lineHeight: 1.65, maxWidth: 520, margin: '0 auto' }}>
            Create a meeting link and share it. Thousands can join and listen,
            speakers talk, and you run the room — all audio, no camera.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(145deg,#c6f06a,#84cc16)', color: '#1a2e05', border: 'none', borderRadius: 99, padding: '14px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '5px 5px 14px rgba(0,0,0,0.4), inset 2px 2px 5px rgba(226,255,170,0.6), inset -4px -4px 9px rgba(77,124,15,0.6)' }}>
              Start a meeting <ArrowUpRight size={16} strokeWidth={2.5} />
            </button>
            {canInstall && (
              <button onClick={triggerInstall} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 99, padding: '14px 24px', fontSize: 14, fontWeight: 600, color: '#9dbfaa', cursor: 'pointer' }}>
                <Download size={16} /> Install App
              </button>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: 'rgba(143,206,168,0.4)' }}>No downloads · Works in the browser · Audio only</p>

          {/* Feature widget cards */}
          <div style={{ width: '100%', maxWidth: 760, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 8 }} className="grid-cols-3-hero">
            {[
              { icon: <Link2 size={20} color="#a3e635" />, title: 'Share a link', desc: 'Create a room, send the link' },
              { icon: <Mic size={20} color="#a3e635" />, title: 'Audio only', desc: 'No camera, no video, ever' },
              { icon: <Users size={20} color="#a3e635" />, title: 'Scales big', desc: 'Thousands can join & listen' },
              { icon: <Hand size={20} color="#a3e635" />, title: 'Raise to speak', desc: 'Audience requests the mic' },
              { icon: <Crown size={20} color="#a3e635" />, title: 'Host controls', desc: 'Mute, promote, remove' },
              { icon: <MessageSquare size={20} color="#a3e635" />, title: 'Chat & reactions', desc: 'Text + emoji, host-gated' },
            ].map((f, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, textAlign: 'left', animation: `fadeInUp 0.4s ease ${i * 0.06}s both` }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.icon}</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#f4fbe9', margin: 0 }}>{f.title}</p>
                  <p style={{ fontSize: 11.5, color: '#6f9c81', margin: '3px 0 0', lineHeight: 1.4 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <style>{`@media (max-width: 560px) { .grid-cols-3-hero { grid-template-columns: repeat(2, 1fr) !important; } }`}</style>
        </section>

        {/* ── How It Works ── */}
        <section>
          <SectionLabel text="How it works" />
          <SectionHeading>Start a meeting in 3 steps</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <Link2 size={28} className="text-green-400" />, step: '01', title: 'Create a meeting', desc: 'Tap “New meeting” and AppleTalk instantly generates a shareable room link — no scheduling, no setup.' },
              { icon: <Users size={28} className="text-green-400" />, step: '02', title: 'Share the link', desc: 'Send the link to anyone. They open it in a browser, check their mic, and join in seconds.' },
              { icon: <Mic size={28} className="text-green-400" />, step: '03', title: 'Host the room', desc: 'Speakers talk, the audience raises hands to join in, and you mute, promote, or remove people as host.' },
            ].map((s, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 20, padding: '28px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{s.icon}</div>
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
          <SectionLabel text="What it's for" />
          <SectionHeading>One link, any kind of room</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: <Users size={30} className="text-green-400" />, title: 'Town halls & webinars', desc: 'A few speakers present, thousands listen in. Audience raises hands for Q&A when you allow it.', tags: ['Large scale', 'Q&A', 'Broadcast'] },
              { icon: <Mic size={30} className="text-green-400" />, title: 'Community audio rooms', desc: 'Open a casual room and let people drop in to talk — like a live audio lounge for your group.', tags: ['Drop-in', 'Live', 'Social'] },
              { icon: <Crown size={30} className="text-green-400" />, title: 'Team standups', desc: 'Quick audio sync for your team. Create a link, everyone joins, no accounts required to listen.', tags: ['Fast', 'No setup', 'Browser'] },
            ].map((u, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 20, padding: '28px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,0.05)', border: BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{u.icon}</div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f4fbe9', marginBottom: 8 }}>{u.title}</h3>
                  <p style={{ fontSize: 14, color: '#7aaa8e', lineHeight: 1.65 }}>{u.desc}</p>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'auto' }}>
                  {u.tags.map((t) => (
                    <span key={t} style={{ fontSize: 11, fontWeight: 600, color: '#6f9c81', background: 'rgba(255,255,255,0.04)', border: BORDER, borderRadius: 99, padding: '4px 10px' }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Features Grid ── */}
        <section>
          <SectionLabel text="Features" />
          <SectionHeading>Everything you need to run the room</SectionHeading>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { icon: <Link2 size={22} />, title: 'Instant meeting links', desc: 'Generate a shareable room link in one tap. No scheduling or calendar needed.' },
              { icon: <Mic size={22} />, title: 'Audio only · no video', desc: 'Crystal-clear group audio over WebRTC. The camera is never requested.' },
              { icon: <Users size={22} />, title: 'Scales to thousands', desc: 'Built on a media server (SFU) so huge rooms stay smooth — listeners cost almost nothing.' },
              { icon: <Hand size={22} />, title: 'Raise hand to speak', desc: 'Audience joins muted and raises a hand; the host promotes them to speaker.' },
              { icon: <Crown size={22} />, title: 'Full host controls', desc: 'Mute anyone, promote or demote, remove participants, and end the meeting for all.' },
              { icon: <MessageSquare size={22} />, title: 'Chat & reactions', desc: 'Host-gated text chat plus live emoji reactions during the meeting.' },
              { icon: <Zap size={22} />, title: 'Join from the browser', desc: 'No install required. Works on Android, iPhone, and desktop browsers.' },
              { icon: <Shield size={22} />, title: 'Google or guest', desc: 'Sign in with Google to host, or join as a guest straight from a link.' },
              { icon: <Lock size={22} />, title: 'You control who speaks', desc: 'Only the host and approved speakers can be heard — no surprise interruptions.' },
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
          <SectionHeading>Private by design</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: <Video size={24} />, title: 'No camera, ever', desc: 'AppleTalk never requests camera access. Meetings are audio-only — no video, no screenshots.' },
              { icon: <Mic size={24} />, title: 'We don’t record', desc: 'Your meeting audio streams live through the media server and is never recorded or stored.' },
              { icon: <Shield size={24} />, title: 'No data selling', desc: 'We never sell or rent your data. Only basic account and meeting records are kept to run the service.' },
            ].map((p, i) => (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(163,230,53,0.10)', border: '1px solid rgba(163,230,53,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a3e635' }}>{p.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#f4fbe9' }}>{p.title}</h3>
                <p style={{ fontSize: 13.5, color: '#7aaa8e', lineHeight: 1.7 }}>{p.desc}</p>
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
              { q: 'What is AppleTalk?', a: 'AppleTalk is a group audio meeting platform. Create a meeting link, share it, and people join to talk or listen — all audio, no camera.' },
              { q: 'How many people can join a meeting?', a: 'A meeting can hold thousands of participants. A few speakers are heard at a time while everyone else listens, so large rooms stay smooth.' },
              { q: 'Is it free?', a: 'Yes. Creating and joining meetings is free.' },
              { q: 'Do I need an account?', a: 'To host a meeting you sign in with Google. People you invite can join straight from the link (guest access may be limited in production).' },
              { q: 'Does it use my camera?', a: 'No. AppleTalk is audio-only and never requests camera access.' },
              { q: 'How does speaking work?', a: 'The host and promoted speakers can talk. Everyone else joins as audience and taps “raise hand” to request the mic — the host approves.' },
              { q: 'Can the host moderate the room?', a: 'Yes. The host can mute anyone, promote or demote speakers, remove participants, toggle chat, and end the meeting for everyone.' },
              { q: 'Do I need to install anything?', a: 'No. AppleTalk runs in any modern browser with a microphone — on Android, iPhone, or desktop.' },
            ].map((item, i) => (
              <div key={i} style={{ background: SECTION_BG, border: BORDER, borderRadius: 16, overflow: 'hidden' }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
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
          <p style={{ fontSize: 12, color: 'rgba(143,206,168,0.35)' }}>© {new Date().getFullYear()} AppleTalk</p>
        </div>
      </footer>
    </div>
  );
}
