import React from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar } from '../components/HeaderBar';
import { Avatar, DateStr, MoneyText, StatusBadge, TimeStr } from '../components/Formatters';
import { useApp } from '../context/AppContext';
import { getCust, getInv, invPaid, invRem, invStatus } from '../core/ledger';
import { fmt, getMU, opHasTime } from '../core/format';

export const InvoiceScreen: React.FC<{ id: string }> = ({ id }) => {
  const { dd, ix, curAcc, t, back, goWiz, openSheet, waRemindInv } = useApp();
  const inv = getInv(dd, id);
  if (!inv) return null;

  const c = getCust(dd, inv.cust);
  const st = invStatus(ix, inv);
  const paid = invPaid(ix, inv.id);
  const rem = invRem(ix, inv);
  const mu = getMU(curAcc);
  const pays = (dd.payments || [])
    .filter((x) => (x.alloc || []).some((a) => a.inv === inv.id))
    .sort((a, b) => a.ts - b.ts);

  return (
    <>
      <HeaderBar
        title={
          <>
            {t('invoice')} <span className="num">{inv.code}</span>
          </>
        }
        onBack={back}
        onMenu={() => openSheet({ type: 'invMenu', invId: inv.id })}
      />

      <div className="pad">
        <div className="card" style={{ padding: 17 }}>
          <div className="row">
            {c ? (
              <Avatar name={c.name} size={50} cid={c.id} />
            ) : (
              <span className="av" style={{ width: 50, height: 50, background: 'var(--navy)', color: '#fff' }}>
                <Icon name="receipt" size={20} />
              </span>
            )}
            <div className="sp">
              <div style={{ fontWeight: 800, fontSize: 16.5 }}>{c ? c.name : inv.note || t('expense')}</div>
              <div className="muted" style={{ marginTop: 3 }}>
                <DateStr ts={inv.ts} />
                {opHasTime(inv) ? (
                  <>
                    {' '}
                    · <TimeStr ts={inv.ts} />
                  </>
                ) : null}
              </div>
            </div>
            <StatusBadge status={st} />
          </div>

          <div className="stats" style={{ marginTop: 15, gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="muted">{t('total')}</div>
              <div className="amt" style={{ fontSize: 17, marginTop: 4 }}>
                <MoneyText amount={inv.amount} />
              </div>
            </div>
            <div style={{ textAlign: 'center', borderInline: '1px solid var(--line2)' }}>
              <div className="muted">{t('paidLbl')}</div>
              <div className="amt green" style={{ fontSize: 17, marginTop: 4 }}>
                <MoneyText amount={paid} />
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div className="muted">{t('remaining')}</div>
              <div className="amt red" style={{ fontSize: 17, marginTop: 4 }}>
                <MoneyText amount={rem} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="pad" style={{ marginTop: 12 }}>
        <button
          className="btn"
          style={{ width: '100%', background: 'var(--amber-bg)', color: 'var(--amber)' }}
          onClick={() => openSheet({ type: 'returnAdjust', invId: inv.id })}
        >
          <Icon name="undo" size={16} />
          {t('retT')}
        </button>
      </div>

      {inv.edits && inv.edits.length > 0 && (
        <>
          <div className="pad" style={{ margin: '14px 20px 7px', fontWeight: 800, color: 'var(--amber)' }}>
            <Icon name="edit" size={16} /> {t('editsLog')}
          </div>
          <div className="pad" style={{ marginTop: 0 }}>
            <div className="card" style={{ padding: '4px 16px' }}>
              {inv.edits
                .slice()
                .reverse()
                .map((e, idx) => (
                  <div key={idx} className="kv">
                    <span className="kic" style={{ background: 'var(--amber-bg)', color: 'var(--amber)' }}>
                      <Icon name="undo" size={15} />
                    </span>
                    <div className="k">
                      {t('ret')}
                      <div className="muted" style={{ fontSize: 11 }}>
                        <DateStr ts={e.ts} />
                        {opHasTime(e) ? (
                          <>
                            {' '}
                            · <TimeStr ts={e.ts} />
                          </>
                        ) : null}
                        {e.note ? ` · ${e.note}` : ''}
                      </div>
                    </div>
                    <span className="v amt" style={{ color: 'var(--amber)' }}>
                      {fmt(e.from, mu)} ← {fmt(e.to, mu)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}


      {c && c.phone && rem > 0 && (
        <div className="pad" style={{ marginTop: 12 }}>
          <button className="btn btn-green" onClick={() => waRemindInv(inv.id)}>
            <Icon name="wa" size={18} />
            {t('waRemind')}
          </button>
        </div>
      )}

      <div className="pad" style={{ margin: '16px 20px 7px', fontWeight: 800 }}>
        <Icon name="hist" size={16} /> {t('payLog')}
      </div>

      <div className="pad">
        <div className="card" style={{ padding: '4px 16px' }}>
          {pays.length ? (
            pays.map((x, n) => {
              const alloc = x.alloc.find((a) => a.inv === inv.id);
              return (
                <div key={x.id} className="kv">
                  <span className="kic" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
                    <Icon name="checkc" size={17} />
                  </span>
                  <span className="k">
                    {t('payOf')} <span className="num">{n + 1}</span>
                    <br />
                    <span style={{ fontSize: 11.5 }}>
                      <DateStr ts={x.ts} />
                      {opHasTime(x) ? (
                        <>
                          {' '}
                          · <TimeStr ts={x.ts} />
                        </>
                      ) : null}
                    </span>
                  </span>
                  <span className="v amt green">
                    <MoneyText amount={alloc ? alloc.amt : 0} />
                  </span>
                </div>
              );
            })
          ) : (
            <div className="muted" style={{ textAlign: 'center', padding: '20px 0' }}>
              {t('noPay')}
            </div>
          )}
        </div>
      </div>

      <div className="bottombar" style={{ flexDirection: 'column' }}>
        {rem > 0 && (
          <button className="btn btn-green" onClick={() => goWiz('pay', c ? c.id : null)}>
            <Icon name="coins" size={18} />
            {t('payRemaining')}
          </button>
        )}
        {c && (
          <button className="btn btn-line" onClick={() => openSheet({ type: 'exportCustomer', cid: c.id })}>
            <Icon name="share" size={17} />
            {t('shareReceipt')}
          </button>
        )}
      </div>
    </>
  );
};
