import React, { useState } from 'react';
import { Icon } from '../components/Icon';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';

export const LockScreen: React.FC = () => {
  const { sec, t, verifyPin, fpUnlock } = useApp();
  const [pinBuf, setPinBuf] = useState('');

  const handleTap = async (d: string) => {
    haptic('tap', sec);
    if (d === 'c') {
      setPinBuf('');
      return;
    }
    if (d === 'x') {
      setPinBuf((prev) => prev.slice(0, -1));
      return;
    }
    if (pinBuf.length >= 4) return;
    const next = pinBuf + d;
    setPinBuf(next);
    if (next.length === 4) {
      const ok = await verifyPin(next);
      if (!ok) {
        setTimeout(() => setPinBuf(''), 300);
      }
    }
  };

  return (
    <div className="padlock">
      <div className="logo-ic" style={{ width: 64, height: 64, borderRadius: 20 }}>
        <Icon name="book" size={30} />
      </div>
      <h1 style={{ marginTop: 14 }}>دَفتَري</h1>
      <div className="muted" style={{ marginTop: 6 }}>
        {t('enterPin')}
      </div>
      <div className="pdots" id="pdots">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i < pinBuf.length ? 'f' : undefined} />
        ))}
      </div>
      {sec.fps && sec.fps.length > 0 && (
        <button
          className="btn btn-line"
          style={{ width: 'auto', marginTop: 18, padding: '10px 22px' }}
          onClick={fpUnlock}
        >
          <Icon name="fp" size={18} />
          {t('fpUse')}
        </button>
      )}
      <div className="kp">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => handleTap(d)}>
            {d}
          </button>
        ))}
        <button onClick={() => handleTap('x')}>
          <Icon name="back" size={20} />
        </button>
        <button onClick={() => handleTap('0')}>0</button>
        <button onClick={() => handleTap('c')}>
          <Icon name="x" size={18} />
        </button>
      </div>
    </div>
  );
};
