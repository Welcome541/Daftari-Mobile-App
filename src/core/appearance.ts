const UI_KEY = 'dafter_v3_ui';

export const SCALES = [
  { v: 0.9, k: 'uiScaleS' },
  { v: 1.0, k: 'uiScaleM' },
  { v: 1.15, k: 'uiScaleL' },
  { v: 1.3, k: 'uiScaleXL' },
];

export const DENSITIES = [
  { v: 0.9, k: 'uiDensityC' },
  { v: 1.0, k: 'uiDensityN' },
  { v: 1.1, k: 'uiDensityR' },
];

export function clampScale(v: unknown): number {
  const n = parseFloat(String(v));
  if (!isFinite(n)) return 1;
  return Math.min(1.4, Math.max(0.85, Math.round(n * 100) / 100));
}

export function clampDensity(v: unknown): number {
  const n = parseFloat(String(v));
  if (!isFinite(n)) return 1;
  return Math.min(1.12, Math.max(0.88, Math.round(n * 100) / 100));
}

export function loadAppearance(): { scale: number; density: number } {
  let raw: any = null;
  try {
    raw = JSON.parse(localStorage.getItem(UI_KEY) || 'null');
  } catch {
    raw = null;
  }
  raw = raw || {};
  return {
    scale: clampScale(raw.scale),
    density: clampDensity(raw.density),
  };
}

export function saveAppearance(scale: number, density: number): void {
  try {
    localStorage.setItem(UI_KEY, JSON.stringify({ scale, density }));
  } catch {
    // ignore
  }
}

export function measureShellU(): void {
  const root = document.documentElement;
  if (!root) return;
  const shell = document.getElementById('phone');
  const w = shell && shell.clientWidth ? shell.clientWidth : window.innerWidth || 0;
  if (!w) return;
  root.style.setProperty('--u', w / 1080 + 'px');
}

export function applyAppearance(scale: number, density: number): void {
  const root = document.documentElement;
  if (!root) return;
  root.style.setProperty('--s', String(scale));
  root.style.setProperty('--density', String(density));
  measureShellU();
}
