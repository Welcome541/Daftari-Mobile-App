import type { Lang, SecurityState } from '../types/daftari';

let AC: AudioContext | null = null;

export type FeedbackEvent =
  | 'tap'
  | 'select'
  | 'longPress'
  | 'pin'
  | 'debt'
  | 'pay'
  | 'success'
  | 'delete'
  | 'error'
  | 'recStart'
  | 'recStop';

const VIB_PATTERNS: Record<FeedbackEvent, number | number[]> = {
  tap: 8,
  select: [14, 24, 10],
  longPress: [18, 34, 24],
  pin: [12, 28, 16],
  debt: [36, 40, 52],
  pay: [20, 26, 44],
  success: [16, 28, 34],
  delete: [26, 36, 22],
  error: [36, 42, 36, 42, 52],
  recStart: [18, 34, 22],
  recStop: 15,
};

function getAudioCtx(): AudioContext | null {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!AC) AC = new Ctx();
    if (AC.state === 'suspended') {
      AC.resume().catch(() => {});
    }
    return AC;
  } catch {
    return null;
  }
}

function playNote(
  ctx: AudioContext,
  freq: number,
  startOffset: number,
  dur: number,
  vol: number,
  type: OscillatorType = 'sine',
  endFreq?: number
): void {
  const t0 = ctx.currentTime + startOffset;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), t0 + dur);
  }
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export function haptic(event: FeedbackEvent, sec?: Pick<SecurityState, 'vib'> | null): void {
  if (sec && !sec.vib) return;
  try {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(VIB_PATTERNS[event]);
    }
  } catch {
    // ignore
  }
}

export function playSound(event: FeedbackEvent, sec?: Pick<SecurityState, 'sound'> | null): void {
  if (sec && !sec.sound) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    switch (event) {
      case 'pay':
        playNote(ctx, 523.25, 0, 0.11, 0.055, 'sine');
        playNote(ctx, 659.25, 0.07, 0.12, 0.06, 'sine');
        playNote(ctx, 783.99, 0.14, 0.19, 0.065, 'sine');
        break;
      case 'debt':
        playNote(ctx, 587.33, 0, 0.11, 0.055, 'triangle');
        playNote(ctx, 440, 0.09, 0.16, 0.05, 'triangle');
        break;
      case 'success':
      case 'pin':
        playNote(ctx, 659.25, 0, 0.09, 0.045, 'sine');
        playNote(ctx, 880, 0.065, 0.14, 0.05, 'sine');
        break;
      case 'recStart':
        playNote(ctx, 640, 0, 0.09, 0.045, 'sine', 880);
        break;
      case 'recStop':
        playNote(ctx, 760, 0, 0.09, 0.04, 'sine', 520);
        break;
      case 'delete':
        playNote(ctx, 360, 0, 0.09, 0.045, 'triangle', 220);
        break;
      case 'error':
        playNote(ctx, 260, 0, 0.1, 0.055, 'triangle', 190);
        playNote(ctx, 210, 0.11, 0.14, 0.05, 'triangle', 165);
        break;
      case 'select':
      case 'longPress':
        playNote(ctx, 760, 0, 0.045, 0.025, 'sine', 860);
        break;
      case 'tap':
        playNote(ctx, 860, 0, 0.028, 0.016, 'sine', 640);
        break;
    }
  } catch {
    // ignore
  }
}

export function speak(txt: string, sec: SecurityState, lang: Lang): void {
  if (!sec.speak || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(txt);
    u.lang = lang === 'ar' ? 'ar-SA' : 'en-US';
    u.rate = 1.05;
    const vs = speechSynthesis.getVoices ? speechSynthesis.getVoices() : [];
    const v = vs.find((x) => x.lang && x.lang.slice(0, 2) === (lang === 'ar' ? 'ar' : 'en'));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch {
    // ignore
  }
}

export function feedback(kind: FeedbackEvent, sec: SecurityState): void {
  haptic(kind, sec);
  playSound(kind, sec);
}
