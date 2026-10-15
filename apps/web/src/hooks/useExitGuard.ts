import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Root pages — back button on these shows exit warning instead of going back
const ROOT_ROUTES = new Set(['/', '/match', '/friends', '/history', '/profile', '/premium', '/notifications']);

function detectPwa() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

// Sub-view blockers — registered by pages that have internal overlays (chat, profile panel, etc.)
// When back is pressed on a root page and a blocker exists, the blocker fires instead of the exit modal.
const exitGuardBlockers = new Set<() => void>();

export function registerExitGuardBlocker(handler: () => void): () => void {
  exitGuardBlockers.add(handler);
  return () => exitGuardBlockers.delete(handler);
}

export function useExitGuard() {
  const location = useLocation();
  const [showExitModal, setShowExitModal] = useState(false);
  const [isPwa] = useState(detectPwa);

  const isRootPage = ROOT_ROUTES.has(location.pathname);

  // Push a dummy state on mount so back button can be intercepted
  useEffect(() => {
    window.history.pushState({ __exitGuard: true }, '');
  }, []);

  useEffect(() => {
    function onPopState() {
      // PWA mode — let device handle navigation naturally, no modal
      if (isPwa) return;

      // If a sub-view (chat, profile panel) is open, let it handle the back press
      if (exitGuardBlockers.size > 0) {
        const [first] = exitGuardBlockers;
        first();
        return;
      }

      if (isRootPage) {
        // Push dummy state back so we stay in the app
        window.history.pushState({ __exitGuard: true }, '');
        setShowExitModal(true);
      }
      // Sub-pages: do nothing — browser handles back naturally
    }

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [isRootPage, isPwa]);

  function confirmExit() {
    // Go back twice — once past our dummy state, once past the app entry
    window.history.go(-2);
  }

  function cancelExit() {
    setShowExitModal(false);
  }

  return { showExitModal, isPwa, confirmExit, cancelExit };
}
