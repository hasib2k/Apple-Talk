const STORAGE_KEY = 'mango_device_id';
const DB_NAME = 'appletalk_db';
const DB_STORE = 'identity';
const COOKIE_NAME = 'at_did';
const COOKIE_DAYS = 365;

async function sha256(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null
      ?? canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
    if (!gl) return 'no-webgl';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return 'no-ext';
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
    const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) as string;
    return `${vendor}|${renderer}`;
  } catch {
    return 'webgl-error';
  }
}

// Cookie helpers — survives localStorage/IndexedDB clear in many scenarios
function setCookie(value: string): void {
  try {
    const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
    document.cookie = `${COOKIE_NAME}=${value};expires=${expires};path=/;SameSite=Lax`;
  } catch { /* ignore */ }
}

function getCookie(): string | null {
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]+)`));
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

async function saveToIndexedDB(id: string): Promise<void> {
  try {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(DB_STORE, 'readwrite');
        tx.objectStore(DB_STORE).put(id, STORAGE_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject();
      };
      req.onerror = () => reject();
    });
  } catch { /* ignore */ }
}

async function loadFromIndexedDB(): Promise<string | null> {
  try {
    return await new Promise<string | null>((resolve) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
      req.onsuccess = () => {
        const tx = req.result.transaction(DB_STORE, 'readonly');
        const getReq = tx.objectStore(DB_STORE).get(STORAGE_KEY);
        getReq.onsuccess = () => resolve((getReq.result as string) ?? null);
        getReq.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

function persist(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  setCookie(id);
  saveToIndexedDB(id);
}

async function computeHardwareFingerprint(): Promise<string> {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const components = [
    // Stable hardware signals — NOT randomizable by browser privacy settings
    nav.hardwareConcurrency.toString(),
    nav.deviceMemory?.toString() ?? 'unknown',
    nav.platform,
    screen.width + 'x' + screen.height,
    screen.colorDepth.toString(),
    window.devicePixelRatio.toString(),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    getWebGLFingerprint(), // GPU model — hardware level, stable on phones
  ].join('||');

  return sha256(components);
}

export async function getDeviceFingerprint(): Promise<string> {
  // 1. Try localStorage (fastest)
  const fromLS = localStorage.getItem(STORAGE_KEY);
  if (fromLS) { persist(fromLS); return fromLS; }

  // 2. Try cookie (survives localStorage clear)
  const fromCookie = getCookie();
  if (fromCookie) { persist(fromCookie); return fromCookie; }

  // 3. Try IndexedDB (survives localStorage clear)
  const fromDB = await loadFromIndexedDB();
  if (fromDB) { persist(fromDB); return fromDB; }

  // 4. Compute from hardware — same device always gives same result
  const id = await computeHardwareFingerprint();
  persist(id);
  return id;
}
