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
  { q: 'What is AppleTalk?', a: 'AppleTalk is a free anonymous voice chat app built for Bangladesh. It connects you instantly with random strangers through voice-only calls — no camera, no signup, and no password required.' },
  { q: 'Is AppleTalk free?', a: 'Yes, completely free. No subscriptions, no ads, no hidden charges. Just open the app and start talking.' },
  { q: 'Do I need to create an account?', a: 'No account is needed to start. AppleTalk gives you a randomly generated anonymous alias automatically. Optionally sign in with Google to unlock premium features like call history, friend messaging, and Feed posts.' },
  { q: 'Is AppleTalk anonymous?', a: 'Yes, 100% anonymous. No real name, no profile photo, no camera. You are identified only by a randomly generated alias like Apple#1234. Nobody knows who you really are.' },
  { q: 'Is AppleTalk an Omegle alternative?', a: 'Yes. AppleTalk is a voice-only Omegle alternative focused on Bangladesh. Unlike Omegle, it has interest-based matching, a friend system, in-call chat, and no video.' },
  { q: 'How does AppleTalk match people?', a: 'AppleTalk matches you based on shared interests (music, gaming, books, travel, etc.) and your region. Matching typically takes under 30 seconds.' },
  { q: 'Is my voice call private?', a: 'Yes. All calls are peer-to-peer using WebRTC technology. We never record, store, or listen to any audio from your calls. The audio goes directly between the two parties.' },
  { q: 'Can I add someone as a friend?', a: 'Yes. During or after a call you can send a friend request. Once accepted, you can call or message them directly anytime — even when not in a random call.' },
  { q: 'Which cities in Bangladesh can I connect from?', a: 'AppleTalk works across all of Bangladesh — Dhaka, Chittagong, Sylhet, Rajshahi, Khulna, Comilla, Barishal, Mymensingh, and everywhere else. You can match by city or talk to anyone nationwide.' },
  { q: 'Can I use AppleTalk on mobile?', a: 'Yes. AppleTalk works on any device with a browser and microphone — Android, iPhone, or desktop. You can also install it as a PWA (Progressive Web App) for an app-like experience from your home screen.' },
  { q: 'What is Premium on AppleTalk?', a: 'Premium users get benefits like priority matchmaking, gender filtering to match with a specific gender, and a verified badge in calls. Premium is optional — the core experience is always free.' },
  { q: 'Can I skip to a new person during a call?', a: 'Yes. Tap the Skip button at any time to end the current call and instantly join the queue for a new random match. No awkward goodbyes needed.' },
  { q: 'How do I report someone?', a: 'If someone is being inappropriate or abusive, tap the report button during the call. Our moderation team reviews all reports. Confirmed violations result in bans.' },
  { q: 'Is there a chat feature?', a: 'Yes. You can send text messages to your partner during an active voice call using the in-call chat panel. Friends can also message each other directly outside of calls.' },
  { q: 'What interests can I choose?', a: 'Current interests include: Music, Gaming, Anime, Books, Travel, English Practice, Blind Date, Make Friends, Tech, Fitness, Coding, and Movies. More are added regularly.' },
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
            Everything you need to know about AppleTalk — anonymous voice chat for Bangladesh.
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
