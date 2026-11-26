import React from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar } from '../components/HeaderBar';
import { Avatar, DateStr } from '../components/Formatters';
import { useApp } from '../context/AppContext';
import { getCust } from '../core/ledger';
import { fmt, getMU } from '../core/format';
import type { Customer, Invoice, Payment } from '../types/daftari';

export const TrashScreen: React.FC = () => {
  const { dd, curAcc, t, resetStack, trashRestore, openSheet } = useApp();
  const mu = getMU(curAcc);
  const list = (dd.trash || []).slice().sort((a, b) => b.ts - a.ts);

  return (
    <>
      <HeaderBar title={t('trashT')} onBack={() => resetStack([{ s: 'settings' }])} />

      <div className="pad list" style={{ marginTop: 10, paddingBottom: 10 }}>
        {list.length ? (
          list.map((e) => {
            const o = e.o;
            const c = e.k === 'c' ? (o as Customer) : (o as Invoice | Payment).cust ? getCust(dd, (o as Invoice | Payment).cust) : null;
            return (
              <div key={o.id} className="card litem">
                {c ? (
                  <Avatar name={c.name} size={44} cid={c.id} />
                ) : (
                  <span
                    className="av"
                    style={{
                      width: 44,
                      height: 44,
                      background: e.k === 'd' ? 'var(--red-bg)' : 'var(--green-bg)',
                      color: e.k === 'd' ? 'var(--red)' : 'var(--green)',
                    }}
                  >
                    <Icon name={e.k === 'd' ? 'receipt' : 'banknote'} size={18} />
                  </span>
                )}
                <div className="sp">
                  <b>{c ? c.name : t(e.k === 'd' ? 'debt' : 'pay')}</b>
                  {e.k === 'c' ? (
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                      {t('cust')} · <DateStr ts={e.ts} />
                    </div>
                  ) : (
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                      <Icon name={e.k === 'd' ? 'receipt' : 'banknote'} size={12} />{' '}
                      {e.k === 'd' ? (o as Invoice).note || '' : (o as Payment).method || ''} ·{' '}
                      <DateStr ts={(o as Invoice | Payment).ts} />
                    </div>
                  )}
                </div>
                {e.k !== 'c' && (
                  <span className={`amt ${e.k === 'd' ? 'red' : 'green'}`}>
                    <span className="num">{fmt((o as Invoice | Payment).amount, mu)}</span> {curAcc.cur}
                  </span>
                )}
                <button
                  className="btn btn-soft"
                  style={{ width: 'auto', padding: '8px 12px', fontSize: 12.5, whiteSpace: 'nowrap' }}
                  onClick={() => trashRestore(o.id)}
                >
                  <Icon name="undo" size={14} />
                  {t('restore')}
                </button>
              </div>
            );
          })
        ) : (
          <div className="muted" style={{ textAlign: 'center', padding: '34px 0' }}>
            <Icon name="trash" size={28} />
            <div style={{ marginTop: 10, fontWeight: 700 }}>{t('trashEmptyS')}</div>
          </div>
        )}
      </div>

      {list.length > 0 && (
        <div className="pad" style={{ paddingTop: 0 }}>
          <button
            className="btn btn-red"
            style={{ width: '100%' }}
            onClick={() => openSheet({ type: 'confirmTrashPurge' })}
          >
            <Icon name="trash" size={16} /> {t('emptyTrash')}
          </button>
        </div>
      )}
    </>
  );
};
