import React, { useEffect, useMemo, useRef } from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar } from '../components/HeaderBar';
import { Avatar } from '../components/Formatters';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';
import { custCredit, custOpen, getCust, lastAct } from '../core/ledger';
import { fmt, getMU, Money, normAr, pdig } from '../core/format';
import type { PaymentMethod } from '../types/daftari';

const NOTE_PRESETS_AR = ['مواد تموينية', 'خبز وحليب', 'خضروات وفواكه', 'رز وزيت', 'منظفات', 'مياه ومشروبات'];
const NOTE_PRESETS_EN = ['Groceries', 'Bread & milk', 'Produce', 'Rice & oil', 'Detergents', 'Drinks'];
const QUICK_AMOUNTS = [20, 50, 100, 200, 500];

export const WizardScreen: React.FC = () => {
  const { db, dd, ix, curAcc, sec, isP, ui, setUi, t, go, back, wizConfirm } = useApp();
  const wz = ui.wz;
  const amtInputRef = useRef<HTMLInputElement>(null);

  const steps = isP ? (['amt'] as const) : (['cust', 'amt'] as const);
  const si = wz ? Math.min(wz.step, steps.length - 1) : 0;
  const curStep = steps[si];

  useEffect(() => {
    if (curStep === 'amt') {
      const timer = setTimeout(() => {
        amtInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [curStep]);

  const mu = getMU(curAcc);
  const qNorm = normAr(wz?.q || '');
  const qDig = pdig(wz?.q || '');

  const custList = useMemo(() => {
    return (dd.customers || [])
      .filter((c) => !c.archived)
      .filter(
        (c) =>
          !qNorm ||
          normAr(c.name).includes(qNorm) ||
          (qDig.length >= 3 && pdig(c.phone).endsWith(qDig))
      )
      .sort((a, b) => {
        const pDiff = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        if (pDiff !== 0) return pDiff;
        return lastAct(ix, b.id) - lastAct(ix, a.id);
      });
  }, [dd.customers, ix, qNorm, qDig]);

  if (!wz) return <div className="pad" />;

  const isDebt = wz.kind === 'debt';
  const lang = db?.lang || 'ar';
  const notePresets = lang === 'ar' ? NOTE_PRESETS_AR : NOTE_PRESETS_EN;

  const wizExit = () => {
    setUi((prev) => ({ ...prev, wz: null }));
    back();
  };

  const openAddCust = () => {
    const prefill = (wz.q || '').trim();
    setUi((prev) => ({
      ...prev,
      nc: { name: prefill, phone: '', limit: '', photo: null, edit: null, forceDup: false },
    }));
    go('newcust', {});
  };

  const selectedCust = isP ? null : getCust(dd, wz.custId);
  const amt = Money.parse(wz.amt, mu);
  const before = selectedCust ? custOpen(ix, selectedCust.id) : null;
  const beforeCredit = selectedCust ? custCredit(ix, selectedCust.id) : 0;
  const after =
    before == null ? null : isDebt ? before + amt : Math.max(0, before - amt);
  const hint =
    !isDebt && amt > 0 && before != null && before > 0
      ? before - amt <= 0
        ? t('willPaid')
        : after != null && after < before
        ? t('willPart')
        : ''
      : '';

  const col = isDebt ? 'var(--red)' : 'var(--green)';
  const noResCFn = t('noResC');
  const addXFn = t('addX');

  const setAmtStr = (val: string) => {
    setUi((prev) => (prev.wz ? { ...prev, wz: { ...prev.wz, amt: val } } : prev));
  };

  return (
    <>
      <HeaderBar
        title={isDebt ? t('wizDebtT') : t('wizPayT')}
        onBack={wizExit}
      />

      {steps.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px 2px' }}>
          {steps.map((k, i) => {
            const done = i < si;
            const act = i === si;
            const label = k === 'cust' ? t('wzCust') : t('wzConf');
            return (
              <div
                key={k}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  flex: i < steps.length - 1 ? 1 : undefined,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    fontSize: 12.5,
                    flex: 'none',
                    background: done ? 'var(--green)' : act ? 'var(--navy)' : 'var(--card)',
                    border: !done && !act ? '1.5px solid var(--line)' : undefined,
                    color: done || act ? '#fff' : 'var(--soft)',
                  }}
                >
                  {done ? <Icon name="check" size={14} /> : i + 1}
                </span>
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: 12.5,
                    color: act ? 'var(--navy)' : done ? 'var(--green)' : 'var(--soft)',
                  }}
                >
                  {label}
                </span>
                {i < steps.length - 1 && (
                  <span
                    style={{
                      flex: 1,
                      height: 2,
                      borderRadius: 2,
                      background: done ? 'var(--green)' : 'var(--line)',
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {curStep === 'cust' ? (
        <>
          <div className="pad search" style={{ marginTop: 10 }}>
            <div className="inp card" style={{ flex: 1 }}>
              <Icon name="search" size={17} />
              <input
                placeholder={t('wzSearchC')}
                value={wz.q}
                onChange={(e) =>
                  setUi((prev) => (prev.wz ? { ...prev, wz: { ...prev.wz, q: e.target.value } } : prev))
                }
              />
              {wz.q && (
                <button
                  type="button"
                  style={{
                    background: 'var(--card2)',
                    border: '1px solid var(--line)',
                    borderRadius: '50%',
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--muted)',
                    flex: 'none',
                  }}
                  onClick={() =>
                    setUi((prev) => (prev.wz ? { ...prev, wz: { ...prev.wz, q: '' } } : prev))
                  }
                  aria-label={t('clearF')}
                >
                  <Icon name="x" size={13} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="hbtn"
              style={{ height: 46, padding: '0 12px', gap: 6, color: 'var(--navy)', fontWeight: 800, fontSize: 13 }}
              onClick={openAddCust}
              aria-label={t('addC')}
            >
              <Icon name="userplus" size={18} />
            </button>
          </div>

          <div className="pad list" id="wzlist" style={{ paddingBottom: 96, marginTop: 8 }}>
            {!custList.length ? (
              <div className="card" style={{ padding: '26px 20px', textAlign: 'center' }}>
                <div className="muted" style={{ fontWeight: 700 }}>
                  {wz.q.trim()
                    ? typeof noResCFn === 'function'
                      ? noResCFn(wz.q.trim())
                      : wz.q.trim()
                    : t('noCustomers')}
                </div>
                <button className="btn btn-navy" style={{ marginTop: 14 }} onClick={openAddCust}>
                  <Icon name="userplus" size={17} />
                  {wz.q.trim() && typeof addXFn === 'function' ? addXFn(wz.q.trim()) : t('addCustBtn')}
                </button>
              </div>
            ) : (
              custList.map((c) => {
                const o = custOpen(ix, c.id);
                const cr = custCredit(ix, c.id);
                return (
                  <div
                    key={c.id}
                    className="card litem orow"
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      haptic('tap', sec);
                      setUi((prev) =>
                        prev.wz ? { ...prev, wz: { ...prev.wz, custId: c.id, step: 1 } } : prev
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        haptic('tap', sec);
                        setUi((prev) =>
                          prev.wz ? { ...prev, wz: { ...prev.wz, custId: c.id, step: 1 } } : prev
                        );
                      }
                    }}
                  >
                    <Avatar name={c.name} size="var(--row-av)" cid={c.id} />
                    <div className="orow-mid">
                      <div className="orow-name">
                        <span>{c.name}</span>
                        {c.pinned && (
                          <span style={{ color: 'var(--amber)', display: 'inline-flex' }}>
                            <Icon name="pinf" size={12} />
                          </span>
                        )}
                      </div>
                      {c.phone && (
                        <div className="orow-meta">
                          <span className="tx num">{c.phone}</span>
                        </div>
                      )}
                    </div>
                    <div className="orow-side">
                      {o > 0 ? (
                        <span className="orow-amt red">
                          <span className="num">{fmt(o, mu)}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                      ) : cr > 0 ? (
                        <span className="orow-amt green">
                          <span className="num">{fmt(-cr, mu)}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                      ) : (
                        <span className="orow-amt gray">
                          <span className="num">{fmt(0, mu)}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        color: 'var(--navy)',
                        marginInlineStart: 'calc(6px * var(--s))',
                        flex: 'none',
                      }}
                    >
                      <Icon name="fwd" size={16} />
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="pad" style={{ marginTop: 12, paddingBottom: 100 }}>
          {!isP && selectedCust && (
            <div
              className="card litem orow"
              role="button"
              tabIndex={0}
              style={{ marginBottom: 14, border: '1.5px solid var(--navy-line)', cursor: 'pointer' }}
              onClick={() =>
                setUi((prev) => (prev.wz ? { ...prev, wz: { ...prev.wz, step: 0 } } : prev))
              }
            >
              <Avatar name={selectedCust.name} size="var(--row-av)" cid={selectedCust.id} />
              <div className="orow-mid">
                <div className="orow-name">
                  <span>{selectedCust.name}</span>
                </div>
                <div className="orow-meta">
                  {before != null && before > 0 ? (
                    <span style={{ color: 'var(--red)', fontWeight: 700 }}>
                      {t('nowOwe')}: <span className="num">{fmt(before, mu)}</span> {curAcc.cur}
                    </span>
                  ) : beforeCredit > 0 ? (
                    <span style={{ color: 'var(--green)', fontWeight: 700 }}>
                      <span className="num">{fmt(-beforeCredit, mu)}</span> {curAcc.cur}
                    </span>
                  ) : (
                    <span>{selectedCust.phone || t('settled')}</span>
                  )}
                </div>
              </div>
              <span
                className="chip"
                style={{
                  background: 'var(--navy-bg)',
                  color: 'var(--navy)',
                  border: '1px solid var(--navy-line)',
                  padding: '5px 11px',
                  fontSize: 11.5,
                  fontWeight: 800,
                  flex: 'none',
                }}
              >
                {t('changeCust')}
              </span>
            </div>
          )}

          <label className="lb" style={{ marginTop: 0 }}>
            {isDebt ? t('debtAmt') : t('amountNow')}
          </label>
          <div className={`wz-amt-box${isDebt ? '' : ' pay'}`}>
            <input
              ref={amtInputRef}
              id="wzA"
              className="num"
              enterKeyHint="done"
              inputMode="decimal"
              placeholder="0"
              value={wz.amt}
              onChange={(e) => setAmtStr(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') wizConfirm();
              }}
            />
            <span className="wz-amt-cur">{curAcc.cur}</span>
          </div>

          <div className="wz-qchips">
            {!isDebt && before != null && before > 0 && (
              <>
                <button
                  type="button"
                  className={`wz-qchip accent${amt === before ? ' on' : ''}`}
                  onClick={() => {
                    haptic('tap', sec);
                    setAmtStr(Money.dec(before, mu));
                  }}
                >
                  {t('full')} ({fmt(before, mu)})
                </button>
                {before >= 2 * Math.pow(10, mu) && (
                  <button
                    type="button"
                    className={`wz-qchip accent${amt === Math.round(before / 2) ? ' on' : ''}`}
                    onClick={() => {
                      haptic('tap', sec);
                      setAmtStr(Money.dec(Math.round(before / 2), mu));
                    }}
                  >
                    {t('halfAmt')}
                  </button>
                )}
              </>
            )}
            {(isDebt || !before || before <= 0 ? QUICK_AMOUNTS : [50, 100, 200]).map((qVal) => {
              const qMinor = qVal * Math.pow(10, mu);
              return (
                <button
                  key={qVal}
                  type="button"
                  className={`wz-qchip num${amt === qMinor ? ' on' : ''}`}
                  onClick={() => {
                    haptic('tap', sec);
                    setAmtStr(String(qVal));
                  }}
                >
                  {qVal} {curAcc.cur}
                </button>
              );
            })}
          </div>

          <div className="wz-impact">
            <div className="wz-impact-row">
              <span>{isDebt ? t('wizDebtT') : t('wizPayT')}</span>
              <span className="num" style={{ fontSize: 17, fontWeight: 900, color: amt > 0 ? col : 'var(--soft)' }}>
                {fmt(amt, mu)} {curAcc.cur}
              </span>
            </div>

            {selectedCust && amt > 0 && before != null && after != null && (
              <div
                className="wz-impact-row"
                style={{ paddingTop: 8, borderTop: '1px dashed var(--line)', flexWrap: 'wrap' }}
              >
                <span>
                  {t('nowOwe')}: <b className="num">{fmt(before, mu)}</b>
                </span>
                <span style={{ color: col, fontWeight: 800 }}>
                  {t('afterOp')}: <b className="num">{fmt(after, mu)}</b> {curAcc.cur}
                </span>
                {hint && (
                  <span
                    className="chip"
                    style={{ background: 'var(--green-bg)', color: 'var(--green)', border: '1px solid var(--green-line)' }}
                  >
                    ✓ {hint}
                  </span>
                )}
              </div>
            )}
          </div>

          {isDebt ? (
            <>
              <label className="lb">
                {t('remind')} — {t('optF')}
              </label>
              <input
                className="inp"
                placeholder={t('remindPh')}
                value={wz.note}
                onChange={(e) =>
                  setUi((prev) => (prev.wz ? { ...prev, wz: { ...prev.wz, note: e.target.value } } : prev))
                }
              />
              <div className="wz-qchips">
                {notePresets.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`wz-qchip${wz.note === preset ? ' on' : ''}`}
                    onClick={() => {
                      haptic('tap', sec);
                      setUi((prev) =>
                        prev.wz
                          ? { ...prev, wz: { ...prev.wz, note: prev.wz.note === preset ? '' : preset } }
                          : prev
                      );
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <label className="lb">{t('method')}</label>
              <div className="seg">
                {(['cash', 'transfer', 'cardpay'] as PaymentMethod[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={wz.method === m ? 'on' : ''}
                    onClick={() => {
                      haptic('tap', sec);
                      setUi((prev) => (prev.wz ? { ...prev, wz: { ...prev.wz, method: m } } : prev));
                    }}
                  >
                    {t(m)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="bottombar" style={{ display: 'flex', gap: 10 }}>
        {curStep === 'cust' ? (
          <button className="btn btn-line" style={{ flex: 1 }} onClick={wizExit}>
            <Icon name="x" size={16} />
            {t('cancel')}
          </button>
        ) : (
          <>
            <button
              className={`btn ${isDebt ? 'btn-red' : 'btn-green'}`}
              style={{ flex: 1.6 }}
              onClick={wizConfirm}
            >
              <Icon name="checkc" size={18} />
              {isDebt ? t('confirmReg') : t('confirmPay')}
            </button>
            {si > 0 ? (
              <button
                className="btn btn-line"
                style={{ flex: 1 }}
                onClick={() =>
                  setUi((prev) => (prev.wz ? { ...prev, wz: { ...prev.wz, step: 0 } } : prev))
                }
              >
                <Icon name="back" size={16} />
                {t('wzBack')}
              </button>
            ) : (
              <button className="btn btn-line" style={{ flex: 1 }} onClick={wizExit}>
                <Icon name="x" size={16} />
                {t('cancel')}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
};
