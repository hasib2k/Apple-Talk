import React, { useEffect, useState } from 'react';

interface IABInfo {
  detected: boolean;
  name: string;
  isAndroid: boolean;
  isIOS: boolean;
}

function detect(): IABInfo {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  const checks: [RegExp, string][] = [
    [/FBAN|FBAV|FB_IAB|FB4A|FBBV|FBIOS/i, 'Facebook'],
    [/Instagram/i, 'Instagram'],
    [/WhatsApp/i, 'WhatsApp'],
    [/Twitter/i, 'Twitter / X'],
    [/LinkedInApp/i, 'LinkedIn'],
    [/musical_ly|TikTok/i, 'TikTok'],
    [/Snapchat/i, 'Snapchat'],
    [/Line\//i, 'Line'],
    [/Telegram/i, 'Telegram'],
  ];

  for (const [re, name] of checks) {
    if (re.test(ua)) return { detected: true, name, isAndroid, isIOS };
  }
  return { detected: false, name: '', isAndroid, isIOS };
}

function buildIntentUrl(): string {
  const url = window.location.href;
  const host = window.location.host;
  const path = window.location.pathname + window.location.search;
  return `intent://${host}${path}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function InAppBrowserOverlay() {
  const [iab, setIab] = useState<IABInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const result = detect();
    if (result.detected) setIab(result);
  }, []);

  if (!iab) return null;

  const currentUrl = window.location.href;

  function handleCopy() {
    navigator.clipboard.writeText(currentUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <style>{`
        .iab-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: #05140d;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          font-family: 'Kanit', sans-serif;
        }
        .iab-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(163,230,53,0.15);
          border-radius: 24px;
          padding: 36px 28px;
          max-width: 400px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0;
        }
        .iab-logo {
          width: 72px;
          height: 72px;
          object-fit: contain;
          margin-bottom: 20px;
        }
        .iab-badge {
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.3);
          color: #fca5a5;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 4px 12px;
          border-radius: 999px;
          margin-bottom: 16px;
        }
        .iab-title {
          color: #ffffff;
          font-size: 20px;
          font-weight: 700;
          text-align: center;
          margin-bottom: 10px;
          line-height: 1.3;
        }
        .iab-subtitle {
          color: rgba(255,255,255,0.45);
          font-size: 13px;
          text-align: center;
          line-height: 1.6;
          margin-bottom: 28px;
        }
        .iab-divider {
          width: 100%;
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin-bottom: 24px;
        }
        .iab-chrome-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          width: 100%;
          background: #a3e635;
          color: #05140d;
          font-weight: 700;
          font-size: 15px;
          border: none;
          border-radius: 14px;
          padding: 14px 20px;
          cursor: pointer;
          text-decoration: none;
          transition: opacity 0.2s;
          margin-bottom: 16px;
        }
        .iab-chrome-btn:hover { opacity: 0.9; }
        .iab-steps {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 24px;
        }
        .iab-step {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .iab-step-num {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: rgba(163,230,53,0.15);
          border: 1px solid rgba(163,230,53,0.3);
          color: #a3e635;
          font-size: 12px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .iab-step-text {
          color: rgba(255,255,255,0.7);
          font-size: 13px;
          line-height: 1.5;
        }
        .iab-step-text strong {
          color: #ffffff;
        }
        .iab-or {
          color: rgba(255,255,255,0.25);
          font-size: 12px;
          margin-bottom: 14px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .iab-url-row {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .iab-url-text {
          flex: 1;
          color: rgba(255,255,255,0.4);
          font-size: 11px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .iab-copy-btn {
          background: none;
          border: none;
          color: #a3e635;
          cursor: pointer;
          padding: 2px;
          display: flex;
          align-items: center;
          flex-shrink: 0;
          transition: opacity 0.2s;
        }
        .iab-copy-btn:hover { opacity: 0.7; }
        .iab-hint {
          color: rgba(255,255,255,0.25);
          font-size: 11px;
          text-align: center;
          margin-top: 16px;
          line-height: 1.5;
        }
      `}</style>

      <div className="iab-overlay">
        <div className="iab-card">
          <img src="/logo.png" alt="AppleTalk" className="iab-logo" />

          <div className="iab-badge">In-App Browser Detected</div>

          <div className="iab-title">
            Open in your device browser
          </div>

          <div className="iab-subtitle">
            You're viewing this in <strong style={{ color: '#fff' }}>{iab.name}</strong>'s built-in browser.
            For security and a proper experience, please open AppleTalk in Chrome or Safari.
          </div>

          <div className="iab-divider" />

          {iab.isAndroid && (
            <>
              <a href={buildIntentUrl()} className="iab-chrome-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="4" fill="currentColor" />
                  <line x1="2" y1="12" x2="8" y2="12" stroke="currentColor" strokeWidth="1.5" />
                  <line x1="16" y1="12" x2="22" y2="12" stroke="currentColor" strokeWidth="1.5" />
                </svg>
                Open in Chrome
              </a>

              <div className="iab-or">or follow these steps</div>

              <div className="iab-steps">
                <div className="iab-step">
                  <div className="iab-step-num">1</div>
                  <div className="iab-step-text">
                    Tap the <strong>⋮ three-dot menu</strong> or <strong>Share icon</strong> at the top of the screen
                  </div>
                </div>
                <div className="iab-step">
                  <div className="iab-step-num">2</div>
                  <div className="iab-step-text">
                    Select <strong>"Open in Chrome"</strong> or <strong>"Open in browser"</strong>
                  </div>
                </div>
              </div>
            </>
          )}

          {iab.isIOS && (
            <>
              <div className="iab-steps">
                <div className="iab-step">
                  <div className="iab-step-num">1</div>
                  <div className="iab-step-text">
                    Tap the <strong>⋯ more</strong> or <strong>Share (↑) icon</strong> at the bottom or top of the screen
                  </div>
                </div>
                <div className="iab-step">
                  <div className="iab-step-num">2</div>
                  <div className="iab-step-text">
                    Choose <strong>"Open in Safari"</strong> or <strong>"Open in Browser"</strong>
                  </div>
                </div>
              </div>
            </>
          )}

          {!iab.isAndroid && !iab.isIOS && (
            <div className="iab-steps">
              <div className="iab-step">
                <div className="iab-step-num">1</div>
                <div className="iab-step-text">
                  Look for the <strong>⋮ menu</strong> or <strong>Share icon</strong> in the browser bar
                </div>
              </div>
              <div className="iab-step">
                <div className="iab-step-num">2</div>
                <div className="iab-step-text">
                  Select <strong>"Open in Browser"</strong> or <strong>"Open in Chrome / Safari"</strong>
                </div>
              </div>
            </div>
          )}

          <div className="iab-or">or copy the link manually</div>

          <div className="iab-url-row">
            <span className="iab-url-text">{currentUrl}</span>
            <button className="iab-copy-btn" onClick={handleCopy} title="Copy URL">
              {copied ? <CheckIcon /> : <CopyIcon />}
            </button>
          </div>

          <div className="iab-hint">
            Paste the link in Chrome or Safari's address bar
          </div>
        </div>
      </div>
    </>
  );
}
