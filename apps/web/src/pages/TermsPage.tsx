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

export default function TermsPage() {
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
            Terms of Service
          </h1>
          <p style={{ fontSize: 13, color: '#6f9c81' }}>Last updated: July 2026 · Effective immediately</p>
        </div>

        <p style={{ fontSize: 15, color: '#9dbfaa', lineHeight: 1.8, marginBottom: 40 }}>
          By accessing or using AppleTalk ("the Service"), you agree to these Terms of Service. Please read them carefully. If you do not agree, do not use the Service.
        </p>

        <Section title="1. Acceptance of Terms">
          <p>These terms constitute a binding agreement between you and AppleTalk. By using the Service — including creating an account, making a call, or browsing the website — you accept these terms in full.</p>
        </Section>

        <Section title="2. Eligibility">
          <p>You must be at least 13 years old to use AppleTalk. By using the Service you confirm that you meet this requirement. Users under 18 should use the Service only with parental knowledge and consent.</p>
        </Section>

        <Section title="3. Acceptable Use">
          <p>You agree not to use AppleTalk to:</p>
          <ul style={{ paddingLeft: 20, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li>Harass, threaten, or harm any other user</li>
            <li>Share explicit, sexual, or pornographic content</li>
            <li>Engage in hate speech based on race, religion, gender, or other protected characteristics</li>
            <li>Attempt to identify or dox any anonymous user</li>
            <li>Use the service for spam, scams, or solicitation</li>
            <li>Violate any applicable law or regulation</li>
            <li>Attempt to reverse-engineer, scrape, or abuse the platform's systems</li>
          </ul>
        </Section>

        <Section title="4. Anonymous Identity">
          <p>AppleTalk assigns you a randomly generated alias. You must not attempt to identify yourself or others beyond what the platform provides. Sharing personal contact information (real names, phone numbers, social media handles) is done at your own risk and is not encouraged.</p>
        </Section>

        <Section title="5. Content & Calls">
          <p>All voice calls are peer-to-peer and not recorded by AppleTalk. However, you are solely responsible for what you say during calls. AppleTalk is not liable for content exchanged between users. You must not record calls without the explicit consent of all participants.</p>
        </Section>

        <Section title="6. Moderation & Bans">
          <p>We reserve the right to suspend or permanently ban any account that violates these terms. Bans may be issued based on user reports, automated detection, or manual review. Ban decisions are final. Users may submit an appeal via our feedback channel.</p>
        </Section>

        <Section title="7. Intellectual Property">
          <p>All code, design, branding, and content on AppleTalk is owned by the AppleTalk team. You may not copy, reproduce, or redistribute any part of the platform without written permission.</p>
        </Section>

        <Section title="8. Disclaimers">
          <p>AppleTalk is provided "as is" without warranties of any kind. We do not guarantee uninterrupted service, match quality, or the behavior of other users. Use the Service at your own risk.</p>
        </Section>

        <Section title="9. Limitation of Liability">
          <p>To the fullest extent permitted by law, AppleTalk shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the Service, including but not limited to content exchanged during calls or interactions between users.</p>
        </Section>

        <Section title="10. Changes to Terms">
          <p>We may update these terms at any time. Continued use of the Service after changes are posted constitutes acceptance of the new terms. The date at the top of this page reflects the latest revision.</p>
        </Section>

        <div style={{ marginTop: 48, padding: '24px 28px', background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.12)', borderRadius: 20 }}>
          <p style={{ fontSize: 14, color: '#9dbfaa', lineHeight: 1.7 }}>
            <strong style={{ color: '#f4fbe9' }}>Questions about these terms?</strong> Reach out via the app's feedback channels. We are happy to clarify anything.
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
