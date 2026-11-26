import React from 'react';

export type IconName =
  | 'mic' | 'user' | 'users' | 'userplus' | 'wallet' | 'cal' | 'clock' | 'phone' | 'cam'
  | 'sun' | 'bell' | 'bellf' | 'belloff' | 'vibrate' | 'viboff' | 'moon' | 'eye' | 'printer'
  | 'eyeoff' | 'zap' | 'share' | 'search' | 'sliders' | 'chevD' | 'back' | 'fwd' | 'plus'
  | 'check' | 'checkb' | 'checkc' | 'checkAll' | 'shield' | 'lock' | 'unlock' | 'down' | 'trash' | 'edit'
  | 'archive' | 'dots' | 'home' | 'receipt' | 'pie' | 'gear' | 'undo' | 'banknote' | 'coins'
  | 'star' | 'tag' | 'x' | 'toTop' | 'minus' | 'save' | 'contact' | 'book' | 'excel' | 'pdf'
  | 'up' | 'globe' | 'hist' | 'pin' | 'pinf' | 'store' | 'wa' | 'sms' | 'fp';

const ICONS: Record<IconName, React.ReactNode> = {
  mic: (
    <>
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="22" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="3.6" />
      <path d="M22 21v-2a3.6 3.6 0 0 0-2.6-3.4" />
      <path d="M16.5 3.6a3.5 3.5 0 0 1 0 6.8" />
    </>
  ),
  userplus: (
    <>
      <path d="M15 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="16" y1="11" x2="22" y2="11" />
    </>
  ),
  wallet: (
    <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15.5 13.5" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  ),
  cam: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="2" fill="none" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </>
  ),
  bellf: (
    <>
      <path fill="currentColor" stroke="none" d="M12 2.4a1.5 1.5 0 0 0-1.5 1.5v.35A6.1 6.1 0 0 0 6 10v4.3l-1.9 2.5a.8.8 0 0 0 .65 1.25h14.5a.8.8 0 0 0 .65-1.25L18 14.3V10a6.1 6.1 0 0 0-4.5-5.75v-.35A1.5 1.5 0 0 0 12 2.4Z" />
      <path fill="currentColor" stroke="none" d="M9.6 19.3a2.45 2.45 0 0 0 4.8 0Z" />
    </>
  ),
  belloff: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  vibrate: (
    <>
      <rect x="9" y="4" width="6" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M5 9v6M2.5 10.5v3M19 9v6M21.5 10.5v3" stroke="currentColor" strokeWidth="2" fill="none" />
    </>
  ),
  viboff: (
    <>
      <rect x="9" y="4" width="6" height="16" rx="1.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="4" y1="3" x2="20" y2="21" stroke="currentColor" strokeWidth="2" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
  eye: (
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  printer: (
    <>
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </>
  ),
  eyeoff: (
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>
  ),
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  share: (
    <>
      <circle cx="18" cy="5.2" r="2.7" />
      <circle cx="6" cy="12" r="2.7" />
      <circle cx="18" cy="18.8" r="2.7" />
      <line x1="8.45" y1="13.35" x2="15.55" y2="17.45" />
      <line x1="15.55" y1="6.55" x2="8.45" y2="10.65" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  sliders: (
    <>
      <line x1="21" y1="6" x2="14" y2="6" />
      <line x1="10" y1="6" x2="3" y2="6" />
      <line x1="21" y1="12" x2="12" y2="12" />
      <line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="18" x2="16" y2="18" />
      <line x1="12" y1="18" x2="3" y2="18" />
      <circle cx="12" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="14" cy="18" r="2" />
    </>
  ),
  chevD: <polyline points="6 9 12 15 18 9" />,
  back: <polyline points="15 18 9 12 15 6" />,
  fwd: <polyline points="9 18 15 12 9 6" />,
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  checkb: <path d="M20 6.5 9.3 17.2 4 11.9" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />,
  checkc: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="8.5 12.2 11 14.7 15.7 9.7" />
    </>
  ),
  checkAll: (
    <>
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-7.5 7.5L13 16" />
    </>
  ),
  shield: (
    <>
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />
      <polyline points="9 11.5 11.2 13.7 15.5 9.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  unlock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 7.7-1.5" />
    </>
  ),
  down: (
    <>
      <path d="M12 3v12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <polyline points="6 11 12 17 18 11" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4 21h16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18" />
      <path d="M8 6V4.2A1.2 1.2 0 0 1 9.2 3h5.6A1.2 1.2 0 0 1 16 4.2V6" />
      <path d="M19 6v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <line x1="10" y1="10.5" x2="10" y2="16.5" />
      <line x1="14" y1="10.5" x2="14" y2="16.5" />
    </>
  ),
  edit: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z" />
    </>
  ),
  archive: (
    <>
      <rect x="2.5" y="3.5" width="19" height="4.5" rx="1.2" />
      <path d="M4.5 8v10.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8" />
      <path d="M10 12.5h4" />
    </>
  ),
  dots: (
    <>
      <circle cx="12" cy="5" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1.9" fill="currentColor" stroke="none" />
    </>
  ),
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8.5Z" />
      <path d="M9.5 21v-6.5a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5V21" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 3h14a1 1 0 0 1 1 1v17l-2.7-1.6L14.7 21 12 19.4 9.3 21l-2.6-1.6L4 21V4a1 1 0 0 1 1-1Z" />
      <path d="M8.5 8h7" />
      <path d="M8.5 12h7" />
      <path d="M8.5 16h4.5" />
    </>
  ),
  pie: (
    <>
      <path d="M3 3v18h18" />
      <rect x="7" y="13" width="3" height="5" rx="0.8" />
      <rect x="12.5" y="9" width="3" height="9" rx="0.8" />
      <rect x="18" y="5" width="3" height="13" rx="0.8" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.82 1 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </>
  ),
  undo: (
    <>
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </>
  ),
  banknote: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
      <path d="M6 12h.01M18 12h.01" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.66 3.13 3 7 3s7-1.34 7-3V6" />
      <path d="M5 12v6c0 1.66 3.13 3 7 3s7-1.34 7-3v-6" />
    </>
  ),
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />,
  tag: (
    <>
      <path d="M20.59 13.41 12 22 2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z" />
      <circle cx="7" cy="7" r="1.5" />
    </>
  ),
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  toTop: (
    <>
      <line x1="7.2" y1="7.2" x2="16.8" y2="7.2" strokeWidth="2.3" strokeLinecap="round" />
      <polyline points="8.2 13.8 12 10 15.8 13.8" fill="none" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  save: (
    <>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </>
  ),
  contact: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M6 15.5a3 3 0 0 1 6 0" />
      <path d="M15 9h4M15 13h4" />
    </>
  ),
  book: (
    <>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5Z" />
      <path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5" />
    </>
  ),
  excel: (
    <>
      <rect x="3" y="3.5" width="18" height="17" rx="2.5" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="14.5" x2="21" y2="14.5" />
      <line x1="9.5" y1="9" x2="9.5" y2="20.5" />
    </>
  ),
  pdf: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <polyline points="14 2 14 8 20 8" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  up: (
    <>
      <path d="M12 19V5" />
      <polyline points="5 12 12 5 19 12" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  hist: (
    <>
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  pin: (
    <>
      <path d="M12 17v5" />
      <path d="M9 3h6l1 7 3 2H5l3-2Z" />
    </>
  ),
  pinf: <path fill="currentColor" stroke="none" d="M16 9V4h1a1 1 0 0 0 0-2H7a1 1 0 0 0 0 2h1v5a3 3 0 0 1-3 3v2h5.97v7l1 1 1-1v-7H19v-2a3 3 0 0 1-3-3Z" />,
  store: (
    <>
      <path d="M4 10 5.5 4h13L20 10" />
      <path d="M4 10a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0" />
      <path d="M5 12v8h14v-8" />
      <path d="M9 20v-5h6v5" />
    </>
  ),
  wa: (
    <>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.7-1.2A9 9 0 1 0 12 3Z" />
      <path d="M9 9.5c0 4 5.5 6.5 6.5 6l.5-1.5-2-1-1 .7c-1-.5-1.7-1.2-2.2-2.2l.7-1-1-2Z" />
    </>
  ),
  sms: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />,
  fp: (
    <>
      <path d="M12 11a3 3 0 0 0-3 3c0 2.5-.5 4.5-1 5.5" />
      <path d="M15 14c0 3-.5 5.5-1 7" />
      <path d="M17.8 17c.2-1 .2-2 .2-3a6 6 0 0 0-9-5.2" />
      <path d="M5.6 10A6 6 0 0 0 6 14c0 1.5-.2 3-.6 4.2" />
      <path d="M20.7 12.3A9 9 0 0 0 6 6.6" />
      <path d="M3.3 9.7A9 9 0 0 1 4.6 7.6" />
    </>
  ),
};

export const Icon: React.FC<{ name: IconName; size?: number; className?: string }> = ({
  name,
  size = 22,
  className = '',
}) => (
  <svg
    className={`ic ${className}`.trim()}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[name]}
  </svg>
);
