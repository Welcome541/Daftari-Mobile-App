import React from 'react';
import type { InvoiceStatus, Lang } from '../types/daftari';
import { MON } from '../core/i18n';
import { avatarLetterFor, fmt, getMU } from '../core/format';
import { useApp } from '../context/AppContext';

export const DateStr: React.FC<{ ts: number }> = ({ ts }) => {
  const { db } = useApp();
  const lang: Lang = db?.lang || 'ar';
  const d = new Date(ts);
  return (
    <>
      <span className="num">{d.getDate()}</span> {MON[lang][d.getMonth()]}{' '}
      <span className="num">{d.getFullYear()}</span>
    </>
  );
};

export const TimeStr: React.FC<{ ts: number }> = ({ ts }) => {
  const { db } = useApp();
  const lang: Lang = db?.lang || 'ar';
  const d = new Date(ts);
  let h = d.getHours();
  const ap = h < 12 ? (lang === 'ar' ? 'ص' : 'AM') : lang === 'ar' ? 'م' : 'PM';
  h = ((h + 11) % 12) + 1;
  return (
    <>
      <span className="num">
        {h}:{String(d.getMinutes()).padStart(2, '0')}
      </span>{' '}
      {ap}
    </>
  );
};

export const MoneyText: React.FC<{ amount: number }> = ({ amount }) => {
  const { curAcc } = useApp();
  const mu = getMU(curAcc);
  return (
    <>
      <span className="num">{fmt(amount, mu)}</span> {curAcc.cur}
    </>
  );
};

export const StatusBadge: React.FC<{ status: InvoiceStatus }> = ({ status }) => {
  const { t } = useApp();
  return (
    <span className={`chip b-${status}`}>
      <span className="dot" />
      {t(status)}
    </span>
  );
};

export const Avatar: React.FC<{
  name: string;
  size: number | string;
  cid?: string | null;
  onClick?: () => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}> = ({ name, size, cid, onClick, ariaLabel, style }) => {
  const { dd, avMap } = useApp();
  const customers = dd.customers || [];
  const custObj = cid ? customers.find((x) => x.id === cid) : undefined;
  const byName = customers.find((x) => x.name === name && !x.archived);
  const effCid = cid || custObj?.id || byName?.id || null;
  const c = (effCid ? customers.find((x) => x.id === effCid) : undefined) || byName || custObj;

  const len = typeof size === 'number' ? `${size}px` : size;
  const fs = typeof size === 'number' ? `${Math.round(size * 0.34)}px` : `calc(${size} * 0.34)`;

  if (c && c.photo) {
    return (
      <span
        className="av"
        style={{ width: len, height: len, padding: 0, cursor: onClick ? 'pointer' : undefined, ...style }}
        onClick={onClick}
        aria-label={ariaLabel}
      >
        <img
          src={c.photo}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        />
      </span>
    );
  }

  const letter = avatarLetterFor(avMap, customers, effCid, name);
  return (
    <span
      className="av"
      style={{
        width: len,
        height: len,
        fontSize: fs,
        background: 'var(--navy)',
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      {letter}
    </span>
  );
};
