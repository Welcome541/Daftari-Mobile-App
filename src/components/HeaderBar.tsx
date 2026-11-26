import React from 'react';
import { Icon } from './Icon';
import { useApp } from '../context/AppContext';

export const HeaderBar: React.FC<{
  title: React.ReactNode;
  sub?: React.ReactNode;
  onBack?: () => void;
  onMenu?: () => void;
  extra?: React.ReactNode;
}> = ({ title, sub, onBack, onMenu, extra }) => {
  const { t } = useApp();
  return (
    <div className="hdr">
      {onBack ? (
        <button className="hbtn" aria-label={t('back')} onClick={onBack}>
          <Icon name="back" size={20} />
        </button>
      ) : (
        <span style={{ width: 10 }} />
      )}
      <div className="sp" style={{ textAlign: 'center' }}>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {onMenu ? (
        <button className="hbtn" aria-label={t('menu')} onClick={onMenu}>
          <Icon name="dots" size={20} />
        </button>
      ) : (
        extra || <span style={{ width: 10 }} />
      )}
    </div>
  );
};

export const NotifButton: React.FC = () => {
  const { dd, ix, t, openSheet } = useApp();
  const count = (dd.customers || []).filter((c) => !c.archived && (ix.open[c.id] || 0) > 0).length;

  return (
    <button
      className="notif"
      onClick={() => openSheet({ type: 'notifications' })}
      aria-label={t('notifT')}
    >
      <Icon name="bellf" size={21} />
      {count > 0 && (
        <span className="notif-badge">
          <span className="num">{count}</span>
        </span>
      )}
    </button>
  );
};
