import React, { useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { NotifButton } from '../components/HeaderBar';
import { Avatar, TimeStr } from '../components/Formatters';
import { useApp } from '../context/AppContext';
import { haptic } from '../core/feedback';
import { custOpen, getCust, getInv, Ledger, openTotal } from '../core/ledger';
import { dayKey, dayLabelText, fmt, getMU } from '../core/format';
import { filteredTx, type FeedTx } from '../core/queries';
import { libLoad } from '../core/libLoader';

export const HomeScreen: React.FC = () => {
  const {
    db,
    dd,
    ix,
    curAcc,
    sec,
    isP,
    ui,
    setUi,
    t,
    openSheet,
    go,
    selExit,
    selToggle,
    selDay,
    selAllVisible,
    selShare,
    selDelete,
    toastMsg,
  } = useApp();

  const lpTimerRef = useRef<number | null>(null);
  const lpPosRef = useRef({ x: 0, y: 0 });
  const lpFiredRef = useRef(0);
  const lpKeyRef = useRef('');
  const touchSeenRef = useRef(0);
  const [holdingKey, setHoldingKey] = useState<string | null>(null);

  const { items, fullCount } = useMemo(() => {
    if (!db) return { items: [], fullCount: 0 };
    return filteredTx(db, dd, ui.tf, ui.tq, ui.txLimit);
  }, [db, dd, ui.tf, ui.tq, ui.txLimit]);

  if (!db) return null;

  const hfCount = (ui.tf.kind !== 'all' ? 1 : 0) + (ui.tf.period !== 'all' ? 1 : 0);
  const selMode = ui.sel.on;

  const startLongPress = (key: string) => {
    if (ui.sel.on) return;
    setHoldingKey(null);
    haptic('select', sec);
    lpKeyRef.current = key;
    lpFiredRef.current = Date.now();
    setUi((prev) => ({ ...prev, sel: { on: true, ids: [key] } }));
  };

  const mu = getMU(curAcc);
  const selSummary = useMemo(() => {
    if (!selMode || !ui.sel.ids.length) return { debt: 0, pay: 0 };
    let debt = 0;
    let pay = 0;
    ui.sel.ids.forEach((k) => {
      const id = k.substring(2);
      if (k[0] === 'd') {
        const inv = dd.invoices.find((x) => x.id === id);
        if (inv) debt += inv.amount;
      } else {
        const p = dd.payments.find((x) => x.id === id);
        if (p) pay += p.amount;
      }
    });
    return { debt, pay };
  }, [selMode, ui.sel.ids, dd.invoices, dd.payments]);

  const singleSelKey = selMode && ui.sel.ids.length === 1 ? ui.sel.ids[0] : null;
  const singleSelCustId = useMemo(() => {
    if (!singleSelKey) return null;
    const id = singleSelKey.substring(2);
    if (singleSelKey[0] === 'd') return dd.invoices.find((x) => x.id === id)?.cust || null;
    return dd.payments.find((x) => x.id === id)?.cust || null;
  }, [singleSelKey, dd.invoices, dd.payments]);

  const handleTxOpen = (x: FeedTx) => {
    if (Date.now() - lpFiredRef.current < 900) return;
    if (x.cust) {
      go('profile', { id: x.cust, focus: (x.kind === 'debt' ? 'd:' : 'p:') + (x.inv || x.key.substring(2)) });
    } else if (x.kind === 'debt' && x.inv) {
      go('invoice', { id: x.inv });
    }
  };

  const handleSelXlsx = async () => {
    if (!ui.sel.on || !ui.sel.ids.length) {
      toastMsg(t('selEmpty'));
      return;
    }
    try {
      await libLoad('lib/xlsx.full.min.js');
    } catch {
      toastMsg('Excel');
      return;
    }
    const XLSX = (window as any).XLSX;
    if (!XLSX) {
      toastMsg('Excel');
      return;
    }
    const mu = getMU(curAcc);
    const rows: any[][] = [[t('date'), t('time'), t('cust'), t('type'), curAcc.cur, t('remind')]];
    const found = ui.sel.ids
      .map((k) => {
        const id = k.substring(2);
        if (k[0] === 'd') {
          const i = dd.invoices.find((x) => x.id === id);
          return i ? { kind: 'debt', ts: i.ts, hasTime: i.hasTime, cust: i.cust, amount: i.amount, note: i.note || '' } : null;
        }
        const p = dd.payments.find((x) => x.id === id);
        return p ? { kind: 'pay', ts: p.ts, hasTime: p.hasTime, cust: p.cust, amount: p.amount, note: p.method || '' } : null;
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((x, y) => y.ts - x.ts);

    found.forEach((o) => {
      const c = o.cust ? getCust(dd, o.cust) : null;
      const dStr = new Date(o.ts).toLocaleDateString('en-GB');
      const tStr = o.hasTime ? new Date(o.ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      rows.push([dStr, tStr, c ? c.name : '', t(o.kind === 'debt' ? 'debt' : 'pay'), fmt(o.amount, mu), o.note]);
    });

    try {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'sel');
      XLSX.writeFile(wb, 'dafter-selection.xlsx');
      toastMsg(t('done'));
    } catch {
      toastMsg('Excel');
    }
  };

  // Group items by day label
  const groupedDays: { dk: string; dl: string; first: boolean; rows: FeedTx[] }[] = [];
  let lastDl = '';
  items.forEach((x) => {
    const dl = dayLabelText(x.ts, db);
    const dk = dayKey(x.ts);
    if (dl !== lastDl) {
      groupedDays.push({ dk, dl, first: groupedDays.length === 0, rows: [x] });
      lastDl = dl;
    } else {
      groupedDays[groupedDays.length - 1].rows.push(x);
    }
  });

  const anyData = dd.invoices.length + dd.payments.length > 0;

  const d0 = new Date();
  d0.setHours(0, 0, 0, 0);
  const todayA = d0.getTime();
  const todayB = todayA + 86400000;
  const card1Val = isP ? Ledger.todayDebt(dd, todayA, todayB) : openTotal(dd, ix);
  const card2Val = Ledger.todayPay(dd, todayA, todayB);
  const owingCount = isP
    ? (dd.invoices || []).filter((i) => !i.arch && !i.k && i.ts >= todayA && i.ts < todayB).length
    : (dd.customers || []).filter((c) => !c.archived && custOpen(ix, c.id) > 0).length;
  const todayPayCount = (dd.payments || []).filter((p) => !p.arch && p.ts >= todayA && p.ts < todayB).length;
  const isDebtTodayActive = isP && ui.tf.kind === 'debt' && ui.tf.period === 'today';
  const isPayTodayActive = ui.tf.kind === 'pay' && ui.tf.period === 'today';

  return (
    <>
      <div className="hdr">
        <div
          className="accid"
          role="button"
          tabIndex={0}
          onClick={() => openSheet({ type: 'accountSwitcher' })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') openSheet({ type: 'accountSwitcher' });
          }}
        >
          <div className="logo-ic">
            <Icon name={curAcc.type === 'grocery' ? 'store' : 'user'} size={22} />
          </div>
          <h1 style={{ fontSize: 21, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {curAcc.name}
          </h1>
          <span className="accchev">
            <Icon name="chevD" size={15} />
          </span>
        </div>
        <div className="row" style={{ gap: 8, flex: 'none' }}>
          <NotifButton />
          <button
            className="hbtn"
            style={{ width: 42, padding: 0 }}
            onClick={() => openSheet({ type: 'homeMenu' })}
            aria-label={t('menu')}
          >
            <Icon name="dots" size={19} />
          </button>
        </div>
      </div>

      <div className="pad stats" style={{ marginTop: 8 }}>
        <button
          type="button"
          className={`stat red${isDebtTodayActive ? ' on' : ''}`}
          onClick={() => {
            haptic('tap', sec);
            if (isP) {
              setUi((prev) => ({
                ...prev,
                tf: isDebtTodayActive ? { kind: 'all', period: 'all' } : { kind: 'debt', period: 'today' },
                txLimit: 60,
              }));
            } else {
              setUi((prev) => ({
                ...prev,
                f: { ...prev.f, status: 'owed', sort: 'debt', near: false, over: false },
              }));
              go('customers');
            }
          }}
        >
          <div className="t">
            <Icon name="receipt" size={14} />
            <span>{t('owed')}</span>
          </div>
          <div className="v">
            <span className="num">{fmt(card1Val, mu)}</span>
            <span className="cur">{curAcc.cur}</span>
          </div>
          <div className="s">
            {isP ? (
              owingCount > 0 ? (
                <>
                  <span className="num">{owingCount}</span> {t('pToday')}
                </>
              ) : (
                t('pToday')
              )
            ) : owingCount > 0 ? (
              <>
                <span className="num">{owingCount}</span> {t('nOwe')}
              </>
            ) : (
              t('settled')
            )}
          </div>
        </button>

        <button
          type="button"
          className={`stat green${isPayTodayActive ? ' on' : ''}`}
          onClick={() => {
            haptic('tap', sec);
            setUi((prev) => ({
              ...prev,
              tf: isPayTodayActive ? { kind: 'all', period: 'all' } : { kind: 'pay', period: 'today' },
              txLimit: 60,
            }));
          }}
        >
          <div className="t">
            <Icon name="banknote" size={14} />
            <span>{t('collToday')}</span>
          </div>
          <div className="v">
            <span className="num">{fmt(card2Val, mu)}</span>
            <span className="cur">{curAcc.cur}</span>
          </div>
          <div className="s">
            {todayPayCount > 0 ? (
              <>
                <span className="num">{todayPayCount}</span> {t('pay')}
              </>
            ) : (
              t('pToday')
            )}
          </div>
        </button>
      </div>

      <div className="pad search" style={{ marginTop: 12 }}>
        <div className="inp card">
          <Icon name="search" size={17} />
          <input
            placeholder={t('searchTx')}
            value={ui.tq}
            onChange={(e) => setUi((prev) => ({ ...prev, tq: e.target.value }))}
          />
        </div>
        <button
          className="hbtn"
          style={{ height: 46, position: 'relative' }}
          onClick={() => openSheet({ type: 'homeFilter' })}
          aria-label={t('filter')}
        >
          <Icon name="sliders" size={18} />
          {hfCount > 0 && (
            <span
              className="num"
              style={{
                position: 'absolute',
                top: 5,
                insetInlineEnd: 5,
                background: 'var(--red)',
                color: '#fff',
                borderRadius: 999,
                fontSize: 10,
                minWidth: 16,
                height: 16,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
              }}
            >
              {hfCount}
            </span>
          )}
        </button>
      </div>

      {selMode ? (
        <div className="pad sel-top-wrap">
          <div className="sel-top">
            <div className="sel-top-head">
              <button className="sel-close" onClick={selExit} aria-label={t('cancel')}>
                <Icon name="x" size={16} />
              </button>
              <div className="sel-info">
                <div className="sel-count">
                  <span>{t('selN')}</span>
                  <span className="num">{ui.sel.ids.length}</span>
                </div>
                <div className="sel-sub">
                  {ui.sel.ids.length === 0 ? (
                    t('selEmpty')
                  ) : selSummary.debt > 0 && selSummary.pay > 0 ? (
                    <>
                      <span style={{ color: 'var(--red)' }}>
                        {t('debtsF')} <span className="num">{fmt(selSummary.debt, mu)}</span>
                      </span>
                      {' · '}
                      <span style={{ color: 'var(--green)' }}>
                        {t('paysF')} <span className="num">{fmt(selSummary.pay, mu)}</span>
                      </span>
                    </>
                  ) : selSummary.debt > 0 ? (
                    <span style={{ color: 'var(--red)' }}>
                      {t('debtsF')}: <span className="num">{fmt(selSummary.debt, mu)}</span> {curAcc.cur}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--green)' }}>
                      {t('paysF')}: <span className="num">{fmt(selSummary.pay, mu)}</span> {curAcc.cur}
                    </span>
                  )}
                </div>
              </div>
              <button
                className={`sel-all-btn${items.length > 0 && items.every((x) => ui.sel.ids.includes(x.key)) ? ' on' : ''}`}
                onClick={() => selAllVisible(items.map((x) => x.key))}
              >
                <Icon name="checkAll" size={15} />
                <span>{t('selAllS')}</span>
              </button>
            </div>

            <div className="sel-top-acts">
              {singleSelKey &&
                (singleSelKey[0] === 'd' ? (
                  <button
                    className="sel-act navy"
                    onClick={() => {
                      const invId = singleSelKey.substring(2);
                      selExit();
                      openSheet({ type: 'invEdit', invId });
                    }}
                  >
                    <Icon name="edit" size={18} />
                    <span>{t('editL')}</span>
                  </button>
                ) : (
                  <button
                    className="sel-act navy"
                    onClick={() => {
                      const payId = singleSelKey.substring(2);
                      selExit();
                      openSheet({ type: 'payDetails', payId });
                    }}
                  >
                    <Icon name="receipt" size={18} />
                    <span>{t('opDet')}</span>
                  </button>
                ))}
              {!isP && singleSelCustId && (
                <button
                  className="sel-act"
                  onClick={() => {
                    const cid = singleSelCustId;
                    selExit();
                    go('profile', { id: cid });
                  }}
                >
                  <Icon name="user" size={18} />
                  <span>{t('openAcc2')}</span>
                </button>
              )}
              <button
                className={`sel-act${ui.sel.ids.length === 0 ? ' disabled' : ''}`}
                onClick={selShare}
              >
                <Icon name="share" size={18} />
                <span>{t('share')}</span>
              </button>
              <button
                className={`sel-act green${ui.sel.ids.length === 0 ? ' disabled' : ''}`}
                onClick={handleSelXlsx}
              >
                <Icon name="excel" size={18} />
                <span>Excel</span>
              </button>
              <button
                className={`sel-act red${ui.sel.ids.length === 0 ? ' disabled' : ''}`}
                onClick={selDelete}
              >
                <Icon name="trash" size={18} />
                <span>{t('del')}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          className="pad"
          style={{
            margin: '12px 20px 4px',
            fontWeight: 800,
            fontSize: 16.5,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>{t('lastOps')}</span>
          <span className="muted num" id="txn" style={{ fontSize: 13.5, fontWeight: 700 }}>
            · {fullCount}
          </span>
        </div>
      )}

      <div className="pad list ops" id="txlist" style={{ paddingBottom: 14 }}>
        {!items.length ? (
          anyData && ui.tf.period === 'today' ? (
            <div className="muted" style={{ textAlign: 'center', padding: '24px 16px' }}>
              {t('noToday')}
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btn-line"
                  style={{ width: 'auto', padding: '10px 18px', fontSize: 13.5 }}
                  onClick={() => setUi((prev) => ({ ...prev, tf: { kind: 'all', period: 'all' }, txLimit: 60 }))}
                >
                  {t('showAll')}
                </button>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ textAlign: 'center', padding: '28px 16px' }}>
              {anyData ? (
                t('noRes')
              ) : (
                <>
                  <Icon name="mic" size={26} />
                  <div style={{ marginTop: 10, fontWeight: 700, lineHeight: 1.7 }}>{t('emptyHome')}</div>
                </>
              )}
            </div>
          )
        ) : (
          groupedDays.map((grp) => {
            const keysInDay = grp.rows.map((x) => x.key);
            const checkedCount = keysInDay.filter((k) => ui.sel.ids.includes(k)).length;
            const dayCls =
              checkedCount === keysInDay.length && keysInDay.length > 0
                ? ' on'
                : checkedCount > 0
                ? ' partial'
                : '';

            return (
              <React.Fragment key={grp.dk + grp.dl}>
                <div className={`daysep${grp.first ? ' daysep-first' : ''}`}>
                  <span>{grp.dl}</span>
                  {selMode && (
                    <button
                      className={`daycheck${dayCls}`}
                      onClick={() => selDay(grp.dk, keysInDay)}
                      aria-label={`${t('sel')} · ${grp.dl}`}
                    >
                      {dayCls === ' on' ? (
                        <Icon name="checkb" size={11} />
                      ) : dayCls === ' partial' ? (
                        <Icon name="minus" size={11} />
                      ) : null}
                    </button>
                  )}
                </div>

                {grp.rows.map((x) => {
                  const c = x.cust ? getCust(dd, x.cust) : null;
                  if (!c && !isP) return null;
                  const nm = c ? c.name : t(x.kind === 'debt' ? 'expense' : 'deposit');
                  const isSel = selMode && ui.sel.ids.includes(x.key);
                  const invObj = x.inv ? getInv(dd, x.inv) : undefined;
                  const edited = !!(invObj && invObj.edits && invObj.edits.length);
                  const typeLbl = x.kind === 'debt' ? (isP ? t('expense') : t('newDebt')) : t('pay');
                  const detail = x.kind === 'debt' ? x.note || '' : x.note || t('cash');
                  const amtClass = x.kind === 'debt' ? 'red' : 'green';

                  return (
                    <div
                      key={x.key}
                      className={`card litem orow${isSel ? ' sel' : ''}${holdingKey === x.key ? ' lp-hold' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (selMode) {
                          if (Date.now() - lpFiredRef.current < 900 && x.key === lpKeyRef.current) return;
                          selToggle(x.key);
                        } else {
                          handleTxOpen(x);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (selMode) selToggle(x.key);
                          else handleTxOpen(x);
                        }
                      }}
                      onPointerDown={(e) => {
                        if (selMode || Date.now() - touchSeenRef.current < 800 || e.pointerType === 'touch') return;
                        lpPosRef.current = { x: e.clientX, y: e.clientY };
                        setHoldingKey(x.key);
                        if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                        lpTimerRef.current = window.setTimeout(() => {
                          lpTimerRef.current = null;
                          startLongPress(x.key);
                        }, 380);
                      }}
                      onPointerUp={() => {
                        setHoldingKey(null);
                        if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                        lpTimerRef.current = null;
                      }}
                      onPointerLeave={() => {
                        setHoldingKey(null);
                        if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                        lpTimerRef.current = null;
                      }}
                      onTouchStart={(e) => {
                        touchSeenRef.current = Date.now();
                        if (selMode) return;
                        const pt = e.touches[0];
                        if (!pt) return;
                        lpPosRef.current = { x: pt.clientX, y: pt.clientY };
                        setHoldingKey(x.key);
                        if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                        lpTimerRef.current = window.setTimeout(() => {
                          lpTimerRef.current = null;
                          startLongPress(x.key);
                        }, 380);
                      }}
                      onTouchMove={(e) => {
                        if (!lpTimerRef.current) return;
                        const pt = e.touches[0];
                        if (pt && Math.abs(pt.clientX - lpPosRef.current.x) + Math.abs(pt.clientY - lpPosRef.current.y) > 10) {
                          setHoldingKey(null);
                          clearTimeout(lpTimerRef.current);
                          lpTimerRef.current = null;
                        }
                      }}
                      onTouchEnd={() => {
                        setHoldingKey(null);
                        if (lpTimerRef.current) clearTimeout(lpTimerRef.current);
                        lpTimerRef.current = null;
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                    >
                      {selMode && (
                        <span className={`orow-sel${isSel ? ' on' : ''}`}>
                          {isSel ? <Icon name="checkb" size={15} /> : null}
                        </span>
                      )}

                      {c ? (
                        <Avatar name={c.name} size="var(--row-av)" cid={c.id} />
                      ) : (
                        <span
                          className="av"
                          style={{
                            width: 'var(--row-av)',
                            height: 'var(--row-av)',
                            background: 'var(--navy)',
                            color: '#fff',
                          }}
                        >
                          <Icon name={x.kind === 'debt' ? 'receipt' : 'banknote'} size={18} />
                        </span>
                      )}

                      <div className="orow-mid">
                        <div className="orow-name">
                          <span>{nm}</span>
                        </div>
                        <div className="orow-meta">
                          <span className="orow-time">
                            <TimeStr ts={x.ts} />
                          </span>
                          {detail ? (
                            <>
                              <span className="sep">·</span>
                              <span className="tx">{detail}</span>
                            </>
                          ) : null}
                        </div>
                      </div>

                      <div className="orow-side">
                        <span className={`orow-amt ${amtClass}`}>
                          <span className="num">{fmt(x.amt, getMU(curAcc))}</span>
                          <span className="cur">{curAcc.cur}</span>
                        </span>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          {edited && (
                            <span
                              className="chip"
                              style={{
                                background: 'var(--amber-bg)',
                                color: 'var(--amber)',
                                border: '1px solid var(--amber-line)',
                                fontSize: 9.5,
                                padding: '1px 5px',
                                gap: 3,
                                lineHeight: 1.2,
                              }}
                            >
                              <Icon name="edit" size={9} /> {t('edited')}
                            </span>
                          )}
                          <span className={`orow-kind ${amtClass}`}>{typeLbl}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })
        )}
        {fullCount > items.length && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              className="btn btn-line"
              style={{ width: 'auto', padding: '10px 18px', fontSize: 13.5 }}
              onClick={() => setUi((prev) => ({ ...prev, txLimit: (prev.txLimit || 60) + 60 }))}
            >
              {t('showMore')} (<span className="num">{fullCount - items.length}</span>)
            </button>
          </div>
        )}
      </div>
    </>
  );
};
