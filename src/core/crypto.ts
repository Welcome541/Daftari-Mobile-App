import type { EncryptedPack, SecurityState } from '../types/daftari';

export const PLAIN_KEY = 'dafter_v3';
export const SEC_KEY = 'dafter_v3_sec';
export const ENC_KEY = 'dafter_v3_enc';

const te = new TextEncoder();
const td = new TextDecoder();

export const uid = (): string => Math.random().toString(36).slice(2, 9);

export function defaultSecState(): SecurityState {
  return {
    enabled: false,
    salt: '',
    pinHash: '',
    autoMin: 2,
    sound: true,
    vib: true,
    credId: null,
    fpWrap: null,
    fps: [],
    dark: false,
    speak: false,
    vosk: false,
    btName: '',
  };
}

export function loadSecState(): SecurityState {
  const sec = defaultSecState();
  try {
    const raw = JSON.parse(localStorage.getItem(SEC_KEY) || 'null');
    if (raw && typeof raw === 'object') Object.assign(sec, raw);
  } catch {
    // ignore
  }
  if (!sec.fps) sec.fps = [];
  if (sec.credId && sec.fpWrap && !sec.fps.length) {
    sec.fps = [{ id: sec.credId, wrap: sec.fpWrap }];
  }
  return sec;
}

export function saveSecState(sec: SecurityState): void {
  try {
    localStorage.setItem(SEC_KEY, JSON.stringify(sec));
  } catch {
    // ignore
  }
}

export async function sha256hex(s: string): Promise<string> {
  try {
    if (crypto && crypto.subtle) {
      const b = await crypto.subtle.digest('SHA-256', te.encode(s));
      return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // fallback below
  }
  let out = '';
  for (let r = 0; r < 4; r++) {
    let h = (0x811c9dc5 ^ (r * 0x9e3779b9)) >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    out += h.toString(16).padStart(8, '0');
  }
  return out;
}

export async function deriveKey(pin: string, salt: string): Promise<CryptoKey> {
  const km = await crypto.subtle.importKey('raw', te.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: te.encode(salt), iterations: 100000, hash: 'SHA-256' },
    km,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function newMaster(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function wrapKey(mk: CryptoKey, withKey: CryptoKey): Promise<EncryptedPack> {
  const raw = await crypto.subtle.exportKey('raw', mk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, withKey, raw);
  return { iv: [...iv], ct: [...new Uint8Array(ct)] };
}

export async function unwrapKey(pack: EncryptedPack, withKey: CryptoKey): Promise<CryptoKey | null> {
  try {
    const raw = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(pack.iv) },
      withKey,
      new Uint8Array(pack.ct)
    );
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

export async function encJSON(obj: unknown, key: CryptoKey): Promise<EncryptedPack> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    te.encode(JSON.stringify(obj))
  );
  return { iv: [...iv], ct: [...new Uint8Array(ct)] };
}

export async function decJSON<T = any>(pack: EncryptedPack, key: CryptoKey): Promise<T | null> {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(pack.iv) },
      key,
      new Uint8Array(pack.ct)
    );
    return JSON.parse(td.decode(pt)) as T;
  } catch {
    return null;
  }
}
