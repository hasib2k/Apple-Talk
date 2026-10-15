import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, Check, Crown, Copy, CopyCheck, Shield, Star, Users, Heart } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth.store';
import { useGoogleAuth } from '../hooks/useGoogleAuth';

type Plan = '7day' | '15day' | '30day';
type Method = 'bkash' | 'nagad';
type Step = 'plans' | 'payment' | 'success';

const BKASH_NUMBER = '01706776711';
const NAGAD_NUMBER = '01706776711';

const CARD_FEATURES = [
  'Filter partners by gender (F / M)',
  'See everyone\'s name & gender in feed',
  'Female users highlighted in pink',
  'Priority matching with premium users',
  'Crown & golden orb during calls',
];

const FULL_FEATURES = [
  { icon: <Users size={15} />, text: 'Filter partners by gender (Female / Male)' },
  { icon: <Heart size={15} />, text: 'Select your mood before matching' },
  { icon: <Star size={15} />, text: 'See everyone\'s real name & gender in the community feed' },
  { icon: <Zap size={15} />, text: 'Female users highlighted in pink — calls, friends & history' },
  { icon: <Crown size={15} />, text: 'Priority matching with other premium users' },
  { icon: <Crown size={15} />, text: 'Golden orb & crown shown to your partner during calls' },
  { icon: <Shield size={15} />, text: 'Add Friend button turns golden for your partner' },
  { icon: <Star size={15} />, text: 'Crown badge shown next to your name in friends & call history' },
];

function GoogleIconPremium() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.29-8.16 2.29-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function PremiumPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { linkGoogle } = useGoogleAuth();
  const [step, setStep] = useState<Step>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [method, setMethod] = useState<Method>('bkash');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMethod, setCopiedMethod] = useState<'bkash' | 'nagad' | null>(null);

  function copyNumber(m: 'bkash' | 'nagad') {
    const num = m === 'bkash' ? BKASH_NUMBER : NAGAD_NUMBER;
    navigator.clipboard.writeText(num).catch(() => {});
    setCopiedMethod(m);
    setTimeout(() => setCopiedMethod(null), 2000);
  }

  const PLAN_CONFIG: Record<Plan, { label: string; sub: string; days: string; price: number; period: string }> = {
    '7day':  { label: '7 Days',  sub: 'Quick Trial',   days: '7 days of full premium access',  price: 25,  period: '7 days' },
    '15day': { label: '15 Days', sub: 'Most Popular',  days: '15 days of full premium access', price: 50,  period: '15 days' },
    '30day': { label: '30 Days', sub: 'Best Value',    days: '30 days of full premium access', price: 100, period: '30 days' },
  };

  const amount = selectedPlan ? PLAN_CONFIG[selectedPlan].price : 0;

  function getActivePlan(): Plan | null {
    if (!user?.isPremium || !user?.premiumUntil) return null;
    const daysLeft = (new Date(user.premiumUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 0) return null;
    if (daysLeft <= 10) return '7day';
    if (daysLeft <= 20) return '15day';
    return '30day';
  }
  const activePlan = getActivePlan();

  function handleSelectPlan(plan: Plan) {
    setSelectedPlan(plan);
    setStep('payment');
    setError(null);
  }

  async function handleSubmit() {
    if (!transactionId.trim() || !selectedPlan) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/payments/request', {
        method,
        transactionId: transactionId.trim(),
        plan: selectedPlan,
      });
      setStep('success');
    } catch {
      setError('Failed to submit. Please check your transaction ID and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const PLANS: { id: Plan; accent: string; iconBg: string; cardBg: string; topBg: string; icon: React.ReactNode; badge?: string }[] = [
    {
      id: '7day',
      accent: '#06b6d4',
      iconBg: 'rgba(6,182,212,0.20)',
      cardBg: 'rgba(6,182,212,0.06)',
      topBg: 'linear-gradient(160deg, rgba(6,182,212,0.22) 0%, rgba(6,182,212,0.06) 100%)',
      icon: <Zap size={44} color="#06b6d4" />,
    },
    {
      id: '15day',
      accent: '#a78bfa',
      iconBg: 'rgba(167,139,250,0.22)',
      cardBg: 'rgba(167,139,250,0.08)',
      topBg: 'linear-gradient(160deg, rgba(167,139,250,0.28) 0%, rgba(167,139,250,0.08) 100%)',
      icon: <Star size={44} color="#a78bfa" />,
      badge: 'POPULAR',
    },
    {
      id: '30day',
      accent: '#f59e0b',
      iconBg: 'rgba(245,158,11,0.20)',
      cardBg: 'rgba(245,158,11,0.07)',
      topBg: 'linear-gradient(160deg, rgba(245,158,11,0.24) 0%, rgba(245,158,11,0.07) 100%)',
      icon: <Crown size={44} color="#f59e0b" />,
      badge: 'BEST VALUE',
    },
  ];

  return (
    <>
      <style>{`
        .premium-page {
          flex: 1;
          overflow-y: auto;
          overscroll-behavior-y: contain;
          font-family: 'Kanit', sans-serif;
        }

        .premium-hero {
          position: relative;
          padding: 40px 20px 28px;
          text-align: center;
        }

        .premium-crown-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(245,158,11,0.12);
          border: 1px solid rgba(245,158,11,0.30);
          border-radius: 99px;
          padding: 5px 14px;
          font-size: 12px;
          font-weight: 700;
          color: #f59e0b;
          margin-bottom: 14px;
        }

        .premium-title {
          font-size: clamp(28px, 6vw, 42px);
          font-weight: 900;
          color: #fff;
          margin: 0 0 8px;
          font-family: 'Oxanium', sans-serif;
          letter-spacing: -0.02em;
        }

        .premium-subtitle {
          font-size: 14px;
          color: rgba(255,255,255,0.45);
          margin: 0;
          line-height: 1.5;
        }

        .step-dots {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          margin-top: 16px;
        }
        .step-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.15);
          transition: all 0.2s;
        }
        .step-dot.active {
          width: 20px;
          border-radius: 3px;
          background: #f59e0b;
        }

        /* ── PLAN GRID ── */
        .plan-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 8px 16px 48px;
          max-width: 1140px;
          margin: 0 auto;
        }

        @media (min-width: 768px) {
          .plan-grid {
            padding: 8px 32px 60px;
          }
          .premium-hero {
            padding: 56px 32px 28px;
          }
        }

        @media (min-width: 1024px) {
          .plan-grid {
            flex-direction: row;
            align-items: stretch;
            gap: 20px;
            padding: 16px 40px 72px;
          }
          .plan-card-wrap {
            flex: 1;
            display: flex;
            flex-direction: column;
          }
          .plan-card-wrap.featured {
            flex: 1.05;
            transform: translateY(-18px);
            filter: drop-shadow(0 24px 48px rgba(0,0,0,0.5));
          }
        }

        .plan-card {
          border-radius: 24px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          flex: 1;
        }
        .plan-card:hover:not(.disabled) {
          transform: translateY(-3px);
        }
        .plan-card.disabled {
          cursor: default;
        }

        .plan-card-top {
          height: 150px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          position: relative;
          flex-shrink: 0;
        }

        @media (min-width: 1024px) {
          .plan-card-top {
            height: 180px;
          }
        }

        .plan-card-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.07em;
          padding: 4px 10px;
          border-radius: 99px;
        }

        .plan-card-active-badge {
          position: absolute;
          top: 12px;
          left: 12px;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.07em;
          padding: 4px 10px;
          border-radius: 99px;
          background: rgba(255,255,255,0.15);
          color: #fff;
        }

        .plan-card-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          flex: 1;
        }

        .plan-card-name {
          font-size: 20px;
          font-weight: 800;
          color: #fff;
          margin: 0;
          font-family: 'Oxanium', sans-serif;
        }

        .plan-card-sub {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin: 2px 0 0;
        }

        .plan-card-price {
          display: flex;
          align-items: baseline;
          gap: 3px;
          line-height: 1;
        }

        .plan-card-price-num {
          font-size: 48px;
          font-weight: 900;
          font-family: 'Oxanium', sans-serif;
          line-height: 1;
        }

        .plan-card-price-currency {
          font-size: 20px;
          font-weight: 700;
        }

        .plan-card-price-period {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          margin-left: 4px;
        }

        .plan-card-features {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .plan-card-feature {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          color: rgba(255,255,255,0.65);
          line-height: 1.4;
        }

        .plan-card-check {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .plan-buy-btn {
          width: 100%;
          border: none;
          border-radius: 14px;
          padding: 13px;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: opacity 0.2s;
          margin-top: auto;
        }
        .plan-buy-btn:hover { opacity: 0.88; }
        .plan-buy-btn.disabled-btn {
          opacity: 0.4;
          cursor: default;
        }

        /* ── PAYMENT ── */
        .payment-wrap {
          max-width: 900px;
          margin: 0 auto;
          padding: 12px 16px 48px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        @media (min-width: 768px) {
          .payment-wrap {
            padding: 12px 32px 56px;
          }
        }

        /* Plan summary bar */
        .pay-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-radius: 20px;
          padding: 18px 22px;
        }

        /* Two-col grid for Step1 + Step2 on desktop */
        .pay-grid {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (min-width: 900px) {
          .pay-grid {
            flex-direction: row;
            align-items: flex-start;
            gap: 20px;
          }
          .pay-col {
            flex: 1;
          }
        }

        .pay-card {
          background: rgba(255,255,255,0.04);
          border-radius: 22px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          height: 100%;
          box-sizing: border-box;
        }

        .pay-card-label {
          font-size: 10px;
          font-weight: 700;
          color: #6f9c81;
          text-transform: uppercase;
          letter-spacing: 0.12em;
        }

        /* Number rows */
        .pay-number-card {
          border-radius: 16px;
          padding: 16px 18px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .pay-copy-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 99px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          transition: opacity 0.18s;
          border: none;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pay-copy-btn:hover { opacity: 0.8; }

        /* Method selector */
        .pay-method-btn {
          flex: 1;
          padding: 18px 8px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          background: none;
        }

        /* TXN input */
        .pay-txn-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.10);
          border-radius: 14px;
          padding: 15px 16px;
          font-size: 15px;
          color: #fff;
          outline: none;
          font-family: 'Oxanium', sans-serif;
          box-sizing: border-box;
          transition: border-color 0.2s;
          letter-spacing: 0.04em;
        }
        .pay-txn-input:focus { border-color: rgba(245,158,11,0.55); box-shadow: 0 0 0 3px rgba(245,158,11,0.08); }
        .pay-txn-input::placeholder { color: rgba(255,255,255,0.22); font-family: 'Kanit', sans-serif; letter-spacing: normal; }

        /* Submit */
        .pay-submit-btn {
          width: 100%;
          border: none;
          border-radius: 16px;
          padding: 17px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
          cursor: pointer;
        }

        /* legacy for payment cards inner (used in feature strip) */
        .premium-card {
          background: rgba(255,255,255,0.04);
          border-radius: 20px;
          padding: 20px;
        }

        .mobile-features-list {
          display: block;
        }
        @media (min-width: 1024px) {
          .mobile-features-list {
            display: none;
          }
        }

        /* ── FEATURES STRIP (desktop, above cards) ── */
        .features-strip {
          display: none;
        }
        @media (min-width: 1024px) {
          .features-strip {
            display: flex;
            flex-wrap: wrap;
            gap: 8px 24px;
            justify-content: center;
            max-width: 900px;
            margin: 0 auto 8px;
            padding: 0 40px;
          }
          .feature-chip {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            color: rgba(255,255,255,0.45);
          }
          .feature-chip-dot {
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: #f59e0b;
            flex-shrink: 0;
          }
        }

        /* ── LOGIN GATE ── */
        .login-gate-wrap {
          max-width: 480px;
          margin: 0 auto;
          padding: 8px 24px 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          width: 100%;
        }

        @media (min-width: 900px) {
          .login-gate-wrap {
            max-width: 860px;
            padding: 12px 40px 48px;
            flex-direction: row;
            align-items: stretch;
            gap: 24px;
          }
          .login-gate-features {
            flex: 1;
            display: flex !important;
            flex-direction: column;
            gap: 14px;
          }
          .login-gate-card {
            width: 320px !important;
            flex-shrink: 0;
          }
        }
      `}</style>

      <div className="premium-page">

        {/* ── HERO ── */}
        <div className="premium-hero">
          <h1 className="premium-title">
            {step === 'success' ? 'You\'re all set! 🎉' : 'Unlock Premium'}
          </h1>
          <p className="premium-subtitle">
            {step === 'plans' && 'More control. Better matches. Stand out.'}
            {step === 'payment' && selectedPlan && `Pay ${PLAN_CONFIG[selectedPlan].price} ৳ via bKash or Nagad`}
            {step === 'success' && 'Admin will activate your plan within 24 hours.'}
          </p>

          {step !== 'success' && (
            <div className="step-dots">
              <div
                className={`step-dot ${step === 'plans' ? 'active' : ''}`}
                style={{ cursor: step === 'payment' ? 'pointer' : 'default' }}
                onClick={() => step === 'payment' && (setStep('plans'), setError(null))}
              />
              <div className={`step-dot ${step === 'payment' ? 'active' : ''}`} />
            </div>
          )}
        </div>

        {/* ── SUCCESS ── */}
        {step === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: '48px 24px' }}>
            <div style={{
              width: 96, height: 96, borderRadius: '50%',
              background: 'rgba(245,158,11,0.12)',
              border: '2px solid rgba(245,158,11,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(245,158,11,0.15)',
            }}>
              <Check size={40} color="#f59e0b" />
            </div>
            <div style={{ textAlign: 'center', maxWidth: 320 }}>
              <p style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 10px' }}>Payment Submitted!</p>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.65, margin: 0 }}>
                Your payment is under review. Admin will activate your Premium subscription within 24 hours.
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: 'linear-gradient(150deg,#fde68a,#f59e0b)',
                border: 'none', borderRadius: 99, padding: '13px 48px',
                fontSize: 15, fontWeight: 700, color: '#1a2e05',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              Back to App
            </button>
          </div>
        )}

        {/* ── LOGIN GATE (shown when not linked) ── */}
        {!user?.isLinked && step === 'plans' && (
          <div className="login-gate-wrap">

            {/* Left — feature list (hidden on mobile) */}
            <div className="login-gate-features" style={{ display: 'none' }}>
              <div style={{ marginBottom: 4 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6f9c81', textTransform: 'uppercase', letterSpacing: '0.12em', margin: '0 0 6px' }}>
                  What you unlock
                </p>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Oxanium, sans-serif', lineHeight: 1.2 }}>
                  Premium features,<br />your data stays safe.
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                {FULL_FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: 9,
                      background: 'rgba(245,158,11,0.12)',
                      border: '1px solid rgba(245,158,11,0.20)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, color: '#f59e0b',
                    }}>
                      {f.icon}
                    </div>
                    <span style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, paddingTop: 6 }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.2)', marginTop: 4 }}>
                Activated manually by admin within 24 hours
              </p>
            </div>

            {/* Right — login card */}
            <div className="login-gate-card" style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 0 }}>
              <div style={{
                background: 'linear-gradient(160deg, rgba(245,158,11,0.10) 0%, rgba(245,158,11,0.04) 100%)',
                border: '1px solid rgba(245,158,11,0.20)',
                borderRadius: 22,
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                height: '100%',
                boxSizing: 'border-box',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 17, fontWeight: 800, color: '#fff', margin: '0 0 5px', fontFamily: 'Oxanium, sans-serif' }}>
                      Sign in to unlock Premium
                    </p>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
                      Your existing alias and data will be merged into your Google account — nothing is lost.
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: 'rgba(255,255,255,0.07)' }} />

                {/* Perks (mobile only — quick 3 chips) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    'Filter partners by gender',
                    'Priority matching with premium users',
                    'Golden crown during calls',
                  ].map((t, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Check size={9} color="#f59e0b" strokeWidth={3} />
                      </div>
                      <span style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)' }}>{t}</span>
                    </div>
                  ))}
                </div>

                {/* Google button */}
                <button
                  onClick={() => linkGoogle('/premium')}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 10, width: '100%',
                    background: '#fff',
                    border: 'none', borderRadius: 14,
                    padding: '14px 20px',
                    fontSize: 15, fontWeight: 700,
                    color: '#1a1a1a', cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
                    marginTop: 'auto',
                  }}
                >
                  <GoogleIconPremium />
                  Continue with Google
                </button>

                <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.2)', margin: 0 }}>
                  Free to sign in · No credit card required
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ── PLANS ── */}
        {step === 'plans' && (
          <>

            <div className="plan-grid">
              {PLANS.map(({ id, accent, iconBg, cardBg, topBg, icon, badge }) => {
                const cfg = PLAN_CONFIG[id];
                const isActive = activePlan === id;
                const isFeatured = id === '15day';
                const canSelect = !user?.isPremium && (user?.isLinked ?? false);

                return (
                  <div
                    key={id}
                    className={`plan-card-wrap${isFeatured ? ' featured' : ''}`}
                  >
                    <div
                      className={`plan-card${!canSelect ? ' disabled' : ''}`}
                      style={{ background: cardBg }}
                      onClick={() => canSelect && handleSelectPlan(id)}
                    >
                      {/* Top visual area */}
                      <div className="plan-card-top" style={{ background: topBg }}>
                        {/* Icon circle */}
                        <div style={{
                          width: 72, height: 72, borderRadius: '50%',
                          background: iconBg,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: 'none',
                        }}>
                          {icon}
                        </div>

                        {/* Plan badge (top-right) */}
                        {!isActive && badge && !user?.isPremium && (
                          <span
                            className="plan-card-badge"
                            style={{ background: accent, color: id === '7day' ? '#021a1f' : id === '15day' ? '#1a0a3e' : '#1a2e05' }}
                          >
                            {badge}
                          </span>
                        )}

                        {/* Active badge */}
                        {isActive && (
                          <span className="plan-card-active-badge">ACTIVE</span>
                        )}
                      </div>

                      {/* Card body */}
                      <div className="plan-card-body">
                        {/* Plan name */}
                        <div>
                          <p className="plan-card-name">{cfg.label}</p>
                          <p className="plan-card-sub" style={{ color: accent }}>{cfg.sub}</p>
                        </div>

                        {/* Price */}
                        <div className="plan-card-price">
                          <span className="plan-card-price-num" style={{ color: accent }}>{cfg.price}</span>
                          <span className="plan-card-price-currency" style={{ color: accent }}>৳</span>
                          <span className="plan-card-price-period">/ {cfg.period}</span>
                        </div>

                        {/* Feature list */}
                        <div className="plan-card-features">
                          {CARD_FEATURES.map((feat, i) => (
                            <div key={i} className="plan-card-feature">
                              <div className="plan-card-check" style={{ background: `${accent}22` }}>
                                <Check size={10} color={accent} strokeWidth={3} />
                              </div>
                              {feat}
                            </div>
                          ))}
                        </div>

                        {/* Buy button */}
                        <button
                          className={`plan-buy-btn${!canSelect ? ' disabled-btn' : ''}`}
                          style={{
                            background: canSelect
                              ? id === '7day'
                                ? 'linear-gradient(135deg,#06b6d4,#0891b2)'
                                : id === '15day'
                                  ? 'linear-gradient(135deg,#a78bfa,#7c3aed)'
                                  : 'linear-gradient(135deg,#fde68a,#f59e0b)'
                              : 'rgba(255,255,255,0.08)',
                            color: canSelect ? (id === '30day' ? '#1a2e05' : '#fff') : 'rgba(255,255,255,0.3)',
                          }}
                          onClick={e => { e.stopPropagation(); canSelect && handleSelectPlan(id); }}
                        >
                          {isActive ? 'Currently Active' : canSelect ? 'Get Started' : user?.isPremium ? 'Already Premium' : 'Login Required'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mobile feature list — hidden on desktop */}
            <div className="mobile-features-list" style={{ padding: '0 16px 40px', maxWidth: 560, margin: '0 auto' }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: '#6f9c81', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 14 }}>
                All plans include
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {FULL_FEATURES.map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ color: '#f59e0b', flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{f.text}</span>
                  </div>
                ))}
              </div>
              <p style={{ textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.20)', marginTop: 16 }}>
                Activated manually by admin within 24 hours
              </p>
            </div>
          </>
        )}

        {/* ── PAYMENT ── */}
        {step === 'payment' && selectedPlan && (() => {
          const planAccent = selectedPlan === '7day' ? '#06b6d4' : selectedPlan === '15day' ? '#a78bfa' : '#f59e0b';
          const planAccentBg = selectedPlan === '7day' ? 'rgba(6,182,212,0.10)' : selectedPlan === '15day' ? 'rgba(167,139,250,0.10)' : 'rgba(245,158,11,0.10)';
          const planIcon = selectedPlan === '30day' ? <Crown size={20} color={planAccent} /> : selectedPlan === '15day' ? <Star size={20} color={planAccent} /> : <Zap size={20} color={planAccent} />;

          return (
            <div className="payment-wrap">

              {/* ── Back button ── */}
              <button
                onClick={() => { setStep('plans'); setError(null); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 99, padding: '8px 16px',
                  fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  alignSelf: 'flex-start',
                  transition: 'all 0.18s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.09)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.55)'; }}
              >
                ← Change Plan
              </button>

              {/* ── Plan summary bar ── */}
              <div className="pay-summary" style={{ background: planAccentBg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: `${planAccent}20`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {planIcon}
                  </div>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Oxanium, sans-serif' }}>
                      {PLAN_CONFIG[selectedPlan].label} Plan
                    </p>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
                      {PLAN_CONFIG[selectedPlan].days}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ fontSize: 32, fontWeight: 900, color: planAccent, fontFamily: 'Oxanium, sans-serif', lineHeight: 1 }}>
                    {amount}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: planAccent }}> ৳</span>
                </div>
              </div>

              {/* ── Two-column grid ── */}
              <div className="pay-grid">

                {/* Step 1 — Send Payment */}
                <div className="pay-col">
                  <div className="pay-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(163,230,53,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: '#a3e635', flexShrink: 0,
                      }}>1</div>
                      <span className="pay-card-label">Send Payment</span>
                    </div>

                    <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: 0 }}>
                      Send <strong style={{ color: planAccent }}>{amount} Taka</strong> to either number below using bKash or Nagad.
                    </p>

                    {/* bKash */}
                    <div className="pay-number-card" style={{ background: 'rgba(226,19,110,0.08)', border: '1px solid rgba(226,19,110,0.20)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: 'rgba(226,19,110,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <img src="/bkash.svg" alt="bKash" style={{ height: 22 }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: '#E2136E', fontWeight: 700, margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>bKash</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Oxanium, sans-serif', letterSpacing: '0.04em' }}>{BKASH_NUMBER}</p>
                        </div>
                      </div>
                      <button
                        className="pay-copy-btn"
                        onClick={() => copyNumber('bkash')}
                        style={{
                          background: copiedMethod === 'bkash' ? 'rgba(74,222,128,0.15)' : 'rgba(226,19,110,0.15)',
                          color: copiedMethod === 'bkash' ? '#4ade80' : '#E2136E',
                        }}
                      >
                        {copiedMethod === 'bkash' ? <CopyCheck size={13} /> : <Copy size={13} />}
                        {copiedMethod === 'bkash' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    {/* Nagad */}
                    <div className="pay-number-card" style={{ background: 'rgba(241,91,37,0.08)', border: '1px solid rgba(241,91,37,0.20)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 40, height: 40, borderRadius: 10,
                          background: 'rgba(241,91,37,0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <img src="/nagad.svg" alt="Nagad" style={{ height: 22 }} />
                        </div>
                        <div>
                          <p style={{ fontSize: 10, color: '#F15B25', fontWeight: 700, margin: 0, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Nagad</p>
                          <p style={{ fontSize: 16, fontWeight: 800, color: '#fff', margin: 0, fontFamily: 'Oxanium, sans-serif', letterSpacing: '0.04em' }}>{NAGAD_NUMBER}</p>
                        </div>
                      </div>
                      <button
                        className="pay-copy-btn"
                        onClick={() => copyNumber('nagad')}
                        style={{
                          background: copiedMethod === 'nagad' ? 'rgba(74,222,128,0.15)' : 'rgba(241,91,37,0.15)',
                          color: copiedMethod === 'nagad' ? '#4ade80' : '#F15B25',
                        }}
                      >
                        {copiedMethod === 'nagad' ? <CopyCheck size={13} /> : <Copy size={13} />}
                        {copiedMethod === 'nagad' ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Step 2 — Transaction ID */}
                <div className="pay-col">
                  <div className="pay-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(163,230,53,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, color: '#a3e635', flexShrink: 0,
                      }}>2</div>
                      <span className="pay-card-label">Submit Transaction ID</span>
                    </div>

                    {/* Method selector */}
                    <div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>Which method did you use?</p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        {(['bkash', 'nagad'] as Method[]).map(m => {
                          const mColor = m === 'bkash' ? '#E2136E' : '#F15B25';
                          const mBg = m === 'bkash' ? 'rgba(226,19,110,0.12)' : 'rgba(241,91,37,0.12)';
                          const isSelected = method === m;
                          return (
                            <button
                              key={m}
                              className="pay-method-btn"
                              onClick={() => setMethod(m)}
                              style={{
                                border: `2px solid ${isSelected ? mColor : 'rgba(255,255,255,0.08)'}`,
                                background: isSelected ? mBg : 'rgba(255,255,255,0.03)',
                                boxShadow: isSelected ? `0 0 16px ${mColor}22` : 'none',
                              }}
                            >
                              <img src={`/${m}.svg`} alt={m} style={{ height: 28 }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* TXN input */}
                    <div>
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>Transaction ID</p>
                      <input
                        className="pay-txn-input"
                        type="text"
                        value={transactionId}
                        onChange={e => setTransactionId(e.target.value)}
                        placeholder="e.g. 8N3K7A2XQW"
                      />
                      <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.22)', marginTop: 8, lineHeight: 1.5 }}>
                        Found in your {method === 'bkash' ? 'bKash' : 'Nagad'} payment confirmation SMS.
                      </p>
                    </div>

                    {error && (
                      <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#f87171' }}>
                        {error}
                      </div>
                    )}

                    <button
                      className="pay-submit-btn"
                      onClick={handleSubmit}
                      disabled={!transactionId.trim() || submitting}
                      style={{
                        background: !transactionId.trim() || submitting
                          ? 'rgba(255,255,255,0.07)'
                          : `linear-gradient(135deg, ${planAccent}dd, ${planAccent})`,
                        color: !transactionId.trim() || submitting ? 'rgba(255,255,255,0.25)' : (selectedPlan === '30day' ? '#1a2e05' : '#fff'),
                        cursor: !transactionId.trim() || submitting ? 'not-allowed' : 'pointer',
                        marginTop: 'auto',
                      }}
                    >
                      {submitting ? 'Submitting...' : <><Zap size={16} /> Submit Payment</>}
                    </button>
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

      </div>
    </>
  );
}
