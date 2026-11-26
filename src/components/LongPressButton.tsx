import React, { useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';

let globalTouchSeen = 0;
const globalLpLast = { t: 0, k: '' };

function lpGuard(k: string): boolean {
  const n = Date.now();
  if (globalLpLast.k === k && n - globalLpLast.t < 450) return false;
  globalLpLast.t = n;
  globalLpLast.k = k;
  return true;
}

export const LongPressButton: React.FC<{
  kind: 'debt' | 'pay';
  cls: string;
  icon: IconName;
  label: string;
  style?: React.CSSProperties;
}> = ({ kind, cls, icon, label, style }) => {
  const { sec, ctxCust, goWiz, startRec, ui, t } = useApp();
  const recPendRef = useRef<number | null>(null);
  const [holding, setHolding] = useState(false);

  const btnDown = () => {
    if (recPendRef.current) return;
    setHolding(true);
    recPendRef.current = window.setTimeout(() => {
      recPendRef.current = null;
      setHolding(false);
      haptic('longPress', sec);
      startRec(kind, ctxCust);
    }, 380);
  };

  const btnCancel = () => {
    setHolding(false);
    if (recPendRef.current) {
      clearTimeout(recPendRef.current);
      recPendRef.current = null;
    }
  };

  const btnUp = () => {
    setHolding(false);
    if (recPendRef.current) {
      clearTimeout(recPendRef.current);
      recPendRef.current = null;
      haptic('tap', sec);
      goWiz(kind, ctxCust);
    }
  };

  return (
    <button
      className={`btn ${cls} lp-btn${holding ? ' lp-hold' : ''}`}
      style={style}
      aria-label={t(kind === 'debt' ? 'recDebt' : 'recPay')}
      onPointerDown={() => {
        if (Date.now() - globalTouchSeen < 800) return;
        btnDown();
      }}
      onPointerUp={() => {
        if (Date.now() - globalTouchSeen < 800) return;
        if (!lpGuard(kind)) return;
        btnUp();
      }}
      onPointerLeave={btnCancel}
      onTouchStart={() => {
        globalTouchSeen = Date.now();
        btnDown();
      }}
      onTouchEnd={() => {
        globalTouchSeen = Date.now();
        if (!lpGuard(kind)) return;
        btnUp();
      }}
      onClick={() => {
        if (Date.now() - globalTouchSeen < 800) return;
        if (recPendRef.current || (ui.rec && ui.rec.st === 'rec')) return;
        if (!lpGuard(kind)) return;
        btnCancel();
        goWiz(kind, ctxCust);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Icon name={icon} size={18} />
      <span>{label}</span>
      <span className="lp-mic" aria-hidden="true">
        <Icon name="mic" size={13} />
      </span>
    </button>
  );
};
