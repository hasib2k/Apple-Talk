import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowUpRight } from 'lucide-react';

const BG = {
  background:
    'radial-gradient(120% 70% at 50% -8%, rgba(163,230,53,0.20), transparent 55%),' +
    'radial-gradient(90% 60% at 88% 22%, rgba(16,185,129,0.13), transparent 60%),' +
    'linear-gradient(180deg,#0a2013,#05140d 60%,#030f09)',
};

const BORDER = '1px solid rgba(255,255,255,0.07)';
const SECTION_BG = 'rgba(255,255,255,0.03)';

const FAQS = [
  { q: 'What is AppleTalk?', a: 'AppleTalk is a group audio meeting platform. You create a meeting link, share it, and people join to talk or listen — all audio, no camera.' },
  { q: 'Is AppleTalk free?', a: 'Yes. Creating and joining meetings is free.' },
  { q: 'How many people can join a meeting?', a: 'A meeting can hold thousands of participants. A limited number of speakers are heard at once while everyone else listens, so even very large rooms stay smooth.' },
  { q: 'Do I need an account?', a: 'To host a meeting you sign in with Google. People you invite can join directly from the meeting link (guest access may be restricted in production).' },
  { q: 'Does AppleTalk use my camera?', a: 'No. AppleTalk is audio-only and never requests camera access. There is no video at any point.' },
  { q: 'How does speaking work?', a: 'The host and promoted speakers can talk. Everyone else joins as audience, muted, and taps “raise hand” to request the mic. The host approves who gets to speak.' },
  { q: 'What can the host do?', a: 'The host can mute anyone, promote an audience member to speaker, demote a speaker, remove participants, turn chat on or off, and end the meeting for everyone.' },
  { q: 'Is there chat in a meeting?', a: 'Yes. The host can enable a text chat for the room, and everyone can send quick emoji reactions during the meeting.' },
  { q: 'Are my meetings recorded?', a: 'No. Meeting audio streams live through the media server and is not recorded or stored.' },
  { q: 'How do I share a meeting?', a: 'When you create a meeting, AppleTalk gives you a link. Anyone with the link can open it in a browser, check their mic, and join.' },
  { q: 'Can I use AppleTalk on mobile?', a: 'Yes. AppleTalk works on any device with a browser and microphone — Android, iPhone, or desktop. You can also install it as a PWA from your home screen.' },
];

export default function FaqPage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="flex flex-col" style={{ ...BG, minHeight: '100dvh', overflowY: 'auto' }}>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 lg:px-16 py-4" style={{ background: 'rgba(5,20,13,0.96)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => navigate('/about')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <img src="/logo.png" alt="AppleTalk" style={{ width: 36, height: 36 }} />
          <span style={{ fontSize: 20, fontWeight: 800, color: '#f4fbe9', letterSpacing: '-0.02em' }}>
            Apple<span style={{ color: '#a3e635' }}>Talk</span>
          </span>
        </button>
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
      </header>

      <main style={{ maxWidth: 800, margin: '0 auto', width: '100%', padding: '96px 24px 80px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6f9c81', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Help Center</p>
          <h1 style={{ fontSize: 'clamp(28px,5vw,48px)', fontWeight: 900, color: '#f4fbe9', letterSpacing: '-0.03em', marginBottom: 16 }}>
            Frequently Asked Questions
          </h1>
          <p style={{ fontSize: 16, color: '#7aaa8e', lineHeight: 1.65, maxWidth: 500, margin: '0 auto' }}>
            Everything you need to know about AppleTalk — group audio meetings, made simple.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {FAQS.map((item, i) => (
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

        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <p style={{ fontSize: 14, color: '#6f9c81', marginBottom: 16 }}>Still have questions?</p>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(163,230,53,0.10)',
              border: '1px solid rgba(163,230,53,0.30)',
              borderRadius: 99, padding: '12px 32px',
              fontSize: 14, fontWeight: 700, color: '#d3f099',
              cursor: 'pointer',
            }}
          >
            Try AppleTalk Free <ArrowUpRight size={14} />
          </button>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ borderTop: BORDER, padding: '28px 24px', marginTop: 8 }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
