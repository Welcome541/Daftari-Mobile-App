const _LL: Record<string, Promise<void> | undefined> = {};

const GLOBALS: Record<string, () => unknown> = {
  'lib/xlsx.full.min.js': () => (window as any).XLSX,
  'lib/tesseract.min.js': () => (window as any).Tesseract,
  'lib/vosk-browser.js': () => (window as any).Vosk || (window as any).createModel,
  'lib/qrcode.js': () => (window as any).QRCode || (window as any).qrcode,
  'lib/jsQR.js': () => (window as any).jsQR,
  'lib/chart.umd.js': () => (window as any).Chart,
};

export function libLoad(src: string): Promise<void> {
  const cached = _LL[src];
  if (cached) return cached;
  _LL[src] = new Promise<void>((res, rej) => {
    const g = GLOBALS[src];
    if (g && g()) {
      res();
      return;
    }
    const sc = document.createElement('script');
    sc.src = '/' + src.replace(/^\/+/, '');
    sc.onload = () => res();
    sc.onerror = () => {
      if (g && g()) res();
      else rej(new Error('lib:' + src));
    };
    document.head.appendChild(sc);
  });
  return _LL[src];
}
