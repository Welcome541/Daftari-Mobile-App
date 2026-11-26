import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { HeaderBar } from '../components/HeaderBar';
import { Avatar, DateStr, MoneyText, TimeStr } from '../components/Formatters';
import { LongPressButton } from '../components/LongPressButton';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';
import { custInvoices, custOpen, custPaid, getCust, getInv, getPay, invPaid, invRem, invStatus } from '../core/ledger';
import { fmt, getMU } from '../core/format';
import type { Invoice, Payment } from '../types/daftari';

type ProfileTab = 'log' | 'invoices';
type LogFilter = 'all' | 'debt' | 'pay';

export const CustomerProfileScreen: React.FC<{ id: string; focus?: string }> = ({ id, focus }) => {
  const {
    dd,
    ix,
    curAcc,
    sec,
    t,
    back,
    go,
    goWiz,
    setUi,
    openSheet,
    restoreCustomer,
    togglePin,
    sendWA,
    shareOneById,
    waRemindInv,
  } = useApp();

  const [tabView, setTabView] = useState<ProfileTab>('log');
  const [logFilter, setLogFilter] = useState<LogFilter>('all');
  const [expandedInvId, setExpandedInvId] = useState<string | null>(null);
  const [expandedLogKey, setExpandedLogKey] = useState<string | null>(null);
  const [dismissedFocus, setDismissedFocus] = useState<string | null>(null);
  const [holdingKey, setHoldingKey] = useState<string | null>(null);

  const lpTimerRef = useRef<number | null>(null);
  const lpPosRef = useRef({ x: 0, y: 0 });
  const lpFiredRef = useRef(0);
  const touchSeenRef = useRef(0);

  const cancelRowLp = () => {
    setHoldingKey(null);
    if (lpTimerRef.current) {
      clearTimeout(lpTimerRef.current);
      lpTimerRef.current = null;
    }
  };

  const triggerRowLp = (key: string, action: () => void) => {
    setHoldingKey(null);
    lpFiredRef.current = Date.now();
    haptic('select', sec);
    void key;
    action();
  };

  useEffect(() => {
    setDismissedFocus(null);
    if (focus && focus.startsWith('d:')) {
      const fInvId = focus.substring(2);
      setExpandedInvId(fInvId);
      setExpandedLogKey(fInvId);
    } else {
      setExpandedInvId(null);
      setExpandedLogKey(null);
    }
  }, [focus, id]);

  useEffect(() => {
    setTabView('log');
    setLogFilter('all');
  }, [id]);

  const c = getCust(dd, id);

  const evs = useMemo(() => {
    if (!c) return [];
    const list: {
      ts: number;
      k: 'debt' | 'pay' | 'edit' | 'open';
      amt?: number;
      from?: number;
      to?: number;
      id: string;
      code?: string;
      note?: string;
    }[] = [];

    (dd.invoices || [])
      .filter((i) => !i.arch && i.cust === c.id)
      .forEach((i) => {
        list.push({
          ts: i.ts,
          k: i.k === 'open' ? 'open' : 'debt',
          amt: i.amount,
          id: i.id,
          code: i.code,
          note: i.note,
        });
        (i.edits || []).forEach((e) =>
          list.push({ ts: e.ts, k: 'edit', from: e.from, to: e.to, id: i.id, code: i.code, note: e.note })
        );
      });
    (dd.payments || [])
      .filter((pp) => !pp.arch && pp.cust === c.id)
      .forEach((pp) =>
        list.push({
          ts: pp.ts,
          k: 'pay',
          amt: pp.amount,
          id: pp.id,
          note: pp.method ? String(t(pp.method)) : '',
        })
      );
    return list.sort((a, b) => b.ts - a.ts);
  }, [dd, c, t]);

  const filteredEvs = useMemo(() => {
    if (logFilter === 'all') return evs;
    if (logFilter === 'pay') return evs.filter((e) => e.k === 'pay');
    return evs.filter((e) => e.k !== 'pay');
  }, [evs, logFilter]);

  if (!c) return null;

  const mu = getMU(curAcc);
  const openAmt = custOpen(ix, c.id);
  const paidAmt = custPaid(ix, c.id);
  const invs = custInvoices(dd, c.id);
  const sinceFn = t('since');
  const sinceTxt = typeof sinceFn === 'function' ? sinceFn(c.since) : c.since;

  const hasLimit = typeof c.limit === 'number' && c.limit > 0;
  const limitVal = c.limit || 0;
  const limitPct = hasLimit ? Math.min(100, Math.round((openAmt / limitVal) * 100)) : 0;
  const isOverLimit = hasLimit && openAmt > limitVal;
  const isNearLimit = hasLimit && !isOverLimit && openAmt >= limitVal * 0.8;
  const nearLFn = t('nearL');
  const overByFn = t('overBy');
  const limitStatusTxt = !hasLimit
    ? ''
    : isOverLimit
    ? typeof overByFn === 'function'
      ? overByFn(`${fmt(openAmt - limitVal, mu)} ${curAcc.cur}`)
      : `${fmt(openAmt - limitVal, mu)} ${curAcc.cur}`
    : typeof nearLFn === 'function'
    ? nearLFn(`${fmt(Math.max(0, limitVal - openAmt), mu)} ${curAcc.cur}`)
    : `${fmt(Math.max(0, limitVal - openAmt), mu)} ${curAcc.cur}`;

  const activeFocus = focus && focus.startsWith('p:') && focus !== dismissedFocus ? focus : null;
  let focusPay: Payment | null = null;
  if (activeFocus) {
    focusPay = getPay(dd, activeFocus.substring(2)) || null;
  }

  const renderInvoiceBody = (inv: Invoice) => {
    const paidV = invPaid(ix, inv.id);
    const rem = invRem(ix, inv);
    const pct = inv.amount > 0 ? Math.min(100, Math.round((paidV / inv.amount) * 100)) : 0;
    const invPays = (dd.payments || [])
      .filter((x) => !x.arch && (x.alloc || []).some((a) => a.inv === inv.id))
      .sort((a, b) => b.ts - a.ts);
    const editsRev = (inv.edits || []).slice().reverse();

    return (
      <div className="cp-inv-body" onClick={(e) => e.stopPropagation()}>
        <div className="cp-inv-metrics">
          <div className="cp-inv-m">
            <span className="cp-inv-mlbl">{t('total')}</span>
            <span className="cp-inv-mval num">{fmt(inv.amount, mu)}</span>
          </div>
          <div className="cp-inv-m">
            <span className="cp-inv-mlbl">{t('paidLbl')}</span>
            <span className="cp-inv-mval green num">{fmt(paidV, mu)}</span>
          </div>
          <div className="cp-inv-m">
            <span className="cp-inv-mlbl">{t('remaining')}</span>
            <span className={`cp-inv-mval ${rem > 0 ? 'red' : 'green'} num`}>{fmt(rem, mu)}</span>
          </div>
        </div>

        {paidV > 0 && rem > 0 && (
          <div className="cp-inv-prog">
            <div className="cp-inv-prog-fill" style={{ width: `${pct}%` }} />
          </div>
        )}

        {inv.note ? (
          <div className="cp-inv-note-box">
            <Icon name="tag" size={13} />
            <span>{inv.note}</span>
          </div>
        ) : null}

        {invPays.length > 0 && (
          <div className="cp-inv-subsec">
            <div className="cp-inv-subhdr">
              {t('payLog')} (<span className="num">{invPays.length}</span>)
            </div>
            {invPays.map((p, n) => {
              const alloc = p.alloc.find((a) => a.inv === inv.id);
              return (
                <div key={p.id} className="cp-inv-subrow">
                  <span className="muted" style={{ fontSize: 11.5 }}>
                    {t('payOf')} <span className="num">{invPays.length - n}</span> · <DateStr ts={p.ts} /> ·{' '}
                    <TimeStr ts={p.ts} />
                  </span>
                  <span className="num" style={{ color: 'var(--green)', fontWeight: 800 }}>
                    +{fmt(alloc ? alloc.amt : 0, mu)} {curAcc.cur}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {editsRev.length > 0 && (
          <div className="cp-inv-subsec">
            <div className="cp-inv-subhdr" style={{ color: 'var(--amber)' }}>
              {t('editsLog')} (<span className="num">{editsRev.length}</span>)
            </div>
            {editsRev.map((ed, idx) => (
              <div key={idx} className="cp-inv-subrow">
                <span className="muted" style={{ fontSize: 11.5 }}>
                  <DateStr ts={ed.ts} />
                  {ed.note ? ` · ${ed.note}` : ''}
                </span>
                <span className="num" style={{ color: 'var(--amber)', fontWeight: 800 }}>
                  {fmt(ed.from, mu)} ← {fmt(ed.to, mu)}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="cp-inv-acts">
          {rem > 0 && (
            <div className="cp-inv-acts-main">
              <button type="button" className="btn btn-green" onClick={() => goWiz('pay', c.id)}>
                <Icon name="coins" size={15} />
                {t('payRemaining')}
              </button>
              {c.phone ? (
                <button
                  type="button"
                  className="btn btn-soft"
                  style={{ color: 'var(--green)' }}
                  onClick={() => waRemindInv(inv.id)}
                >
                  <Icon name="wa" size={15} />
                  {t('waRemind')}
                </button>
              ) : null}
            </div>
          )}
          <div className="cp-inv-acts-sec">
            <button
              type="button"
              className="cp-inv-sbtn"
              onClick={() => openSheet({ type: 'invEdit', invId: inv.id })}
            >
              <Icon name="edit" size={13} />
              <span>{t('editL')}</span>
            </button>
            <button
              type="button"
              className="cp-inv-sbtn amber"
              onClick={() => openSheet({ type: 'returnAdjust', invId: inv.id })}
            >
              <Icon name="undo" size={13} />
              <span>{t('ret')}</span>
            </button>
            <button
              type="button"
              className="cp-inv-sbtn"
              onClick={() => shareOneById(`d:${inv.id}`)}
            >
              <Icon name="share" size={13} />
              <span>{t('share')}</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <HeaderBar
        title={t('custAcc')}
        onBack={back}
        onMenu={() => openSheet({ type: 'custProfileMenu', cid: c.id })}
      />

      <div className="pad cp-wrap">
        <div className="card cp-hero">
          <div className="cp-hero-top">
            <Avatar
              name={c.name}
              size={56}
              cid={c.id}
              onClick={() => openSheet({ type: 'photoPicker', target: c.id })}
              ariaLabel={t('photoT')}
              style={{ fontSize: 19 }}
            />
            <div className="cp-hero-info">
              <div className="cp-name">{c.name}</div>
              <div className="cp-sub">
                {c.phone ? (
                  <>
                    <span className="num">{c.phone}</span>
                    <span>·</span>
                  </>
                ) : null}
                <span>{sinceTxt}</span>
              </div>
            </div>
            <button
              type="button"
              className={`cp-pin-btn${c.pinned ? ' on' : ''}`}
              onClick={() => togglePin(c.id)}
              aria-label={c.pinned ? t('unpinAct') : t('pinAct')}
            >
              <Icon name={c.pinned ? 'pinf' : 'pin'} size={18} />
            </button>
          </div>

          <div className="cp-qacts">
            {c.phone ? (
              <>
                <a className="cp-qbtn" href={`tel:${c.phone}`}>
                  <Icon name="phone" size={15} />
                  <span>{t('callC')}</span>
                </a>
                <button type="button" className="cp-qbtn wa" onClick={() => sendWA(c.id)}>
                  <Icon name="wa" size={15} />
                  <span>{openAmt > 0 ? t('waRemind') : t('waShort')}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                className="cp-qbtn"
                onClick={() => {
                  setUi((prev) => ({ ...prev, nc: { name: '', phone: '', edit: c.id, photo: null } }));
                  go('newcust', { edit: c.id });
                }}
              >
                <Icon name="phone" size={15} />
                <span>{t('addPhone')}</span>
              </button>
            )}
            <button
              type="button"
              className="cp-qbtn"
              onClick={() => openSheet({ type: 'exportCustomer', cid: c.id })}
            >
              <Icon name="share" size={15} />
              <span>{t('stmtShare')}</span>
            </button>
          </div>
        </div>

        {c.archived && (
          <button type="button" className="btn btn-line" onClick={() => restoreCustomer(c.id)}>
            <Icon name="undo" size={17} />
            {t('restore')}
          </button>
        )}

        <div className="cp-kpis">
          <div className={`cp-kpi ${openAmt > 0 ? 'red' : 'green'}`}>
            <span className="cp-kpi-lbl">{t('remaining')}</span>
            <span className="cp-kpi-val">
              <span className="num">{fmt(openAmt, mu)}</span>
              <span className="cur">{curAcc.cur}</span>
            </span>
          </div>
          <div className="cp-kpi green">
            <span className="cp-kpi-lbl">{t('totalPaid')}</span>
            <span className="cp-kpi-val">
              <span className="num">{fmt(paidAmt, mu)}</span>
              <span className="cur">{curAcc.cur}</span>
            </span>
          </div>
        </div>

        {hasLimit && (
          <div className="card cp-limit">
            <div className="cp-limit-top">
              <span className="muted">
                {t('limitT')}: <strong className="num">{fmt(limitVal, mu)}</strong> {curAcc.cur}
              </span>
              <span
                style={{
                  color: isOverLimit ? 'var(--red)' : isNearLimit ? 'var(--amber)' : 'var(--muted)',
                }}
              >
                {limitStatusTxt}
              </span>
            </div>
            <div className="cp-limit-bar">
              <div
                className="cp-limit-fill"
                style={{
                  width: `${limitPct}%`,
                  background: isOverLimit ? 'var(--red)' : isNearLimit ? 'var(--amber)' : 'var(--navy)',
                }}
              />
            </div>
          </div>
        )}

        {focusPay && (
          <div className="card cp-focus">
            <div className="cp-focus-top">
              <span className="kic" style={{ background: 'var(--green-bg)', color: 'var(--green)' }}>
                <Icon name="coins" size={18} />
              </span>
              <div className="sp">
                <div style={{ fontWeight: 800, fontSize: 14.5 }}>{t('pay')}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
                  <DateStr ts={focusPay.ts} /> · <TimeStr ts={focusPay.ts} />
                </div>
              </div>
              <span className="amt green" style={{ fontSize: 16 }}>
                <MoneyText amount={focusPay.amount} />
              </span>
              <button
                type="button"
                className="cp-focus-close"
                aria-label={t('close')}
                onClick={() => setDismissedFocus(activeFocus)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div className="cp-focus-meta">
              <span style={{ color: 'var(--green)' }}>
                {t('method')}: {t(focusPay.method || 'cash')}
              </span>
              <span>·</span>
              <span>
                <span className="num">{(focusPay.alloc && focusPay.alloc.length) || 0}</span> {t('payLog')}
              </span>
            </div>
            <div className="cp-focus-acts">
              <button type="button" className="btn btn-soft" onClick={() => shareOneById(activeFocus!)}>
                <Icon name="share" size={15} />
                {t('share')}
              </button>
              <button
                type="button"
                className="btn btn-line"
                onClick={() => openSheet({ type: 'payDetails', payId: focusPay!.id })}
              >
                <Icon name="fwd" size={15} />
                {t('opDet')}
              </button>
            </div>
          </div>
        )}

        <div className="seg cp-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tabView === 'log'}
            className={tabView === 'log' ? 'on' : ''}
            onClick={() => {
              haptic('tap', sec);
              setTabView('log');
            }}
          >
            {t('txAll')} (<span className="num">{evs.length}</span>)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tabView === 'invoices'}
            className={tabView === 'invoices' ? 'on' : ''}
            onClick={() => {
              haptic('tap', sec);
              setTabView('invoices');
            }}
          >
            {t('invoices')} (<span className="num">{invs.length}</span>)
          </button>
        </div>

        {tabView === 'log' ? (
          <>
            {evs.length > 0 && (
              <div className="cp-log-bar">
                <span className="muted" style={{ fontSize: 12 }}>
                  <span className="num">{filteredEvs.length}</span> {t('repOps')}
                </span>
                <div className="rep-kind-seg">
                  {(
                    [
                      ['all', t('all')],
                      ['debt', t('debtsF')],
                      ['pay', t('paysF')],
                    ] as const
                  ).map(([kf, label]) => (
                    <button
                      key={kf}
                      type="button"
                      className={logFilter === kf ? 'on' : ''}
                      onClick={() => {
                        haptic('tap', sec);
                        setLogFilter(kf);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="cp-list" id="pfeed">
              {filteredEvs.length ? (
                filteredEvs.map((e, idx) => {
                  const icn = e.k === 'pay' ? 'coins' : e.k === 'edit' ? 'undo' : e.k === 'open' ? 'hist' : 'receipt';
                  const col = e.k === 'pay' ? 'var(--green)' : e.k === 'edit' ? 'var(--amber)' : 'var(--red)';
                  const bg = e.k === 'pay' ? 'var(--green-bg)' : e.k === 'edit' ? 'var(--amber-bg)' : 'var(--red-bg)';
                  const lb = e.k === 'pay' ? t('pay') : e.k === 'edit' ? t('ret') : e.k === 'open' ? t('opening') : t('newDebt');
                  const rowKey = `${e.k}-${e.id}-${idx}`;
                  const invObj = e.k !== 'pay' ? getInv(dd, e.id) : null;
                  const isOpen = !!invObj && (expandedLogKey === rowKey || (e.k !== 'edit' && expandedLogKey === e.id));

                  return (
                    <div
                      key={rowKey}
                      className={`card cp-ev${isOpen ? ' open' : ''}${holdingKey === rowKey ? ' lp-hold' : ''}`}
                      onClick={() => {
                        if (Date.now() - lpFiredRef.current < 700) return;
                        haptic('tap', sec);
                        if (e.k === 'pay') {
                          openSheet({ type: 'payDetails', payId: e.id });
                        } else if (invObj) {
                          setExpandedLogKey((cur) => (cur === rowKey || (e.k !== 'edit' && cur === e.id) ? null : rowKey));
                        }
                      }}
                      onPointerDown={(ev) => {
                        if (Date.now() - touchSeenRef.current < 800 || ev.pointerType === 'touch') return;
                        if (e.k !== 'pay' && !invObj) return;
                        lpPosRef.current = { x: ev.clientX, y: ev.clientY };
                        setHoldingKey(rowKey);
                        if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                        lpTimerRef.current = window.setTimeout(() => {
                          lpTimerRef.current = null;
                          triggerRowLp(rowKey, () => {
                            if (e.k === 'pay') openSheet({ type: 'payDetails', payId: e.id });
                            else if (invObj) openSheet({ type: 'invMenu', invId: invObj.id });
                          });
                        }, 380);
                      }}
                      onPointerUp={cancelRowLp}
                      onPointerLeave={cancelRowLp}
                      onTouchStart={(ev) => {
                        touchSeenRef.current = Date.now();
                        if (e.k !== 'pay' && !invObj) return;
                        const pt = ev.touches[0];
                        if (!pt) return;
                        lpPosRef.current = { x: pt.clientX, y: pt.clientY };
                        setHoldingKey(rowKey);
                        if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                        lpTimerRef.current = window.setTimeout(() => {
                          lpTimerRef.current = null;
                          triggerRowLp(rowKey, () => {
                            if (e.k === 'pay') openSheet({ type: 'payDetails', payId: e.id });
                            else if (invObj) openSheet({ type: 'invMenu', invId: invObj.id });
                          });
                        }, 380);
                      }}
                      onTouchMove={(ev) => {
                        if (!lpTimerRef.current) return;
                        const pt = ev.touches[0];
                        if (pt && Math.abs(pt.clientX - lpPosRef.current.x) + Math.abs(pt.clientY - lpPosRef.current.y) > 10) {
                          cancelRowLp();
                        }
                      }}
                      onTouchEnd={cancelRowLp}
                      onContextMenu={(ev) => ev.preventDefault()}
                    >
                      <div className="cp-ev-row">
                        <span className="kic" style={{ background: bg, color: col }}>
                          <Icon name={icn} size={17} />
                        </span>
                        <div className="cp-ev-mid">
                          <div className="cp-ev-top">
                            <span style={{ color: col }}>{lb}</span>
                            {e.code ? (
                              <span className="muted num" style={{ fontSize: 12, fontWeight: 700 }}>
                                · {e.code}
                              </span>
                            ) : null}
                          </div>
                          <div className="cp-ev-meta">
                            <span className="cp-ev-time">
                              <DateStr ts={e.ts} /> · <TimeStr ts={e.ts} />
                            </span>
                            {e.note ? (
                              <>
                                <span style={{ opacity: 0.45 }}>·</span>
                                <span className="cp-ev-note">{e.note}</span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        <div className="cp-ev-side">
                          <span className="cp-ev-amt" style={{ color: col }}>
                            {e.k === 'pay' ? (
                              <>
                                <span>+</span>
                                <span className="num">{fmt(e.amt || 0, mu)}</span>
                                <span className="cur">{curAcc.cur}</span>
                              </>
                            ) : e.k === 'edit' ? (
                              <span className="num">
                                {fmt(e.from || 0, mu)} ← {fmt(e.to || 0, mu)}
                              </span>
                            ) : (
                              <>
                                <span>-</span>
                                <span className="num">{fmt(e.amt || 0, mu)}</span>
                                <span className="cur">{curAcc.cur}</span>
                              </>
                            )}
                          </span>
                          {invObj && (
                            <span className={`cp-chev${isOpen ? ' open' : ''}`}>
                              <Icon name="chevD" size={14} />
                            </span>
                          )}
                        </div>
                      </div>
                      {isOpen && invObj ? renderInvoiceBody(invObj) : null}
                    </div>
                  );
                })
              ) : (
                <div className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  {t('noOps')}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="cp-list">
            {invs.length ? (
              invs.map((i) => {
                const st = invStatus(ix, i);
                const rem = invRem(ix, i);
                const paidV = invPaid(ix, i.id);
                const stCol = st === 'paid' ? 'green' : st === 'part' ? 'amber' : 'red';
                const stLabel = t(st);
                const isOpen = expandedInvId === i.id;

                return (
                  <div
                    key={i.id}
                    className={`card cp-inv${isOpen ? ' open' : ''}${holdingKey === i.id ? ' lp-hold' : ''}`}
                    onClick={() => {
                      if (Date.now() - lpFiredRef.current < 700) return;
                      haptic('tap', sec);
                      setExpandedInvId((cur) => (cur === i.id ? null : i.id));
                    }}
                    onPointerDown={(ev) => {
                      if (Date.now() - touchSeenRef.current < 800 || ev.pointerType === 'touch') return;
                      lpPosRef.current = { x: ev.clientX, y: ev.clientY };
                      setHoldingKey(i.id);
                      if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                      lpTimerRef.current = window.setTimeout(() => {
                        lpTimerRef.current = null;
                        triggerRowLp(i.id, () => openSheet({ type: 'invMenu', invId: i.id }));
                      }, 380);
                    }}
                    onPointerUp={cancelRowLp}
                    onPointerLeave={cancelRowLp}
                    onTouchStart={(ev) => {
                      touchSeenRef.current = Date.now();
                      const pt = ev.touches[0];
                      if (!pt) return;
                      lpPosRef.current = { x: pt.clientX, y: pt.clientY };
                      setHoldingKey(i.id);
                      if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                      lpTimerRef.current = window.setTimeout(() => {
                        lpTimerRef.current = null;
                        triggerRowLp(i.id, () => openSheet({ type: 'invMenu', invId: i.id }));
                      }, 380);
                    }}
                    onTouchMove={(ev) => {
                      if (!lpTimerRef.current) return;
                      const pt = ev.touches[0];
                      if (pt && Math.abs(pt.clientX - lpPosRef.current.x) + Math.abs(pt.clientY - lpPosRef.current.y) > 10) {
                        cancelRowLp();
                      }
                    }}
                    onTouchEnd={cancelRowLp}
                    onContextMenu={(ev) => ev.preventDefault()}
                  >
                    <div className="cp-inv-row">
                      <div className="cp-inv-title">
                        <span>
                          {t('invoice')} <span className="num">{i.code}</span>
                        </span>
                        <span className="muted">·</span>
                        <span className={`cp-inv-st ${stCol}`}>{stLabel}</span>
                      </div>
                      <div className="cp-ev-side">
                        <span
                          className="cp-ev-amt"
                          style={{ color: st === 'paid' ? 'var(--green)' : 'var(--red)' }}
                        >
                          <span className="num">{fmt(st === 'paid' ? i.amount : rem, mu)}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                        <span className={`cp-chev${isOpen ? ' open' : ''}`}>
                          <Icon name="chevD" size={14} />
                        </span>
                      </div>
                    </div>

                    <div className="cp-inv-sub">
                      <span className="cp-ev-time">
                        <DateStr ts={i.ts} /> · <TimeStr ts={i.ts} />
                      </span>
                      {st === 'part' ? (
                        <>
                          <span>·</span>
                          <span>
                            {t('total')} <span className="num">{fmt(i.amount, mu)}</span> · {t('paidLbl')}{' '}
                            <span className="num">{fmt(paidV, mu)}</span>
                          </span>
                        </>
                      ) : null}
                      {!isOpen && i.note ? (
                        <>
                          <span>·</span>
                          <span className="cp-ev-note">{i.note}</span>
                        </>
                      ) : null}
                    </div>

                    {isOpen ? renderInvoiceBody(i) : null}
                  </div>
                );
              })
            ) : (
              <div className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                {t('noInv')}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="bottombar">
        <LongPressButton kind="debt" cls="btn-red" icon="receipt" label={t('newDebt')} />
        <LongPressButton kind="pay" cls="btn-green" icon="coins" label={t('pay')} />
      </div>
    </>
  );
};
