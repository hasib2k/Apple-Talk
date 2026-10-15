import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';

const BG = {
  background:
    'radial-gradient(120% 70% at 50% -8%, rgba(163,230,53,0.20), transparent 55%),' +
    'radial-gradient(90% 60% at 88% 22%, rgba(16,185,129,0.13), transparent 60%),' +
    'linear-gradient(180deg,#0a2013,#05140d 60%,#030f09)',
};

const BORDER = '1px solid rgba(255,255,255,0.07)';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#f4fbe9', marginBottom: 12 }}>{title}</h2>
      <div style={{ fontSize: 14, color: '#7aaa8e', lineHeight: 1.8 }}>{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  const navigate = useNavigate();

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

      <main style={{ maxWidth: 760, margin: '0 auto', width: '100%', padding: '96px 24px 80px' }}>
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#6f9c81', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Legal</p>
          <h1 style={{ fontSize: 'clamp(28px,5vw,44px)', fontWeight: 900, color: '#f4fbe9', letterSpacing: '-0.03em', marginBottom: 12 }}>
            Privacy Policy
          </h1>
          <p style={{ fontSize: 13, color: '#6f9c81' }}>Last updated: July 2026 · Effective immediately</p>
        </div>

        <p style={{ fontSize: 15, color: '#9dbfaa', lineHeight: 1.8, marginBottom: 40 }}>
          AppleTalk is built around privacy. We collect the minimum data necessary to operate the service. This policy explains what we collect, why, and how it is protected.
        </p>

        <Section title="1. What We Collect">
          <p><strong style={{ color: '#c5dfc8' }}>Anonymous session data:</strong> A device fingerprint hash used to restore your anonymous session across page reloads. This is not linked to your identity.</p>
          <br />
          <p><strong style={{ color: '#c5dfc8' }}>Google account data (optional):</strong> If you sign in with Google, we receive your Google ID, display name, email, and profile picture. This is stored to identify your account across sessions.</p>
          <br />
          <p><strong style={{ color: '#c5dfc8' }}>Preferences:</strong> Your selected gender, region, and interests — stored to improve matchmaking.</p>
          <br />
          <p><strong style={{ color: '#c5dfc8' }}>Friend messages:</strong> Text messages sent between friends are stored in our database so both parties can view message history.</p>
          <br />
          <p><strong style={{ color: '#c5dfc8' }}>Call metadata:</strong> We log the fact that a call occurred (timestamp, duration, alias) for your call history. We do not record audio.</p>
        </Section>

        <Section title="2. What We Do NOT Collect">
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>We do <strong style={{ color: '#c5dfc8' }}>not</strong> record, store, or transmit your voice calls. All audio is peer-to-peer via WebRTC.</li>
            <li>We do <strong style={{ color: '#c5dfc8' }}>not</strong> access your camera — AppleTalk is voice-only by design.</li>
            <li>We do <strong style={{ color: '#c5dfc8' }}>not</strong> sell, rent, or share your data with any third party for advertising or commercial purposes.</li>
            <li>We do <strong style={{ color: '#c5dfc8' }}>not</strong> use tracking cookies or third-party analytics on authenticated pages.</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Data">
          <p>Data is used solely to operate AppleTalk: to restore your session, match you with other users, power the friend system, and provide call history. We do not use your data to build advertising profiles or sell to data brokers.</p>
        </Section>

        <Section title="4. Data Storage & Security">
          <p>All data is stored in a secured database. Access tokens are short-lived (15 minutes). Refresh tokens are stored in localStorage and can be revoked by logging out. We use industry-standard encryption for data in transit (HTTPS/WSS) and at rest.</p>
        </Section>

        <Section title="5. Push Notifications">
          <p>If you grant notification permission, we store a push subscription token to send you alerts (e.g., friend requests, messages). You can revoke this at any time from your browser settings.</p>
        </Section>

        <Section title="6. Your Rights">
          <p>You may request deletion of your account and all associated data at any time. Anonymous accounts (no Google login) automatically expire after 90 days of inactivity. Google-linked accounts persist until deleted.</p>
        </Section>

        <Section title="7. Children">
          <p>AppleTalk is not intended for users under 13. We do not knowingly collect data from children. If you believe a child has used the service, contact us for immediate deletion.</p>
        </Section>

        <Section title="8. Changes to This Policy">
          <p>We may update this policy as the service evolves. Continued use of AppleTalk after changes constitutes acceptance of the updated policy. The date at the top of this page always reflects the latest revision.</p>
        </Section>

        <div style={{ marginTop: 48, padding: '24px 28px', background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.12)', borderRadius: 20 }}>
          <p style={{ fontSize: 14, color: '#9dbfaa', lineHeight: 1.7 }}>
            <strong style={{ color: '#f4fbe9' }}>Questions?</strong> If you have any questions about this privacy policy or how your data is handled, you can reach us via the app's feedback channels.
          </p>
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
